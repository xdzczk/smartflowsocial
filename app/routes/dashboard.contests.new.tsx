import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
} from "@remix-run/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  ActionRailActions,
  RAIL_SECONDARY_ACTION,
} from "~/components/action-rail";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { requireUserId } from "~/features/auth";
import {
  CampaignSectionHeader,
  campaignFieldClassNames,
  ChoiceTileGroup,
  CompactStatusMessage,
  PublishedPostPickerGrid,
  RewardSummaryLine,
  SourcePostModule,
} from "~/features/campaign-ui";
import {
  ContestBuilderSummaryRail,
  ContestEmbeddedComposer,
  createContest,
  findContestCreationDraftByUserId,
  getContestPresetById,
  launchContest,
  touchContestPresetLastUsed,
  upsertContestCreationDraftPayload,
  upsertContestLaunchOrchestration,
  type ContestRankReward,
  type ContestReadinessItem,
} from "~/features/contest";
import { trackContestCreationEvent } from "~/features/contest/contest-analytics.client";
import { contestCopy } from "~/features/contest/contest-copy";
import { getContestLaunchCtaConfig } from "~/features/contest/contest-launch-cta-config";
import type { ContestRankingMetric } from "~/features/contest/types";
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
import type { ContestEmbedPublishPayload } from "~/features/posts/composer";
import { getPostById, getRecentPublishedPosts } from "~/features/posts/server";
import { loadNewPostData } from "~/features/posts/server/composer";
import { getUserById } from "~/features/user";
import { featureFlags } from "~/lib/feature-flags.server";
import { getNowForDateTimeLocal } from "~/lib/temporal";
import { cn } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
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

