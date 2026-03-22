import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import { GiveawayNewBuilder } from "~/features/giveaway";
import { createGiveaway } from "~/features/giveaway/giveaway-actions.server";
import { getRecentPostsForGiveawaySelector } from "~/features/giveaway/giveaway-new.server";
import {
  getGiveawayPresetsByUser,
  getGiveawayPresetById,
  resolvePresetQueue,
  touchGiveawayPresetLastUsed,
} from "~/features/giveaway/giveaway-presets.server";
import {
  getGiveawayPlanLimits,
  getPlanDisplayName,
  getUserPlanType,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { getQueueTypes } from "~/features/user";

function parseScopeReference(
  formData: FormData,
  scopeTypeResolved: "PERIOD" | "SINGLE_POST" | "FOLLOWERS" | "FOLLOWING"
):
  | { scopeReference: Record<string, unknown> }
  | { error: string; status: 400 } {
  if (scopeTypeResolved === "PERIOD") {
    const queueId = formData.get("queueId");
    const queueIdTrimmed =
      typeof queueId === "string" && queueId.trim() ? queueId.trim() : "";
    const periodMode = formData.get("periodMode");
    if (periodMode === "custom") {
      const fromRaw = formData.get("periodFrom");
      const toRaw = formData.get("periodTo");
      if (
        typeof fromRaw !== "string" ||
        typeof toRaw !== "string" ||
        !fromRaw.trim() ||
        !toRaw.trim()
      ) {
        return {
          error: "Choose a start and end date for the custom period",
          status: 400,
        };
      }
      const fromD = new Date(fromRaw);
      const toD = new Date(toRaw);
      if (
        Number.isNaN(fromD.getTime()) ||
        Number.isNaN(toD.getTime()) ||
        fromD > toD
      ) {
        return { error: "Invalid date range", status: 400 };
      }
      const scopeReference: Record<string, unknown> = {
        from: fromD.toISOString(),
        to: toD.toISOString(),
      };
      if (queueIdTrimmed) scopeReference["queueId"] = queueIdTrimmed;
      return { scopeReference };
    }
    const daysRaw = formData.get("periodDays");
    const days =
      typeof daysRaw === "string" && /^\d+$/.test(daysRaw)
        ? Math.min(365, Math.max(1, parseInt(daysRaw, 10)))
        : 7;
    const scopeReference: Record<string, unknown> = { days };
    if (queueIdTrimmed) scopeReference["queueId"] = queueIdTrimmed;
    return { scopeReference };
  }
  if (scopeTypeResolved === "SINGLE_POST") {
    const postId = formData.get("postId");
    const postIdTrimmed =
      typeof postId === "string" && postId.trim() ? postId.trim() : "";
    if (!postIdTrimmed) {
      return {
        error: "Please select a post for single-post giveaway",
        status: 400,
      };
    }
    return { scopeReference: { postId: postIdTrimmed } };
  }
  return { scopeReference: {} };
}

/** Split total winners across engagement types as evenly as possible. */
function distributeWinnersAcrossTypes(
  total: number,
  types: string[]
): Record<string, number> {
  const n = types.length;
  if (n === 0 || total <= 0) return {};
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const t = types[i];
    if (!t) continue;
    const w = Math.floor(total / n) + (i < total % n ? 1 : 0);
    if (w > 0) out[t] = w;
  }
  return out;
}

const ENGAGEMENT_TYPE_ALLOWLIST = [
  "REACTION",
  "REPOST",
  "COMMENT",
  "ZAP",
] as const;

type EngagementWinnersResult =
  | {
      engagementTypes: string[];
      winnerCount: number;
      selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
      engagementConfig?: Record<
        string,
        { winnerCount: number; satsPerWinner: number }
      >;
    }
  | { error: string; status: 400 };

function parseAdvancedEngagementConfig(
  formData: FormData,
  engagementTypes: string[]
): Record<string, { winnerCount: number; satsPerWinner: number }> {
  const engagementConfig: Record<
    string,
    { winnerCount: number; satsPerWinner: number }
  > = {};
  for (const type of ENGAGEMENT_TYPE_ALLOWLIST) {
    const wRaw = formData.get(`engagementWinners_${type}`);
    const sRaw = formData.get(`engagementSats_${type}`);
    const w =
      typeof wRaw === "string" && /^\d+$/.test(wRaw)
        ? Math.max(0, parseInt(wRaw, 10))
        : 0;
    const sats =
      typeof sRaw === "string" && /^\d+$/.test(sRaw)
        ? Math.max(0, parseInt(sRaw, 10))
        : 0;
    if (w > 0 && engagementTypes.includes(type)) {
      engagementConfig[type] = { winnerCount: w, satsPerWinner: sats };
    }
  }
  return engagementConfig;
}

