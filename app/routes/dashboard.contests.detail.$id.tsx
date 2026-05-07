import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import { Await, useLoaderData, useParams } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { requireUserId } from "~/features/auth";
import {
  ContestDetailView,
  appendContestEventLog,
  buildContestEntriesCsv,
  cancelContest,
  completeContest,
  freezeContestAtDeadline,
  getContestDetailPageData,
  launchContest,
  lockContest,
  runContestPayoutBatchWithNwc,
  runContestPayoutBatchStepWithNwc,
  setContestWinnerPayoutStatus,
  updateContestPayoutSettings,
  rescheduleContestLaunchOrchestration,
  retryContestLaunchOrchestration,
  ContestDetailPageSkeleton,
} from "~/features/contest";
import { saveContestPresetFromDetailForm } from "~/features/contest/contest-save-preset-from-detail.server";
import { requireAnySubscription } from "~/features/payments";
import { PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED } from "~/features/payments/payout-skip-messages.server";
import { hasUsableNwc } from "~/features/user";
import { featureFlags } from "~/lib/feature-flags.server";
import {
  DeferredRouteLoaderProvider,
  useDeferredRouteLoaderData,
} from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";

type ContestIntentResponse = Response;

function parseSpendCapSats(formData: FormData): number | undefined {
  const spendCapSatsRaw = String(formData.get("spendCapSats") ?? "").trim();
  const spendCapSats =
    spendCapSatsRaw !== "" ? Number(spendCapSatsRaw) : undefined;
  if (spendCapSats === undefined || !Number.isFinite(spendCapSats)) {
    return undefined;
  }
  return Math.max(0, Math.floor(spendCapSats));
}