function parseContestFairness(formData: FormData) {
  return {
    excludeMuted: formData.get("excludeMuted") === "on",
    excludeBlocked: formData.get("excludeBlocked") === "on",
    excludeLowTrust: formData.get("excludeLowTrust") === "on",
    excludeNonFollowers: formData.get("excludeNonFollowers") === "on",
    minAccountAgeDays:
      parseInt(String(formData.get("minAccountAgeDays") ?? "0"), 10) ||
      undefined,
    minFollowers:
      parseInt(String(formData.get("minFollowers") ?? "0"), 10) || undefined,
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- Action branches: draft save vs launch vs presets
export async function action({ request }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "launch");

  if (intent === "save-draft") {
    const raw = String(formData.get("draftPayload") ?? "{}");
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid draft payload" }, { status: 400 });
    }
    await upsertContestCreationDraftPayload(userId, payload);
    return json({ ok: true, draftSaved: true });
  }

  const title = String(formData.get("title") ?? "");
  const sourceMode = String(formData.get("sourceMode") ?? "existing") as
    | "create"
    | "existing";
  const launchMode = String(formData.get("launchMode") ?? "now") as
    | "now"
    | "schedule";
  const scheduledActivationRaw = String(
    formData.get("scheduledActivationFor") ?? ""
  ).trim();
  const sourcePostId = String(formData.get("sourcePostId") ?? "").trim();
  const rankingMetric = String(
    formData.get("rankingMetric") ?? "ZAPS"
  ) as ContestRankingMetric;
  const contestEndAtRaw = String(formData.get("contestEndAt") ?? "");
  const prizeMode = String(formData.get("prizeMode") ?? "EQUAL") as
    | "EQUAL"
    | "RANKED";
  const winnerCount = Math.max(
    1,
    parseInt(String(formData.get("winnerCount") ?? "1"), 10) || 1
  );
  const equalRewardSats = Math.max(
    0,
    parseInt(String(formData.get("equalRewardSats") ?? "0"), 10) || 0
  );

  const rankRewards: Array<{ rank: number; sats: number }> = [];
  for (let rank = 1; rank <= winnerCount; rank += 1) {
    const sats =
      parseInt(String(formData.get(`rankReward_${rank}`) ?? "0"), 10) || 0;
    rankRewards.push({ rank, sats });
  }

  if (prizeMode === "RANKED" && !rankRewards.some((r) => r.sats > 0)) {
    return json(
      { error: "Rank-based mode requires at least one prize amount above 0." },
      { status: 400 }
    );
  }

  const contestEndAt = new Date(contestEndAtRaw);
  if (!Number.isFinite(contestEndAt.getTime())) {
    return json(
      { error: "Valid contest end date is required" },
      { status: 400 }
    );
  }

  const fairnessConfig = parseContestFairness(formData);
  const scheduledActivationAt =
    scheduledActivationRaw.length > 0 ? new Date(scheduledActivationRaw) : null;
  if (launchMode === "schedule") {
    if (
      !scheduledActivationAt ||
      !Number.isFinite(scheduledActivationAt.getTime())
    ) {
      return json(
        { error: "Choose a valid future date and time for scheduling." },
        { status: 400 }
      );
    }
    if (scheduledActivationAt.getTime() <= Date.now()) {
      return json(
        { error: "Scheduled activation must be in the future." },
        { status: 400 }
      );
    }
  }

  if (!sourcePostId) {
    return json(
      {
        error:
          sourceMode === "create"
            ? "Publish or schedule the source post from the contest actions first."
            : "Select the published post to use as the contest source.",
      },
      { status: 400 }
    );
  }

  const sourcePost = await getPostById({ id: sourcePostId, userId });
  if (!sourcePost) {
    return json({ error: "Source post not found." }, { status: 400 });
  }

  const sourceNoteId = sourcePost.nostrEventId?.trim() ?? "";
  const hasPublishedNote = sourceNoteId.length > 0;

  if (sourceMode === "existing") {
    if (!hasPublishedNote) {
      return json(
        {
          error:
            "Selected post must be published with a Nostr note id before launching.",
        },
        { status: 400 }
      );
    }
  }

  if (sourceMode === "create" && launchMode === "now" && !hasPublishedNote) {
    return json(
      {
        error:
          "Publish the source post first (use the primary contest action), then submit again.",
      },
      { status: 400 }
    );
  }

  const baseContestInput = {
    title,
    rankingMetric,
    contestEndAt,
    prizeMode,
    winnerCount,
    equalRewardSats: prizeMode === "EQUAL" ? equalRewardSats : null,
    rankRewards: prizeMode === "RANKED" ? rankRewards : null,
    fairnessConfig,
  };

  const appliedPresetId = String(formData.get("appliedPresetId") ?? "").trim();
  if (appliedPresetId) {
    try {
      await touchContestPresetLastUsed(userId, appliedPresetId);
    } catch {
      // ignore
    }
  }

  // --- Existing published post ---
  if (sourceMode === "existing") {
    if (launchMode === "now") {
      const contest = await createContest(userId, {
        ...baseContestInput,
        sourceNoteId,
        sourcePostId: sourcePost.id,
      });
      const launched = await launchContest(userId, contest.id);
      if (!launched.success) {
        return json(
          { error: launched.error ?? "Contest created but launch failed." },
          { status: 400 }
        );
      }
      return redirect(`/dashboard/contests/detail/${contest.id}`);
    }

    const contest = await createContest(userId, {
      ...baseContestInput,
      sourceNoteId,
      sourcePostId: sourcePost.id,
      status: "SCHEDULED_LAUNCH",
    });
    await upsertContestLaunchOrchestration({
      userId,
      contestId: contest.id,
      sourceMode: "existing_post",
      launchMode: "schedule",
      scheduledFor: scheduledActivationAt,
      existingSourcePostId: sourcePost.id,
      sourcePostId: null,
      sourcePostPublishStatus: "not_needed",
      contestActivationStatus: "scheduled",
    });
    return redirect(`/dashboard/contests/detail/${contest.id}`);
  }

  // --- New contest post (composer) ---
  if (launchMode === "now") {
    const contest = await createContest(userId, {
      ...baseContestInput,
      sourceNoteId,
      sourcePostId: sourcePost.id,
    });
    const launched = await launchContest(userId, contest.id);
    if (!launched.success) {
      return json(
        { error: launched.error ?? "Contest created but launch failed." },
        { status: 400 }
      );
    }
    return redirect(`/dashboard/contests/detail/${contest.id}`);
  }

  const contest = await createContest(userId, {
    ...baseContestInput,
    sourceNoteId: hasPublishedNote ? sourceNoteId : null,
    sourcePostId: sourcePost.id,
    status: "SCHEDULED_LAUNCH",
  });

  await upsertContestLaunchOrchestration({
    userId,
    contestId: contest.id,
    sourceMode: "new_post",
    launchMode: "schedule",
    scheduledFor: scheduledActivationAt,
    existingSourcePostId: null,
    sourcePostId: sourcePost.id,
    sourcePostPublishStatus: hasPublishedNote ? "published" : "scheduled",
    contestActivationStatus: "scheduled",
  });

  return redirect(`/dashboard/contests/detail/${contest.id}`);
}

function formatPostOptionLabel(p: {
  caption: string | null;
  id: string;
  publishedAt: string;
}): string {
  const caption = p.caption?.trim()
    ? `${p.caption.slice(0, 56)}${p.caption.length > 56 ? "…" : ""}`
    : "No caption";
  const date = p.publishedAt.slice(0, 10);
  return `${caption} · ${date}`;
}