function parseSimpleSatsEngagementResult(
  winnerCount: number,
  engagementTypes: string[],
  simpleSats: number,
  selectionModeResolved: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT"
): EngagementWinnersResult {
  const parts = distributeWinnersAcrossTypes(winnerCount, engagementTypes);
  const engagementConfig: Record<
    string,
    { winnerCount: number; satsPerWinner: number }
  > = {};
  for (const t of engagementTypes) {
    const w = parts[t] ?? 0;
    if (w > 0) {
      engagementConfig[t] = {
        winnerCount: w,
        satsPerWinner: simpleSats,
      };
    }
  }
  const sum = Object.values(engagementConfig).reduce(
    (a, c) => a + c.winnerCount,
    0
  );
  return {
    engagementTypes,
    winnerCount: sum > 0 ? sum : winnerCount,
    selectionMode: selectionModeResolved,
    ...(Object.keys(engagementConfig).length > 0 ? { engagementConfig } : {}),
  };
}

function parseEngagementAndWinners(
  formData: FormData
): EngagementWinnersResult {
  const engagementTypesRaw = formData.getAll("engagementTypes");
  const engagementTypes =
    Array.isArray(engagementTypesRaw) && engagementTypesRaw.length > 0
      ? engagementTypesRaw
          .filter((v): v is string => typeof v === "string")
          .filter((v) =>
            ENGAGEMENT_TYPE_ALLOWLIST.includes(
              v as (typeof ENGAGEMENT_TYPE_ALLOWLIST)[number]
            )
          )
      : (["REACTION", "REPOST", "COMMENT", "ZAP"] as string[]);
  if (engagementTypes.length === 0) {
    return { error: "Select at least one engagement type", status: 400 };
  }
  const winnerCountRaw = formData.get("winnerCount");
  const winnerCount =
    typeof winnerCountRaw === "string" && /^\d+$/.test(winnerCountRaw)
      ? Math.max(1, parseInt(winnerCountRaw, 10))
      : 3;
  const selectionMode = formData.get("selectionMode");
  const selectionModeResolved =
    selectionMode === "WEIGHTED_BY_ENGAGEMENT"
      ? "WEIGHTED_BY_ENGAGEMENT"
      : "UNIQUE_USER";

  const rewardMode = formData.get("rewardMode");
  const simpleSatsRaw = formData.get("simpleSatsPerWinner");
  const simpleSats =
    typeof simpleSatsRaw === "string" && /^\d+$/.test(simpleSatsRaw)
      ? Math.max(0, parseInt(simpleSatsRaw, 10))
      : 0;

  if (rewardMode === "advanced") {
    const engagementConfig = parseAdvancedEngagementConfig(
      formData,
      engagementTypes
    );
    return {
      engagementTypes,
      winnerCount,
      selectionMode: selectionModeResolved,
      ...(Object.keys(engagementConfig).length > 0 ? { engagementConfig } : {}),
    };
  }

  if (simpleSats > 0) {
    return parseSimpleSatsEngagementResult(
      winnerCount,
      engagementTypes,
      simpleSats,
      selectionModeResolved
    );
  }

  return {
    engagementTypes,
    winnerCount,
    selectionMode: selectionModeResolved,
  };
}

