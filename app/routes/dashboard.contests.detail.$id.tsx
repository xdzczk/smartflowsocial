import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

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
} from "~/features/contest";
import { saveContestPresetFromDetailForm } from "~/features/contest/contest-save-preset-from-detail.server";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { featureFlags } from "~/lib/feature-flags.server";

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
        | "marked_paid";
      const result = await setContestWinnerPayoutStatus(
        userId,
        contestId,
        winnerPubkey,
        payoutStatus
      );
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
      return redirect(`/dashboard/contests/detail/${contestId}`);
    }
    case "runBatchPayout": {
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
          return json(
            { success: false, error: result.error ?? "Batch payout failed" },
            { status: 400 }
          );
        }
        return json(result);
      }
      const result = await runContestPayoutBatchWithNwc(userId, contestId, {
        trigger: "manual_trigger",
        spendCapSats: parseSpendCapSats(formData),
      });
      if (!result.success)
        return json({ error: result.error }, { status: 400 });
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
    default:
      return json({ error: "Unknown intent" }, { status: 400 });
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
  const id = params["id"];
  if (!id) throw new Response("Not found", { status: 404 });

  const data = await getContestDetailPageData(userId, id);
  if (!data) throw new Response("Not found", { status: 404 });
  return json(data);
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
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

export default function ContestDetailRoute() {
  const data = useLoaderData<typeof loader>();
  return <ContestDetailView data={data} />;
}