type ContestNewLoaderData = SerializeFrom<typeof loader>;

function rankRewardsInitialFromPreset(
  p: NonNullable<ContestNewLoaderData["presetDefaults"]>
): number[] {
  const n = p.winnerCount;
  return Array.from({ length: n }, (_, i) => {
    const row = p.rankRewards?.find((r) => r.rank === i + 1);
    return row?.sats ?? 0;
  });
}

function fairnessInitialFromPreset(
  fc: Record<string, unknown> | null | undefined
) {
  if (!fc || typeof fc !== "object") {
    return {
      excludeMuted: false,
      excludeBlocked: false,
      excludeLowTrust: false,
      excludeNonFollowers: false,
      minAccountAgeDays: 0,
      minFollowers: 0,
    };
  }
  const ma = fc["minAccountAgeDays"];
  const mf = fc["minFollowers"];
  return {
    excludeMuted: fc["excludeMuted"] === true,
    excludeBlocked: fc["excludeBlocked"] === true,
    excludeLowTrust: fc["excludeLowTrust"] === true,
    excludeNonFollowers: fc["excludeNonFollowers"] === true,
    minAccountAgeDays: typeof ma === "number" && Number.isFinite(ma) ? ma : 0,
    minFollowers: typeof mf === "number" && Number.isFinite(mf) ? mf : 0,
  };
}

