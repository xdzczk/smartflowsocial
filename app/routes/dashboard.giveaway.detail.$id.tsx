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
  updateGiveaway,
} from "~/features/giveaway";
import {
  formatScopeSummaryLabel,
  formatStatusLabel,
  resolveGiveawayQueueName,
} from "~/features/giveaway/giveaway-display.server";
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
  const queueName =
    giveaway.scopeType === "QUEUE"
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
      const result = await markGiveawayPaidOut(userId, id);
      if (result.error) return json(result);
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
  const { giveaway, giveawaysLimits } = useLoaderData<typeof loader>();
  return (
    <GiveawayDetailPage
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
        ...("scopeReference" in giveaway && {
          scopeReference: giveaway.scopeReference,
          engagementTypes: giveaway.engagementTypes,
          selectionMode: giveaway.selectionMode,
          engagementWeights: giveaway.engagementWeights,
          filters: giveaway.filters,
        }),
      }}
      canUsePresets={giveawaysLimits.canUsePresets}
    />
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