function parseFilters(formData: FormData): Record<string, unknown> | undefined {
  const excludeMuted =
    formData.get("excludeMuted") === "on" ||
    formData.get("excludeMuted") === "true";
  const excludeBlocked =
    formData.get("excludeBlocked") === "on" ||
    formData.get("excludeBlocked") === "true";
  const excludeLowTrust =
    formData.get("excludeLowTrust") === "on" ||
    formData.get("excludeLowTrust") === "true";
  const excludeNonFollowers =
    formData.get("excludeNonFollowers") === "on" ||
    formData.get("excludeNonFollowers") === "true";
  const minAgeRaw = formData.get("minAccountAgeDays");
  const minFollowersRaw = formData.get("minFollowers");
  let minAccountAgeDays: number | undefined;
  if (typeof minAgeRaw === "string" && /^\d+$/.test(minAgeRaw)) {
    minAccountAgeDays = Math.min(3650, Math.max(0, parseInt(minAgeRaw, 10)));
  }
  let minFollowers: number | undefined;
  if (typeof minFollowersRaw === "string" && /^\d+$/.test(minFollowersRaw)) {
    minFollowers = Math.min(
      1_000_000,
      Math.max(0, parseInt(minFollowersRaw, 10))
    );
  }
  const out: Record<string, unknown> = {};
  if (excludeMuted) out["excludeMuted"] = true;
  if (excludeBlocked) out["excludeBlocked"] = true;
  if (excludeLowTrust) out["excludeLowTrust"] = true;
  if (excludeNonFollowers) out["excludeNonFollowers"] = true;
  if (minAccountAgeDays !== undefined)
    out["minAccountAgeDays"] = minAccountAgeDays;
  if (minFollowers !== undefined) out["minFollowers"] = minFollowers;
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  const subscriptionData = await requireFeatureAccess(userId, "giveaways");
  const planType = getUserPlanType(subscriptionData.currentSubscription);
  const planLimits = getGiveawayPlanLimits(planType);
  const planDisplayName = getPlanDisplayName(
    subscriptionData.currentSubscription
  );

  const [presets, queueTypes, recentPosts] = await Promise.all([
    getGiveawayPresetsByUser(userId),
    getQueueTypes(userId),
    getRecentPostsForGiveawaySelector(userId),
  ]);

  return json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      scopeType: p.scopeType,
      winnerCount: p.winnerCount,
    })),
    queueTypes: queueTypes.map((q) => ({ id: q.id, name: q.name })),
    recentPosts,
    planLimits: {
      maxWinnerCount: planLimits.maxWinnerCount,
      canUseQueueScope: planLimits.canUseQueueScope,
      canUsePresets: planLimits.canUsePresets,
    },
    planType,
    planDisplayName,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "giveaways");

  if (request.method !== "POST") {
    return redirect("/dashboard/giveaway");
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const presetId = formData.get("presetId");

  if (intent === "createFromPreset" && typeof presetId === "string") {
    const preset = await getGiveawayPresetById(userId, presetId);
    if (!preset) {
      return json({ error: "Preset not found" }, { status: 404 });
    }
    const scopeRef = preset.scopeReference as Record<string, unknown>;
    if (preset.scopeType === "QUEUE" && scopeRef["queueId"]) {
      await resolvePresetQueue(userId, scopeRef);
      // If queue was deleted, create anyway; getPostsInScope will return [] until user fixes scope
    }
    const giveaway = await createGiveaway(userId, {
      name: preset.name,
      scopeType: preset.scopeType,
      scopeReference: scopeRef,
      engagementTypes: preset.engagementTypes as string[],
      winnerCount: preset.winnerCount,
      engagementConfig: preset.engagementConfig as Record<
        string,
        { winnerCount: number; satsPerWinner: number }
      > | null,
      selectionMode: preset.selectionMode,
      engagementWeights: preset.engagementWeights as Record<
        string,
        number
      > | null,
      filters: preset.filters as Record<string, unknown> | null,
    });
    await touchGiveawayPresetLastUsed(userId, presetId);
    return redirect(`/dashboard/giveaway/detail/${giveaway.id}`);
  }

  if (intent !== "create") {
    return redirect("/dashboard/giveaway");
  }

  const name = formData.get("name");
  const scopeType = formData.get("scopeType") as
    | "PERIOD"
    | "SINGLE_POST"
    | "FOLLOWERS"
    | "FOLLOWING"
    | null;
  const scopeTypeResolved =
    scopeType === "SINGLE_POST"
      ? "SINGLE_POST"
      : scopeType === "FOLLOWERS"
        ? "FOLLOWERS"
        : scopeType === "FOLLOWING"
          ? "FOLLOWING"
          : "PERIOD";

  const scopeResult = parseScopeReference(formData, scopeTypeResolved);
  if ("error" in scopeResult) {
    return json({ error: scopeResult.error }, { status: scopeResult.status });
  }
  const { scopeReference } = scopeResult;

  const engagementResult = parseEngagementAndWinners(formData);
  if ("error" in engagementResult) {
    return json(
      { error: engagementResult.error },
      { status: engagementResult.status }
    );
  }
  const {
    engagementTypes,
    winnerCount,
    selectionMode: selectionModeResolved,
    engagementConfig,
  } = engagementResult;

  const filters = parseFilters(formData);

  try {
    const giveaway = await createGiveaway(userId, {
      name: typeof name === "string" ? name.trim() || undefined : undefined,
      scopeType: scopeTypeResolved,
      scopeReference,
      engagementTypes,
      winnerCount,
      engagementConfig: engagementConfig ?? undefined,
      selectionMode: selectionModeResolved,
      filters: filters ?? undefined,
    });
    return redirect(`/dashboard/giveaway/detail/${giveaway.id}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create giveaway";
    return json({ error: message }, { status: 400 });
  }
}

function pickActionError(actionData: unknown): string | undefined {
  if (!actionData || typeof actionData !== "object") return undefined;
  if (!("error" in actionData)) return undefined;
  const err = (actionData as { error: unknown }).error;
  return typeof err === "string" ? err : undefined;
}

export default function DashboardGiveawayNewPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const actionError = pickActionError(actionData);
  return <GiveawayNewBuilder {...data} actionError={actionError} />;
}
