import type { LoaderFunctionArgs, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { getUserSubscription } from "~/features/payments/data";
import {
  getGiveawayPlanLimits,
  getPlanDisplayName,
  getUserPlanType,
} from "~/features/payments/types";
import type { UserSubscription } from "~/features/payments/types";
import { getRecentPublishedPosts } from "~/features/posts/server";
import { loadNewPostData } from "~/features/posts/server/composer";
import { getUserById } from "~/features/user";
import { featureFlags } from "~/lib/feature-flags.server";

import { getContestPresetById } from "./contest-presets.server";
import { findContestCreationDraftByUserId } from "./repositories/contest-creation-draft.server";
import type { ContestRankReward, ContestRankingMetric } from "./types";

/**
 * Remix loader for `/dashboard/contests/new`.
 */
export async function contestNewLoader({ request }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const [composerLoader, rawPosts, subscription, userRow, savedContestDraft] =
    await Promise.all([
      loadNewPostData(userId, null, null),
      getRecentPublishedPosts({ userId, days: 90 }),
      getUserSubscription(userId),
      getUserById(userId),
      findContestCreationDraftByUserId(userId),
    ]);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const planLabel = getPlanDisplayName(subscription as UserSubscription | null);
  const canUsePresets = getGiveawayPlanLimits(planType).canUsePresets;

  const url = new URL(request.url);
  const presetParam = url.searchParams.get("preset");
  let presetDefaults: null | {
    id: string;
    title: string | null;
    rankingMetric: ContestRankingMetric;
    prizeMode: "EQUAL" | "RANKED";
    winnerCount: number;
    equalRewardSats: number;
    rankRewards: ContestRankReward[] | null;
    fairnessConfig: Record<string, unknown> | null;
  } = null;
  if (presetParam?.trim() && canUsePresets) {
    const p = await getContestPresetById(userId, presetParam.trim());
    if (p) {
      presetDefaults = {
        id: p.id,
        title: p.title,
        rankingMetric: p.rankingMetric,
        prizeMode: p.prizeMode,
        winnerCount: p.winnerCount,
        equalRewardSats: p.equalRewardSats ?? 0,
        rankRewards: (p.rankRewards as ContestRankReward[] | null) ?? null,
        fairnessConfig:
          (p.fairnessConfig as Record<string, unknown> | null) ?? null,
      };
    }
  }

  const posts = rawPosts
    .filter((p) => p.nostrEventId != null && p.nostrEventId.trim() !== "")
    .slice(0, 50)
    .map((p) => ({
      id: p.id,
      caption: p.caption ?? null,
      publishedAt:
        p.publishedAt instanceof Date ? p.publishedAt.toISOString() : "",
      fileUrl: p.fileUrl,
      postType: p.postType,
    }));

  return json({
    ...composerLoader,
    posts,
    planType,
    planLabel,
    presetDefaults,
    canUsePresets,
    userTimezone: userRow?.timezone ?? "UTC",
    savedContestDraft: savedContestDraft?.payload ?? null,
  });
}

export type ContestNewLoaderData = SerializeFrom<typeof contestNewLoader>;