function parsePayoutSettings(formData: FormData): {
  payoutWalletMode: "manual" | "nwc_creator";
  payoutAutoRunEnabled: boolean;
  payoutAutoRunSpendCapSats: number | null;
} {
  const mode = String(formData.get("payoutWalletMode") ?? "manual");
  const payoutWalletMode = mode === "nwc_creator" ? "nwc_creator" : "manual";
  const autoRaw = String(formData.get("payoutAutoRunEnabled") ?? "");
  const payoutAutoRunEnabled = autoRaw === "on" || autoRaw === "true";
  const capRaw = String(formData.get("payoutAutoRunSpendCapSats") ?? "").trim();
  const payoutAutoRunSpendCapSats =
    capRaw !== "" && Number.isFinite(Number(capRaw))
      ? Math.max(0, Math.floor(Number(capRaw)))
      : null;

  return {
    payoutWalletMode,
    payoutAutoRunEnabled,
    payoutAutoRunSpendCapSats,
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- Contest detail intents: export, payouts, launch recovery, retries
async function handleContestDetailIntent(args: {
  intent: FormDataEntryValue | null;
  userId: string;
  contestId: string;
  formData: FormData;
}): Promise<ContestIntentResponse> {
  const { intent, userId, contestId, formData } = args;

  switch (intent) {
    case "exportCsv": {
      const data = await getContestDetailPageData(userId, contestId);
      if (!data) return json({ error: "Not found" }, { status: 404 });
      await appendContestEventLog(
        userId,
        contestId,
        "contest_export_csv",
        "Contest entries CSV exported"
      );
      const csv = buildContestEntriesCsv(data);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="contest-${contestId}-entries.csv"`,
        },
      });
    }
    case "savePreset": {
      const result = await saveContestPresetFromDetailForm(
        userId,
        contestId,
        formData
      );
      if (!result.success) {
        return json({ error: result.error }, { status: result.status });
      }
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "launch": {
      const result = await launchContest(userId, contestId);
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "freeze": {
      const result = await freezeContestAtDeadline(userId, contestId);
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "lock": {
      const result = await lockContest(userId, contestId, {
        lockConfigHash: String(formData.get("lockConfigHash") ?? ""),
      });
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "payout": {
      const winnerPubkey = String(formData.get("winnerPubkey") ?? "");
      const payoutStatus = String(formData.get("payoutStatus") ?? "pending") as
        | "pending"
        | "sent"
        | "failed"
        | "marked_paid"
        | "claim_needed"
        | "skipped";
      const noteRaw = formData.get("payoutNote");
      const payoutNote = typeof noteRaw === "string" ? noteRaw : undefined;
      const result = await setContestWinnerPayoutStatus(
        userId,
        contestId,
        winnerPubkey,
        payoutStatus,
        payoutNote
      );
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "runBatchPayout": {
      const usableNwc = await hasUsableNwc(userId);
      if (!usableNwc) {
        return json(
          {
            success: false,
            error: PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED,
            code: "NWC_UNUSABLE",
          },
          { status: 400 }
        );
      }
      const stepRaw = formData.get("stepIndex");
      const hasStep = stepRaw != null && String(stepRaw).trim() !== "";
      if (hasStep) {
        const stepIndex = Math.floor(Number(stepRaw));
        if (!Number.isFinite(stepIndex) || stepIndex < 0) {
          return json({ error: "Invalid step index" }, { status: 400 });
        }
        const result = await runContestPayoutBatchStepWithNwc(
          userId,
          contestId,
          stepIndex,
          {
            trigger: "manual_trigger",
            spendCapSats: parseSpendCapSats(formData),
          }
        );
        if (!result.success) {
          return json(result, { status: 400 });
        }
        return json(result);
      }
      const result = await runContestPayoutBatchWithNwc(userId, contestId, {
        trigger: "manual_trigger",
        spendCapSats: parseSpendCapSats(formData),
      });
      if (!result.success) return json(result, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "updatePayoutSettings": {
      const result = await updateContestPayoutSettings(
        userId,
        contestId,
        parsePayoutSettings(formData)
      );
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "complete": {
      const result = await completeContest(userId, contestId, {
        completeOverrideReason: String(
          formData.get("completeOverrideReason") ?? ""
        ),
      });
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "cancel": {
      const result = await cancelContest(
        userId,
        contestId,
        String(formData.get("reason") ?? "")
      );
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
      return redirect("/dashboard/contests");
    }
    case "retryLaunchOrchestration": {
      const result = await retryContestLaunchOrchestration(userId, contestId);
      if (!result.success)
        return json({ error: result.error ?? "Retry failed" }, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "rescheduleLaunch": {
      const raw = String(formData.get("scheduledFor") ?? "").trim();
      const scheduledFor = new Date(raw);
      if (!Number.isFinite(scheduledFor.getTime())) {
        return json({ error: "Invalid schedule time" }, { status: 400 });
      }
      const result = await rescheduleContestLaunchOrchestration(
        userId,
        contestId,
        scheduledFor
      );
      if (!result.success)
        return json(
          { error: result.error ?? "Reschedule failed" },
          { status: 400 }
        );
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    default:
      return json({ error: "Unknown intent" }, { status: 400 });
  }
}

async function loadContestDetailData({ request, params }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  const id = params["id"];
  if (!id) throw new Response("Not found", { status: 404 });

  const data = await getContestDetailPageData(userId, id);
  if (!data) throw new Response("Not found", { status: 404 });
  return data;
}

export async function loader(args: LoaderFunctionArgs) {
  if (isRemixResourceRequest(args.request)) {
    return json(await loadContestDetailData(args));
  }
  return defer({
    contestDetail: loadContestDetailData(args),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  const id = params["id"];
  if (!id) return json({ error: "Not found" }, { status: 404 });
  const formData = await request.formData();
  const intent = formData.get("intent");
  return handleContestDetailIntent({
    intent,
    userId,
    contestId: id,
    formData,
  });
}

type ContestDetailLoaderPayload = Awaited<
  ReturnType<typeof loadContestDetailData>
>;

function ContestDetailRouteInner() {
  const data = useDeferredRouteLoaderData() as ContestDetailLoaderPayload;
  return <ContestDetailView data={data} />;
}

export default function ContestDetailRoute() {
  const params = useParams();
  const id = params["id"] ?? "";
  const { contestDetail } = useLoaderData() as {
    contestDetail: Promise<ContestDetailLoaderPayload>;
  };
  const retryTo =
    id !== "" ? `/dashboard/contests/detail/${id}` : "/dashboard/contests";

  return (
    <Suspense fallback={<ContestDetailPageSkeleton />}>
      <Await
        resolve={contestDetail}
        errorElement={<DeferredRouteAwaitError retryTo={retryTo} />}
      >
        {(loaded) => (
          <DeferredRouteLoaderProvider value={loaded}>
            <ContestDetailRouteInner />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}