function ContestNewFormSetupSteps({
  rankingMetric,
  setRankingMetric,
  contestEndAt,
  setContestEndAt,
  stepIssuesRanking,
  prizeMode,
  setPrizeMode,
  winnerCount,
  setWinnerCount,
  equalRewardSats,
  setEqualRewardSats,
  rankRewards,
  setRankRewards,
  prizeSummary,
  stepIssuesRewards,
  excludeMuted,
  setExcludeMuted,
  excludeBlocked,
  setExcludeBlocked,
  excludeLowTrust,
  setExcludeLowTrust,
  excludeNonFollowers,
  setExcludeNonFollowers,
  minAccountAgeDays,
  setMinAccountAgeDays,
  minFollowers,
  setMinFollowers,
  contestEndRequired,
}: {
  rankingMetric: ContestRankingMetric;
  setRankingMetric: (v: ContestRankingMetric) => void;
  contestEndAt: string;
  setContestEndAt: (v: string) => void;
  stepIssuesRanking: string | null;
  prizeMode: "EQUAL" | "RANKED";
  setPrizeMode: (v: "EQUAL" | "RANKED") => void;
  winnerCount: number;
  setWinnerCount: (v: number) => void;
  equalRewardSats: number;
  setEqualRewardSats: (v: number) => void;
  rankRewards: number[];
  setRankRewards: Dispatch<SetStateAction<number[]>>;
  prizeSummary: string;
  stepIssuesRewards: string | null;
  excludeMuted: boolean;
  setExcludeMuted: (v: boolean) => void;
  excludeBlocked: boolean;
  setExcludeBlocked: (v: boolean) => void;
  excludeLowTrust: boolean;
  setExcludeLowTrust: (v: boolean) => void;
  excludeNonFollowers: boolean;
  setExcludeNonFollowers: (v: boolean) => void;
  minAccountAgeDays: number;
  setMinAccountAgeDays: (v: number) => void;
  minFollowers: number;
  setMinFollowers: (v: number) => void;
  contestEndRequired: boolean;
}) {
  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="contest-ranking-heading">
        <CampaignSectionHeader
          id="contest-ranking-heading"
          title="2. Ranking rules"
          description={contestCopy.rankingSectionLead}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="rankingMetric">
              Ranking metric
            </label>
            <select
              id="rankingMetric"
              name="rankingMetric"
              value={rankingMetric}
              onChange={(e) => {
                setRankingMetric(e.target.value as ContestRankingMetric);
              }}
              className={campaignFieldClassNames}
            >
              <option value="REACTIONS">Most reactions</option>
              <option value="ZAPS">Most zaps</option>
              <option value="SATS_ZAPPED">Most sats zapped</option>
              <option value="REPLIES">Most replies</option>
              <option value="REPOSTS">Most reposts</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="contestEndAt">
              Contest end time
            </label>
            <input
              id="contestEndAt"
              name="contestEndAt"
              type="datetime-local"
              required={contestEndRequired}
              value={contestEndAt}
              onChange={(e) => {
                setContestEndAt(e.target.value);
              }}
              className={campaignFieldClassNames}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs">
            {contestCopy.tieBreakShort}
          </p>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-primary text-xs font-medium underline-offset-2 hover:underline"
                >
                  Details
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {contestCopy.tieBreakTooltipDetail}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {stepIssuesRanking ? (
          <CompactStatusMessage variant="error">
            {stepIssuesRanking}
          </CompactStatusMessage>
        ) : null}
      </section>

      <section className="space-y-4" aria-labelledby="contest-prize-heading">
        <CampaignSectionHeader
          id="contest-prize-heading"
          title="3. Prize structure"
        />
        <ChoiceTileGroup
          name="prizeMode"
          value={prizeMode}
          onChange={(v) => {
            setPrizeMode(v);
          }}
          options={[
            {
              value: "EQUAL",
              title: contestCopy.prizeEqualTileTitle,
              description: contestCopy.prizeEqualTileDesc,
            },
            {
              value: "RANKED",
              title: contestCopy.prizeRankedTileTitle,
              description: contestCopy.prizeRankedTileDesc,
            },
          ]}
        />
        <div className="border-border/60 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="winnerCount">
              Number of winners
            </label>
            <input
              id="winnerCount"
              name="winnerCount"
              type="number"
              min={1}
              max={50}
              value={winnerCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                const next = Number.isFinite(n)
                  ? Math.min(50, Math.max(1, n))
                  : winnerCount;
                setWinnerCount(next);
                setRankRewards((prev) => {
                  const arr = [...prev];
                  while (arr.length < next) arr.push(0);
                  return arr.slice(0, next);
                });
              }}
              className={campaignFieldClassNames}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="equalRewardSats">
              Sats per winner (equal mode)
            </label>
            <input
              id="equalRewardSats"
              name="equalRewardSats"
              type="number"
              min={0}
              value={equalRewardSats}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setEqualRewardSats(Number.isFinite(n) ? Math.max(0, n) : 0);
              }}
              className={campaignFieldClassNames}
            />
          </div>
        </div>
        {prizeMode === "RANKED" ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              Set sats per rank (1–{winnerCount}). Unused ranks can be 0.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: winnerCount }, (_, i) => {
                const rank = i + 1;
                return (
                  <div key={rank} className="space-y-1">
                    <label
                      className="text-muted-foreground text-xs"
                      htmlFor={`rankReward_${rank}`}
                    >
                      Rank {rank} (sats)
                    </label>
                    <input
                      id={`rankReward_${rank}`}
                      name={`rankReward_${rank}`}
                      type="number"
                      min={0}
                      value={rankRewards[i] ?? 0}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        const v = Number.isFinite(n) ? Math.max(0, n) : 0;
                        setRankRewards((prev) => {
                          const next = [...prev];
                          next[i] = v;
                          return next;
                        });
                      }}
                      className={campaignFieldClassNames}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <RewardSummaryLine>{prizeSummary}</RewardSummaryLine>
          {stepIssuesRewards ? (
            <CompactStatusMessage variant="warning">
              {stepIssuesRewards}
            </CompactStatusMessage>
          ) : null}
        </div>
      </section>

      <section
        className="space-y-3"
        aria-labelledby="contest-eligibility-heading"
      >
        <CampaignSectionHeader
          id="contest-eligibility-heading"
          title={contestCopy.eligibilitySectionTitle}
          description={contestCopy.eligibilitySectionLead}
        />
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="excludeMuted"
              checked={excludeMuted}
              onChange={(e) => {
                setExcludeMuted(e.target.checked);
              }}
            />
            Exclude muted
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="excludeBlocked"
              checked={excludeBlocked}
              onChange={(e) => {
                setExcludeBlocked(e.target.checked);
              }}
            />
            Exclude blocked
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="excludeLowTrust"
              checked={excludeLowTrust}
              onChange={(e) => {
                setExcludeLowTrust(e.target.checked);
              }}
            />
            Exclude low trust
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="excludeNonFollowers"
              checked={excludeNonFollowers}
              onChange={(e) => {
                setExcludeNonFollowers(e.target.checked);
              }}
            />
            Exclude non-followers
          </label>
        </div>
        <div className="border-border/60 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              className="text-foreground text-sm font-medium"
              htmlFor="minAccountAgeDays"
            >
              Minimum account age (days)
            </label>
            <input
              id="minAccountAgeDays"
              name="minAccountAgeDays"
              type="number"
              min={0}
              aria-describedby="minAccountAgeDays-hint"
              value={minAccountAgeDays}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setMinAccountAgeDays(Number.isFinite(n) ? Math.max(0, n) : 0);
              }}
              className={campaignFieldClassNames}
            />
            <p
              id="minAccountAgeDays-hint"
              className="text-muted-foreground text-xs"
            >
              0 = off
            </p>
          </div>
          <div className="space-y-1">
            <label
              className="text-foreground text-sm font-medium"
              htmlFor="minFollowers"
            >
              Minimum followers
            </label>
            <input
              id="minFollowers"
              name="minFollowers"
              type="number"
              min={0}
              aria-describedby="minFollowers-hint"
              value={minFollowers}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setMinFollowers(Number.isFinite(n) ? Math.max(0, n) : 0);
              }}
              className={campaignFieldClassNames}
            />
            <p id="minFollowers-hint" className="text-muted-foreground text-xs">
              0 = off
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function NewContestRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const presetKey = loaderData.presetDefaults?.id ?? "no-preset";
  return <NewContestForm key={presetKey} loaderData={loaderData} />;
}

