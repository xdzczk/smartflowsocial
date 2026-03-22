import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import type { GiveawayWinnerEntry } from "~/features/giveaway";
import {
  GiveawayDetailPage,
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
  updateGiveaway,
} from "~/features/giveaway";
import {
  formatScopeSummaryLabel,
  formatStatusLabel,
  resolveGiveawayQueueName,
} from "~/features/giveaway/giveaway-display.server";
import { getWinnerProfiles } from "~/features/giveaway/giveaway-loader.server";
import {
  countPayoutCompleted,
  normalizePayoutState,
  totalSatsBudgetFromSnapshot,
  totalSatsPaidFromState,
} from "~/features/giveaway/giveaway-payout.server";
import { createGiveawayPreset } from "~/features/giveaway/giveaway-presets.server";
import {
  getSubscriptionData,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  getGiveawayPlanLimits,
  getUserPlanType,
} from "~/features/payments/types";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "giveaways");

  const id = params["id"];
  if (!id) {
    throw new Response("Not found", { status: 404 });
  }

  const [giveaway, subscriptionData] = await Promise.all([
    getGiveawayById(id, userId),
    getSubscriptionData(userId),
  ]);
  if (!giveaway) {
    throw new Response("Not found", { status: 404 });
  }

  const limits = getGiveawayPlanLimits(
    getUserPlanType(subscriptionData.currentSubscription)
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

  return json({
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
      payoutProgress,
      lastPreviewMeta: giveaway.lastPreviewMeta,
      rerollCount: giveaway.rerollCount,
      excludedPubkeys: giveaway.excludedPubkeys,
      activityLog: giveaway.activityLog,
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
      const result = await lockGiveaway(userId, id);
      if (result.error) return json(result);
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

export default function DashboardGiveawayDetailPage() {
  const { giveaway, giveawaysLimits, winnerProfiles } =
    useLoaderData<typeof loader>();
  return (
    <GiveawayDetailPage
      winnerProfiles={winnerProfiles}
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
/* eslint-enable sonarjs/cognitive-complexity */
