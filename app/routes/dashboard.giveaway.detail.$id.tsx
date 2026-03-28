import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import { Await, useLoaderData, useParams } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { DeferredListPageSkeleton } from "~/components/skeletons/DeferredListPageSkeleton";
import { requireUserId } from "~/features/auth";
import type { GiveawayWinnerEntry } from "~/features/giveaway";
import {
  GiveawayDetailPage,
  appendGiveawayAuditActivity,
  getGiveawayById,
  previewGiveaway,
  rerollGiveaway,
  excludeWinnerAndRedraw,
  lockGiveaway,
  cancelGiveaway,
  deleteGiveaway,
  markGiveawayPaidOut,
  resetGiveawayToDraft,
  setGiveawayWinnerPayoutStatus,
  runGiveawayPayoutBatchWithNwc,
  runGiveawayPayoutBatchStepWithNwc,
  updateGiveawayPayoutSettings,
  updateGiveaway,
} from "~/features/giveaway";
import {
  formatScopeSummaryLabel,
  formatStatusLabel,
  resolveGiveawayQueueName,
} from "~/features/giveaway/giveaway-display.server";
import { quoteGiveawayFinalization } from "~/features/giveaway/giveaway-finalization-fee.server";
import { getWinnerProfiles } from "~/features/giveaway/giveaway-loader.server";
import {
  countPayoutCompleted,
  normalizePayoutState,
  totalSatsBudgetFromSnapshot,
  totalSatsPaidFromState,
} from "~/features/giveaway/giveaway-payout.server";
import { createGiveawayPreset } from "~/features/giveaway/giveaway-presets.server";
import {
  buildGiveawayPublicSummaryLines,
  buildGiveawayReceiptSummaryLine,
} from "~/features/giveaway/giveaway-proof-share.server";
import {
  getSubscriptionData,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { createGiveawayFinalizationInvoice } from "~/features/payments/data/payment.commands.server";
import {
  getGiveawayPlanLimits,
  getPlanDisplayName,
  getUserPlanType,
} from "~/features/payments/types";
import { getUserNWC } from "~/features/user";
import { ExternalServiceError } from "~/lib/errors";
import {
  DeferredRouteLoaderProvider,
  useDeferredRouteLoaderData,
} from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";

async function loadGiveawayDetailData({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "giveaways");

  const id = params["id"];
  if (!id) {
    throw new Response("Not found", { status: 404 });
  }

  const [giveaway, subscriptionData, nwc] = await Promise.all([
    getGiveawayById(id, userId),
    getSubscriptionData(userId),
    getUserNWC(userId),
  ]);
  if (!giveaway) {
    throw new Response("Not found", { status: 404 });
  }

  const planType = getUserPlanType(subscriptionData.currentSubscription);
  const limits = getGiveawayPlanLimits(planType);
  const planDisplayName = getPlanDisplayName(
    subscriptionData.currentSubscription
  );

  const scopeRef = giveaway.scopeReference as Record<string, unknown>;
  const hasQueue =
    giveaway.scopeType === "QUEUE" ||
    (typeof scopeRef["queueId"] === "string" &&
      scopeRef["queueId"].trim() !== "");
  const queueName = hasQueue
    ? await resolveGiveawayQueueName(userId, scopeRef)
    : null;
  const scopeSummaryLabel = formatScopeSummaryLabel(
    giveaway.scopeType,
    scopeRef,
    queueName
  );
  const statusLabel = formatStatusLabel(giveaway.status);

  const isDraftOrPreviewed =
    giveaway.status === "DRAFT" || giveaway.status === "PREVIEWED";

  const snapshot = giveaway.winnerSnapshot as GiveawayWinnerEntry[] | null;
  const winnerPubkeys =
    snapshot?.map((w: GiveawayWinnerEntry) => w.pubkey) ?? [];
  const winnerProfiles = await getWinnerProfiles(winnerPubkeys);

  const payoutSnapshot = snapshot ?? [];
  const payoutStateNormalized =
    payoutSnapshot.length > 0
      ? normalizePayoutState(giveaway.payoutState, payoutSnapshot)
      : {};
  const payoutProgress =
    payoutSnapshot.length > 0 &&
    (giveaway.status === "LOCKED" || giveaway.status === "PAID_OUT")
      ? {
          settledCount: countPayoutCompleted(
            payoutStateNormalized,
            payoutSnapshot.map((w) => w.pubkey)
          ),
          totalWinners: payoutSnapshot.length,
          budgetSats: totalSatsBudgetFromSnapshot(payoutSnapshot),
          settledSats: totalSatsPaidFromState(
            payoutSnapshot,
            payoutStateNormalized
          ),
        }
      : null;

  const finalizationQuote =
    giveaway.status === "PREVIEWED" && payoutSnapshot.length > 0
      ? quoteGiveawayFinalization({
          giveaway: {
            winnerSnapshot: giveaway.winnerSnapshot,
            engagementConfig: giveaway.engagementConfig,
            winnerCount: giveaway.winnerCount,
            selectionMode: giveaway.selectionMode,
            scopeType: giveaway.scopeType,
            scopeReference: giveaway.scopeReference,
            engagementTypes: giveaway.engagementTypes,
            filters: giveaway.filters,
            engagementWeights: giveaway.engagementWeights,
          },
          planType,
        })
      : null;

  const completedAtFormatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(giveaway.updatedAt);

  const receiptSummaryLine =
    giveaway.status === "PAID_OUT"
      ? buildGiveawayReceiptSummaryLine({
          scopeSummaryLabel,
          winnerCount: payoutSnapshot.length || giveaway.winnerCount,
          plannedPayoutSats:
            giveaway.plannedPayoutSats ??
            totalSatsBudgetFromSnapshot(payoutSnapshot),
          finalizationFeeSats: giveaway.finalizationFeeSats ?? 0,
          planAtFinalization: giveaway.planAtFinalization ?? null,
          completedAtLabel: completedAtFormatted,
        })
      : null;

  const publicSummaryText =
    giveaway.status === "PAID_OUT"
      ? buildGiveawayPublicSummaryLines({
          title:
            giveaway.name?.trim() && giveaway.name.trim() !== ""
              ? giveaway.name.trim()
              : `Giveaway ${giveaway.id.slice(0, 8)}`,
          scopeLine: scopeSummaryLabel,
          winnerCount: payoutSnapshot.length || giveaway.winnerCount,
          budgetSats:
            giveaway.plannedPayoutSats ??
            totalSatsBudgetFromSnapshot(payoutSnapshot),
          completedAtLabel: completedAtFormatted,
        }).join("\n")
      : null;

  return {
    nwc: {
      enabled: nwc.enabled,
      maskedString: nwc.maskedString ?? null,
      lastUsed: nwc.lastUsed ? nwc.lastUsed.toISOString() : null,
    },
    giveaway: {
      id: giveaway.id,
      name: giveaway.name ?? null,
      status: giveaway.status,
      statusLabel,
      scopeType: giveaway.scopeType,
      scopeSummaryLabel,
      winnerCount: giveaway.winnerCount,
      winnerSnapshot: giveaway.winnerSnapshot,
      lockedAt: giveaway.lockedAt?.toISOString() ?? null,
      createdAt: giveaway.createdAt.toISOString(),
      updatedAt: giveaway.updatedAt.toISOString(),
      engagementConfig: giveaway.engagementConfig,
      payoutState: payoutStateNormalized,
      payoutWalletMode: giveaway.payoutWalletMode,
      payoutAutoRunEnabled: giveaway.payoutAutoRunEnabled,
      payoutAutoRunSpendCapSats: giveaway.payoutAutoRunSpendCapSats ?? null,
      payoutProgress,
      lastPreviewMeta: giveaway.lastPreviewMeta,
      rerollCount: giveaway.rerollCount,
      excludedPubkeys: giveaway.excludedPubkeys,
      activityLog: giveaway.activityLog,
      plannedPayoutSats: giveaway.plannedPayoutSats ?? null,
      finalizationFeeSats: giveaway.finalizationFeeSats ?? null,
      finalizationFeeRateBps: giveaway.finalizationFeeRateBps ?? null,
      finalizationFeeStatus: giveaway.finalizationFeeStatus ?? null,
      planAtFinalization: giveaway.planAtFinalization ?? null,
      ...(isDraftOrPreviewed && {
        scopeReference: scopeRef,
        engagementTypes: giveaway.engagementTypes as string[],
        selectionMode: giveaway.selectionMode,
        engagementWeights: giveaway.engagementWeights as Record<
          string,
          number
        > | null,
        filters: giveaway.filters as Record<string, unknown> | null,
      }),
    },
    giveawaysLimits: limits,
    winnerProfiles,
    planType,
    planDisplayName,
    finalizationQuote,
    receiptSummaryLine,
    publicSummaryText,
  };
}

export async function loader(args: LoaderFunctionArgs) {
  if (isRemixResourceRequest(args.request)) {
    return json(await loadGiveawayDetailData(args));
  }
  return defer({
    giveawayDetail: loadGiveawayDetailData(args),
  });
}

/* eslint-disable sonarjs/cognitive-complexity -- action handles multiple form actions */
export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "giveaways");

  const id = params["id"];
  if (!id) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  const url = new URL(request.url);
  const redirectBack = () => redirect(url.pathname);

  switch (intent) {
    case "preview": {
      const result = await previewGiveaway(userId, id);
      if (result.error) return json(result);
      return redirectBack();
    }
    case "reroll": {
      const result = await rerollGiveaway(userId, id);
      if (result.error) return json(result);
      return redirectBack();
    }
    case "exclude": {
      const winnerPubkey = formData.get("winnerPubkey");
      if (typeof winnerPubkey !== "string") {
        return json(
          { winners: [], error: "Missing winnerPubkey" },
          { status: 400 }
        );
      }
      const result = await excludeWinnerAndRedraw(userId, id, winnerPubkey);
      if (result.error) return json(result);
      return redirectBack();
    }
    case "lock": {
      const lockHashRaw = formData.get("lockConfigHash");
      const result = await lockGiveaway(userId, id, {
        lockConfigHash:
          typeof lockHashRaw === "string" && lockHashRaw.trim() !== ""
            ? lockHashRaw.trim()
            : undefined,
      });
      if (result.error) return json(result);
      return redirectBack();
    }
    case "createFinalizationInvoice": {
      const hashRaw = formData.get("lockConfigHash");
      if (typeof hashRaw !== "string" || !hashRaw.trim()) {
        return json({ error: "Missing lock preview state" }, { status: 400 });
      }
      try {
        const inv = await createGiveawayFinalizationInvoice({
          giveawayId: id,
          userId,
          lockConfigHash: hashRaw.trim(),
        });
        return json({
          success: true,
          invoice: inv.invoice,
          paymentHash: inv.paymentHash,
          amount: inv.amount,
          paymentId: inv.paymentId,
          expiresAt: inv.expiresAt.toISOString(),
          lockConfigHash: inv.lockConfigHash,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create invoice";
        const status =
          error instanceof ExternalServiceError ? error.statusCode : 500;
        return json({ error: message }, { status });
      }
    }
    case "logActivity": {
      const typeRaw = formData.get("activityType");
      if (typeRaw !== "csv_exported" && typeRaw !== "proof_summary_copied") {
        return json({ error: "Invalid activity type" }, { status: 400 });
      }
      const result = await appendGiveawayAuditActivity(userId, id, typeRaw);
      if (!result.success) {
        return json(result, { status: 400 });
      }
      return redirectBack();
    }
    case "cancel": {
      const result = await cancelGiveaway(userId, id);
      if (result.error) return json(result);
      return redirectBack();
    }
    case "delete": {
      const result = await deleteGiveaway(userId, id);
      if (result.error) return json(result);
      return redirect("/dashboard/giveaway");
    }
    case "runBatchPayout": {
      const spendCapSatsRaw = String(formData.get("spendCapSats") ?? "").trim();
      const spendCapSats =
        spendCapSatsRaw !== "" ? Number(spendCapSatsRaw) : undefined;
      const capOpt = Number.isFinite(spendCapSats)
        ? Math.max(0, Math.floor(spendCapSats as number))
        : undefined;
      const stepRaw = formData.get("stepIndex");
      const hasStep = stepRaw != null && String(stepRaw).trim() !== "";
      if (hasStep) {
        const stepIndex = Math.floor(Number(stepRaw));
        if (!Number.isFinite(stepIndex) || stepIndex < 0) {
          return json(
            { success: false, error: "Invalid step index" },
            { status: 400 }
          );
        }
        const result = await runGiveawayPayoutBatchStepWithNwc(
          userId,
          id,
          stepIndex,
          {
            trigger: "manual_trigger",
            spendCapSats: capOpt,
          }
        );
        if (!result.success) return json(result, { status: 400 });
        return json(result);
      }
      const result = await runGiveawayPayoutBatchWithNwc(userId, id, {
        trigger: "manual_trigger",
        spendCapSats: capOpt,
      });
      if (!result.success) return json(result, { status: 400 });
      return redirectBack();
    }
    case "markPaidOut": {
      const overrideRaw = formData.get("completeOverrideReason");
      const result = await markGiveawayPaidOut(userId, id, {
        completeOverrideReason:
          typeof overrideRaw === "string" ? overrideRaw : undefined,
      });
      if (result.error) return json(result, { status: 400 });
      return redirectBack();
    }
    case "resetDraft": {
      const result = await resetGiveawayToDraft(userId, id);
      if (!result.success) return json(result, { status: 400 });
      return redirectBack();
    }
    case "updatePayout": {
      const winnerPubkey = formData.get("winnerPubkey");
      const payoutStatus = formData.get("payoutStatus");
      const noteRaw = formData.get("payoutNote");
      if (
        typeof winnerPubkey !== "string" ||
        typeof payoutStatus !== "string"
      ) {
        return json(
          { error: "Missing winner or payout status" },
          { status: 400 }
        );
      }
      const allowed = ["pending", "sent", "failed", "marked_paid"] as const;
      if (!allowed.includes(payoutStatus as (typeof allowed)[number])) {
        return json({ error: "Invalid payout status" }, { status: 400 });
      }
      const result = await setGiveawayWinnerPayoutStatus(
        userId,
        id,
        winnerPubkey,
        payoutStatus as (typeof allowed)[number],
        typeof noteRaw === "string" ? noteRaw : null
      );
      if (!result.success) return json(result, { status: 400 });
      return redirectBack();
    }
    case "updatePayoutSettings": {
      const mode = String(formData.get("payoutWalletMode") ?? "manual");
      const payoutWalletMode =
        mode === "nwc_creator" ? "nwc_creator" : "manual";
      const autoRaw = String(formData.get("payoutAutoRunEnabled") ?? "");
      const payoutAutoRunEnabled = autoRaw === "on" || autoRaw === "true";
      const capRaw = String(
        formData.get("payoutAutoRunSpendCapSats") ?? ""
      ).trim();
      const cap =
        capRaw !== "" && Number.isFinite(Number(capRaw))
          ? Math.max(0, Math.floor(Number(capRaw)))
          : null;
      const result = await updateGiveawayPayoutSettings(userId, id, {
        payoutWalletMode,
        payoutAutoRunEnabled,
        payoutAutoRunSpendCapSats: cap,
      });
      if (!result.success) return json(result, { status: 400 });
      return redirectBack();
    }
    case "savePreset": {
      const name = formData.get("presetName");
      if (typeof name !== "string" || !name.trim()) {
        return json({ error: "Preset name required" }, { status: 400 });
      }
      const g = await getGiveawayById(id, userId);
      if (!g) return json({ error: "Giveaway not found" }, { status: 404 });
      await createGiveawayPreset(userId, {
        name: name.trim(),
        scopeType: g.scopeType,
        scopeReference: g.scopeReference as Record<string, unknown>,
        engagementTypes: g.engagementTypes as string[],
        winnerCount: g.winnerCount,
        engagementConfig: g.engagementConfig as Record<
          string,
          { winnerCount: number; satsPerWinner: number }
        > | null,
        selectionMode: g.selectionMode,
        engagementWeights: g.engagementWeights as Record<string, number> | null,
        filters: g.filters as Record<string, unknown> | null,
      });
      return redirectBack();
    }
    case "update": {
      const nameRaw = formData.get("name");
      const winnerCountRaw = formData.get("winnerCount");
      const engagementTypesRaw = formData.getAll("engagementTypes");
      const selectionModeRaw = formData.get("selectionMode");
      const result = await updateGiveaway(userId, id, {
        name: typeof nameRaw === "string" ? nameRaw : undefined,
        winnerCount:
          winnerCountRaw != null && winnerCountRaw !== ""
            ? parseInt(String(winnerCountRaw), 10)
            : undefined,
        engagementTypes:
          Array.isArray(engagementTypesRaw) && engagementTypesRaw.length > 0
            ? (engagementTypesRaw as string[])
            : undefined,
        selectionMode:
          selectionModeRaw === "UNIQUE_USER" ||
          selectionModeRaw === "WEIGHTED_BY_ENGAGEMENT"
            ? selectionModeRaw
            : undefined,
      });
      if (!result.success) return json(result, { status: 400 });
      return redirectBack();
    }
    default:
      return json({ error: "Unknown intent" }, { status: 400 });
  }
}

type GiveawayDetailLoaderPayload = Awaited<
  ReturnType<typeof loadGiveawayDetailData>
>;

function DashboardGiveawayDetailPageInner() {
  const {
    nwc,
    giveaway,
    giveawaysLimits,
    winnerProfiles,
    planType,
    planDisplayName,
    finalizationQuote,
    receiptSummaryLine,
    publicSummaryText,
  } = useDeferredRouteLoaderData() as GiveawayDetailLoaderPayload;
  return (
    <GiveawayDetailPage
      nwc={nwc}
      winnerProfiles={winnerProfiles}
      planType={planType}
      planDisplayName={planDisplayName}
      finalizationQuote={finalizationQuote}
      receiptSummaryLine={receiptSummaryLine}
      publicSummaryText={publicSummaryText}
      giveaway={{
        id: giveaway.id,
        name: giveaway.name ?? null,
        status: giveaway.status,
        statusLabel: giveaway.statusLabel,
        scopeSummaryLabel: giveaway.scopeSummaryLabel,
        scopeType: giveaway.scopeType,
        winnerCount: giveaway.winnerCount,
        winnerSnapshot: giveaway.winnerSnapshot as GiveawayWinnerEntry[] | null,
        lockedAt: giveaway.lockedAt,
        createdAt: giveaway.createdAt,
        updatedAt: giveaway.updatedAt,
        engagementConfig: giveaway.engagementConfig ?? null,
        payoutState: giveaway.payoutState,
        payoutProgress: giveaway.payoutProgress,
        lastPreviewMeta: giveaway.lastPreviewMeta,
        rerollCount: giveaway.rerollCount,
        excludedPubkeys: giveaway.excludedPubkeys,
        activityLog: giveaway.activityLog,
        plannedPayoutSats: giveaway.plannedPayoutSats ?? null,
        finalizationFeeSats: giveaway.finalizationFeeSats ?? null,
        finalizationFeeRateBps: giveaway.finalizationFeeRateBps ?? null,
        finalizationFeeStatus: giveaway.finalizationFeeStatus ?? null,
        planAtFinalization: giveaway.planAtFinalization ?? null,
        ...("scopeReference" in giveaway && {
          scopeReference: giveaway.scopeReference,
          engagementTypes: giveaway.engagementTypes,
          selectionMode: giveaway.selectionMode,
          engagementWeights: giveaway.engagementWeights,
          filters: giveaway.filters,
        }),
      }}
      canUsePresets={giveawaysLimits.canUsePresets}
      maxWinnerCount={giveawaysLimits.maxWinnerCount}
    />
  );
}

export default function DashboardGiveawayDetailPage() {
  const params = useParams();
  const id = params["id"] ?? "";
  const { giveawayDetail } = useLoaderData() as {
    giveawayDetail: Promise<GiveawayDetailLoaderPayload>;
  };
  const retryTo =
    id !== "" ? `/dashboard/giveaway/detail/${id}` : "/dashboard/giveaway";

  return (
    <Suspense
      fallback={
        <DeferredListPageSkeleton
          variant="detail"
          title="Giveaway"
          subtitle="Winners, payouts, and activity"
        />
      }
    >
      <Await
        resolve={giveawayDetail}
        errorElement={<DeferredRouteAwaitError retryTo={retryTo} />}
      >
        {(loaded) => (
          <DeferredRouteLoaderProvider value={loaded}>
            <DashboardGiveawayDetailPageInner />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