function NewContestForm({ loaderData }: { loaderData: ContestNewLoaderData }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  const pendingContestSubmitRef = useRef(false);
  const embedApiRef = useRef<{
    publishNow: () => void;
    schedulePost: () => void;
  } | null>(null);

  const isSubmitting =
    navigation.state === "submitting" || fetcher.state !== "idle";

  const preset = loaderData.presetDefaults;
  const fairnessInit = fairnessInitialFromPreset(
    preset?.fairnessConfig ?? null
  );

  const [prizeMode, setPrizeMode] = useState<"EQUAL" | "RANKED">(
    preset?.prizeMode ?? "EQUAL"
  );
  const [winnerCount, setWinnerCount] = useState(preset?.winnerCount ?? 3);
  const [selectedSourcePostId, setSelectedSourcePostId] = useState("");
  const [composerSessionKey, setComposerSessionKey] = useState(0);
  const [sourceMode, setSourceMode] = useState<"create" | "existing">("create");
  const [contestEndAt, setContestEndAt] = useState("");
  const [equalRewardSats, setEqualRewardSats] = useState(
    preset?.equalRewardSats ?? 1000
  );
  const [rankRewards, setRankRewards] = useState<number[]>(() =>
    preset?.id ? rankRewardsInitialFromPreset(preset) : Array(3).fill(0)
  );
  const [rankingMetric, setRankingMetric] = useState<ContestRankingMetric>(
    preset?.rankingMetric ?? "ZAPS"
  );
  const [excludeMuted, setExcludeMuted] = useState(fairnessInit.excludeMuted);
  const [excludeBlocked, setExcludeBlocked] = useState(
    fairnessInit.excludeBlocked
  );
  const [excludeLowTrust, setExcludeLowTrust] = useState(
    fairnessInit.excludeLowTrust
  );
  const [excludeNonFollowers, setExcludeNonFollowers] = useState(
    fairnessInit.excludeNonFollowers
  );
  const [minAccountAgeDays, setMinAccountAgeDays] = useState(
    fairnessInit.minAccountAgeDays
  );
  const [minFollowers, setMinFollowers] = useState(fairnessInit.minFollowers);
  const [formTitle, setFormTitle] = useState(
    preset?.title?.trim() ? preset.title : ""
  );
  const [launchMode, setLaunchMode] = useState<"now" | "schedule">("now");
  const userTz = loaderData.userTimezone;
  const [scheduledActivationFor, setScheduledActivationFor] = useState(() =>
    getNowForDateTimeLocal(userTz)
  );
  const [now] = useState(() => Date.now());

  const {
    posts,
    planType,
    planLabel,
    presetDefaults,
    userTimezone,
    savedContestDraft,
  } = loaderData;

  useEffect(() => {
    if (
      savedContestDraft &&
      typeof savedContestDraft === "object" &&
      !Array.isArray(savedContestDraft)
    ) {
      const d = savedContestDraft as Record<string, unknown>;
      queueMicrotask(() => {
        if (
          typeof d["launchMode"] === "string" &&
          d["launchMode"] === "schedule"
        ) {
          setLaunchMode("schedule");
        }
        if (typeof d["scheduledActivationFor"] === "string") {
          setScheduledActivationFor(d["scheduledActivationFor"]);
        }
      });
    }
  }, [savedContestDraft]);

  const onContestComposerPublished = useCallback(
    (payload: ContestEmbedPublishPayload) => {
      if (payload.postId) {
        setSelectedSourcePostId(payload.postId);
      }
      setComposerSessionKey((k) => k + 1);
      try {
        localStorage.removeItem("composer-contest-embedded-draft");
      } catch {
        // ignore
      }
      if (pendingContestSubmitRef.current && formRef.current) {
        pendingContestSubmitRef.current = false;
        const fd = new FormData(formRef.current);
        fd.set("sourcePostId", payload.postId);
        fd.set("intent", "launch");
        fd.set("sourceMode", "create");
        fd.set("launchMode", launchMode);
        fd.set(
          "scheduledActivationFor",
          launchMode === "schedule" ? scheduledActivationFor : ""
        );
        trackContestCreationEvent("contest_launch_submit", {
          sourceMode: "create",
          launchMode,
        });
        fetcher.submit(fd, { method: "post" });
      }
      revalidator.revalidate();
    },
    [fetcher, launchMode, revalidator, scheduledActivationFor]
  );

  const selectedSourcePost = useMemo(
    () => posts.find((p) => p.id === selectedSourcePostId) ?? null,
    [posts, selectedSourcePostId]
  );

  const prizeSummary = useMemo(() => {
    if (prizeMode === "EQUAL") {
      const total = winnerCount * equalRewardSats;
      const w = winnerCount !== 1 ? "s" : "";
      return `Top ${winnerCount} winner${w} split ${total.toLocaleString()} sats equally.`;
    }
    const ranked = rankRewards.slice(0, winnerCount);
    if (!ranked.some((s) => s > 0)) {
      return "Add rank rewards above 0.";
    }
    const ord = (n: number) =>
      n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
    return ranked
      .map((sats, i) => `${ord(i + 1)} ${sats.toLocaleString()} sats`)
      .join(", ");
  }, [prizeMode, winnerCount, equalRewardSats, rankRewards]);

  const entryRuleSummary = contestCopy.entryRuleShort;

  const stepIssues = {
    source:
      sourceMode === "existing" && !selectedSourcePostId.trim()
        ? "Choose a source post."
        : null,
    ranking: !contestEndAt
      ? "Set a contest end time in the future."
      : new Date(contestEndAt).getTime() <= now
        ? "Set a contest end time in the future."
        : null,
    rewards:
      prizeMode === "RANKED" && !rankRewards.some((r) => r > 0)
        ? "Set at least one rank-based reward above 0."
        : prizeMode === "EQUAL" && equalRewardSats <= 0
          ? "Prize pool is 0 sats."
          : null,
  };

  const endOk = Boolean(contestEndAt) && new Date(contestEndAt).getTime() > now;
  const sourceOkExisting =
    sourceMode === "existing" && selectedSourcePostId.trim() !== "";
  const sourceOkCreate =
    sourceMode === "create" && selectedSourcePostId.trim() !== "";
  const scheduleTimeOk =
    scheduledActivationFor.trim() !== "" &&
    new Date(scheduledActivationFor).getTime() > now;
  const scheduleOk = launchMode === "now" || scheduleTimeOk;

  const primaryCtaDisabled = useMemo(() => {
    if (!formTitle.trim()) return true;
    if (!endOk) return true;
    if (stepIssues.rewards) return true;
    if (sourceMode === "existing" && !sourceOkExisting) return true;
    if (sourceMode === "create" && launchMode === "schedule" && !scheduleOk)
      return true;
    return false;
  }, [
    formTitle,
    endOk,
    stepIssues.rewards,
    sourceMode,
    sourceOkExisting,
    launchMode,
    scheduleOk,
  ]);

  const readinessRequired: ContestReadinessItem[] = useMemo(
    () => [
      {
        id: "source",
        label:
          sourceMode === "existing"
            ? "Source post selected"
            : "Source post published or scheduled via contest action",
        satisfied:
          sourceMode === "existing" ? sourceOkExisting : sourceOkCreate,
        isError: true,
      },
      {
        id: "title",
        label: "Contest title",
        satisfied: formTitle.trim().length > 0,
        isError: true,
      },
      {
        id: "end",
        label: "Contest end time (future)",
        satisfied: endOk,
        isError: true,
      },
      {
        id: "winners",
        label: "Winners & pool valid",
        satisfied: !stepIssues.rewards,
        isError: true,
      },
      {
        id: "schedule",
        label: "Activation schedule (future)",
        satisfied: launchMode === "now" || scheduleOk,
        isError: true,
      },
    ],
    [
      sourceMode,
      sourceOkExisting,
      sourceOkCreate,
      launchMode,
      formTitle,
      endOk,
      stepIssues.rewards,
      scheduleOk,
    ]
  );

  const noFairnessFilters =
    !excludeMuted &&
    !excludeBlocked &&
    !excludeLowTrust &&
    !excludeNonFollowers &&
    minAccountAgeDays <= 0 &&
    minFollowers <= 0;

  const readinessRecommended: ContestReadinessItem[] = useMemo(
    () => [
      {
        id: "filters",
        label: "Eligibility filters configured",
        satisfied: !noFairnessFilters,
      },
      {
        id: "review",
        label: "Muted / blocked / low-trust exclusions reviewed",
        satisfied: excludeMuted || excludeBlocked || excludeLowTrust,
      },
    ],
    [noFairnessFilters, excludeMuted, excludeBlocked, excludeLowTrust]
  );

  const handleSaveDraft = useCallback(() => {
    const payload = {
      sourceMode,
      launchMode,
      scheduledActivationFor,
      formTitle,
      contestEndAt,
      rankingMetric,
      prizeMode,
      winnerCount,
      equalRewardSats,
      rankRewards,
      excludeMuted,
      excludeBlocked,
      excludeLowTrust,
      excludeNonFollowers,
      minAccountAgeDays,
      minFollowers,
    };
    const fd = new FormData();
    fd.set("intent", "save-draft");
    fd.set("draftPayload", JSON.stringify(payload));
    trackContestCreationEvent("contest_draft_saved");
    fetcher.submit(fd, { method: "post" });
  }, [
    sourceMode,
    launchMode,
    scheduledActivationFor,
    formTitle,
    contestEndAt,
    rankingMetric,
    prizeMode,
    winnerCount,
    equalRewardSats,
    rankRewards,
    excludeMuted,
    excludeBlocked,
    excludeLowTrust,
    excludeNonFollowers,
    minAccountAgeDays,
    minFollowers,
    fetcher,
  ]);

  const handlePrimaryLaunch = useCallback(() => {
    if (primaryCtaDisabled) return;
    if (sourceMode === "existing") {
      trackContestCreationEvent("contest_launch_submit", {
        sourceMode,
        launchMode,
      });
      if (formRef.current) {
        const fd = new FormData(formRef.current);
        fd.set("intent", "launch");
        fetcher.submit(fd, { method: "post" });
      }
      return;
    }
    pendingContestSubmitRef.current = true;
    trackContestCreationEvent("contest_launch_submit", {
      sourceMode,
      launchMode,
    });
    if (launchMode === "now") {
      embedApiRef.current?.publishNow();
    } else {
      embedApiRef.current?.schedulePost();
    }
  }, [primaryCtaDisabled, sourceMode, launchMode, fetcher]);

  const primaryLabel = getContestLaunchCtaConfig(
    sourceMode,
    launchMode
  ).ctaLabel;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/contests"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Contests
        </Link>
      </div>

      <form
        ref={formRef}
        id="dashboard-contest-new-form"
        method="post"
        className="lg:grid lg:grid-cols-[1fr_min(100%,312px)] lg:items-start lg:gap-8 xl:grid-cols-[1fr_min(100%,344px)]"
      >
        <div className="min-w-0 space-y-8">
          <div className="space-y-1">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              New contest
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Save a draft anytime, then launch from the rail.
            </p>
          </div>

          {actionData &&
          typeof actionData === "object" &&
          "error" in actionData &&
          actionData.error ? (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
              {String(actionData.error)}
            </div>
          ) : null}
          {actionData &&
          typeof actionData === "object" &&
          "draftSaved" in actionData &&
          (actionData as { draftSaved?: boolean }).draftSaved ? (
            <p className="text-muted-foreground text-sm">Draft saved.</p>
          ) : null}

          {presetDefaults?.id ? (
            <CompactStatusMessage variant="info">
              Preset loaded — set source post and end time, then save or launch.
            </CompactStatusMessage>
          ) : null}

          <input type="hidden" name="intent" value="launch" />
          <input type="hidden" name="sourceMode" value={sourceMode} />
          <input type="hidden" name="launchMode" value={launchMode} />
          <input
            type="hidden"
            name="scheduledActivationFor"
            value={launchMode === "schedule" ? scheduledActivationFor : ""}
          />
          <input
            type="hidden"
            name="sourcePostId"
            value={selectedSourcePostId}
          />
          <input
            type="hidden"
            name="appliedPresetId"
            value={presetDefaults?.id ?? ""}
          />
          <section className="space-y-2">
            <label className="text-sm font-medium" htmlFor="title">
              Contest title
            </label>
            <input
              id="title"
              name="title"
              value={formTitle}
              onChange={(e) => {
                setFormTitle(e.target.value);
              }}
              className={campaignFieldClassNames}
            />
            <p className="text-muted-foreground text-xs">{entryRuleSummary}</p>
          </section>

          <SourcePostModule
            id="contest-source-heading"
            title="1. Source post"
            description={
              sourceMode === "create"
                ? contestCopy.sourceModuleCreate
                : contestCopy.sourceModuleExisting
            }
            mode={sourceMode}
            onModeChange={(m) => {
              setSourceMode(m);
              trackContestCreationEvent("contest_source_mode", { mode: m });
            }}
            errorMessage={stepIssues.source}
            createBody={
              <>
                <ContestEmbeddedComposer
                  loaderData={loaderData as Record<string, unknown>}
                  composerKey={composerSessionKey}
                  contestRailLaunchMode={launchMode}
                  contestRailScheduledFor={scheduledActivationFor}
                  onEmbedActionsReady={(api) => {
                    embedApiRef.current = api;
                  }}
                  onEmbedPublishSuccess={onContestComposerPublished}
                />
                {posts.length === 0 ? (
                  <CompactStatusMessage variant="info">
                    No published posts in the last 90 days yet. After you
                    publish, they appear here when you switch to “existing
                    post”.
                  </CompactStatusMessage>
                ) : null}
              </>
            }
            existingBody={
              <>
                <PublishedPostPickerGrid
                  posts={posts}
                  value={selectedSourcePostId}
                  onValueChange={setSelectedSourcePostId}
                  searchInputId="contest-source-post-search"
                  emptyPostsMessage="No published posts with a Nostr id yet."
                  emptyFilterMessage="No posts match your search."
                />
                {selectedSourcePost ? (
                  <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Selected source
                      </p>
                      <p className="text-foreground mt-0.5 text-sm">
                        {formatPostOptionLabel(selectedSourcePost)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setSelectedSourcePostId("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : null}
              </>
            }
          />

          <ContestNewFormSetupSteps
            rankingMetric={rankingMetric}
            setRankingMetric={setRankingMetric}
            contestEndAt={contestEndAt}
            setContestEndAt={setContestEndAt}
            stepIssuesRanking={stepIssues.ranking}
            prizeMode={prizeMode}
            setPrizeMode={setPrizeMode}
            winnerCount={winnerCount}
            setWinnerCount={setWinnerCount}
            equalRewardSats={equalRewardSats}
            setEqualRewardSats={setEqualRewardSats}
            rankRewards={rankRewards}
            setRankRewards={setRankRewards}
            prizeSummary={prizeSummary}
            stepIssuesRewards={stepIssues.rewards}
            excludeMuted={excludeMuted}
            setExcludeMuted={setExcludeMuted}
            excludeBlocked={excludeBlocked}
            setExcludeBlocked={setExcludeBlocked}
            excludeLowTrust={excludeLowTrust}
            setExcludeLowTrust={setExcludeLowTrust}
            excludeNonFollowers={excludeNonFollowers}
            setExcludeNonFollowers={setExcludeNonFollowers}
            minAccountAgeDays={minAccountAgeDays}
            setMinAccountAgeDays={setMinAccountAgeDays}
            minFollowers={minFollowers}
            setMinFollowers={setMinFollowers}
            contestEndRequired={sourceMode !== "create"}
          />
        </div>

        <div className="mt-10 w-full min-w-0 self-start lg:mt-0">
          <ContestBuilderSummaryRail
            planType={planType}
            planLabel={planLabel}
            sourceMode={sourceMode}
            hasSourcePost={selectedSourcePostId.trim() !== ""}
            hasValidNewPostComposer={sourceOkCreate}
            rankingMetric={rankingMetric}
            contestEndAt={contestEndAt}
            prizeMode={prizeMode}
            winnerCount={winnerCount}
            equalRewardSats={equalRewardSats}
            rankRewards={rankRewards}
            fairness={{
              excludeMuted,
              excludeBlocked,
              excludeLowTrust,
              excludeNonFollowers,
              minAccountAgeDays,
              minFollowers,
            }}
            launchMode={launchMode}
            onLaunchModeChange={(m) => {
              setLaunchMode(m);
              trackContestCreationEvent("contest_launch_mode", { mode: m });
            }}
            scheduledActivationFor={scheduledActivationFor}
            onScheduledActivationForChange={(v) => {
              setScheduledActivationFor(v);
              trackContestCreationEvent("contest_schedule_set");
            }}
            userTimezone={userTimezone}
            readinessRequired={readinessRequired}
            readinessRecommended={readinessRecommended}
            primaryCtaDisabled={primaryCtaDisabled}
            footerActions={
              <ActionRailActions
                secondaryButton={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={RAIL_SECONDARY_ACTION}
                    disabled={isSubmitting}
                    onClick={handleSaveDraft}
                  >
                    Save draft
                  </Button>
                }
                primaryButton={
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={primaryCtaDisabled || isSubmitting}
                    onClick={handlePrimaryLaunch}
                    className={cn(
                      "h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none",
                      primaryCtaDisabled || isSubmitting
                        ? "bg-primary/80 text-primary-foreground hover:bg-primary/80 pointer-events-auto cursor-not-allowed opacity-95"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {primaryLabel}
                  </Button>
                }
              />
            }
          />
        </div>
      </form>
    </div>
  );
}
