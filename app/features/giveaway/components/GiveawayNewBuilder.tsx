import { Link, useFetcher, useNavigate, useNavigation } from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ActionRailActions,
  RAIL_SECONDARY_ACTION,
} from "~/components/action-rail";
import { Button } from "~/components/ui/button";
import {
  buildGiveawayOutcomeLine,
  CampaignActionRail,
  CampaignSectionHeader,
  ChoiceTileGroup,
  CompactStatusMessage,
  PublishedPostPickerGrid,
  RewardSummaryLine,
  campaignFieldClassNames,
  campaignSelectClassNames,
} from "~/features/campaign-ui";
import {
  computeFinalizationFeeSats,
  getFinalizationFeeRateBps,
} from "~/features/giveaway/giveaway-finalization-fee.shared";
import type { PlanType } from "~/features/payments/types";

import {
  ALL_GIVEAWAY_ENGAGEMENT_TYPES,
  scopeAllowsEngagementEntryTypePick,
  scopeIsFollowGraphAccountPool,
} from "../types";

const DEFAULT_ENGAGEMENT_ALL: Record<string, boolean> = {
  REACTION: true,
  REPOST: true,
  COMMENT: true,
  ZAP: true,
};

const ENGAGEMENT_META: Array<{
  value: string;
  label: string;
  hint: string;
}> = [
  {
    value: "REACTION",
    label: "Reaction",
    hint: "Likes on your notes",
  },
  {
    value: "REPOST",
    label: "Repost",
    hint: "Shares / boosts",
  },
  {
    value: "COMMENT",
    label: "Comment",
    hint: "Replies in the thread",
  },
  {
    value: "ZAP",
    label: "Zap",
    hint: "Lightning tips on content",
  },
];

type BuilderScopeType = "PERIOD" | "SINGLE_POST" | "FOLLOWERS" | "FOLLOWING";

const SCOPE_TYPE_OPTIONS: ReadonlyArray<{
  value: BuilderScopeType;
  title: string;
  desc: string;
}> = [
  {
    value: "PERIOD",
    title: "Period",
    desc: "Engagement across your recent posts",
  },
  {
    value: "SINGLE_POST",
    title: "Single post",
    desc: "Engagement on that note only — not nested replies deeper in the thread",
  },
  {
    value: "FOLLOWERS",
    title: "Followers",
    desc: "People who follow you now",
  },
  {
    value: "FOLLOWING",
    title: "Following",
    desc: "Accounts you follow",
  },
];

function asideScopeLine(
  scopeType: BuilderScopeType,
  periodMode: "days" | "custom"
): string {
  if (scopeType === "PERIOD") {
    return periodMode === "days"
      ? "Period (days + optional queue)"
      : "Custom range";
  }
  const hit = SCOPE_TYPE_OPTIONS.find((o) => o.value === scopeType);
  return hit?.title ?? scopeType;
}

export interface GiveawayNewBuilderProps {
  presets: Array<{
    id: string;
    name: string;
    scopeType: string;
    winnerCount: number;
  }>;
  queueTypes: Array<{ id: string; name: string }>;
  recentPosts: Array<{
    id: string;
    caption: string | null;
    publishedAt: string;
    fileUrl: string[];
    postType: string;
  }>;
  planLimits: {
    maxWinnerCount: number;
    canUseQueueScope: boolean;
    canUsePresets: boolean;
  };
  planType: PlanType;
  planDisplayName: string;
  actionError?: string;
}

/* eslint-disable sonarjs/cognitive-complexity -- rail aggregates many builder fields */
function GiveawayNewBuilderStickySummary({
  scopeType,
  periodMode,
  selectedTypes,
  winnerCount,
  rewardMode,
  simpleSats,
  selectionMode,
  planDisplayName,
  plannedPayoutForFee,
  feePreview,
  isFollowGraphScope,
  selectedSinglePostId,
  actionError,
  fetcherError,
  isBusy,
  onSaveDraft,
}: {
  scopeType: BuilderScopeType;
  periodMode: "days" | "custom";
  selectedTypes: string[];
  winnerCount: number;
  rewardMode: "simple" | "advanced";
  simpleSats: number;
  selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
  planDisplayName: string;
  plannedPayoutForFee: number | null;
  feePreview: {
    feeSats: number;
    waivedByPlan: boolean;
    rateBps: number;
  } | null;
  isFollowGraphScope: boolean;
  selectedSinglePostId: string;
  actionError?: string;
  fetcherError?: string;
  isBusy: boolean;
  onSaveDraft: () => void;
}) {
  const entryValue = isFollowGraphScope
    ? "Random from accounts (after filters)"
    : selectedTypes.length
      ? selectedTypes.join(", ")
      : "None selected";

  const rewardsValue =
    rewardMode === "simple"
      ? simpleSats > 0
        ? `${simpleSats.toLocaleString()} sats × ${winnerCount} → ${(simpleSats * winnerCount).toLocaleString()} max`
        : "Selection-only (no payout)"
      : "Advanced per-type";

  const selectionValue = isFollowGraphScope
    ? "Uniform random"
    : selectionMode === "UNIQUE_USER"
      ? "Unique user"
      : "Weighted";

  const missingLines: string[] = [];
  if (scopeType === "SINGLE_POST" && !selectedSinglePostId.trim()) {
    missingLines.push("Select a post for single-post scope.");
  }
  if (!isFollowGraphScope && selectedTypes.length === 0) {
    missingLines.push("Select at least one entry method.");
  }

  const cautionLines: string[] = [];
  if (winnerCount > 50) {
    cautionLines.push("Winner count is high — confirm your plan cap.");
  }

  const blockerLines = [...missingLines, ...cautionLines];
  const blocker =
    blockerLines.length > 0
      ? {
          variant: "warning" as const,
          title: "Before you continue",
          lines: blockerLines,
        }
      : null;

  const serverErr = actionError ?? fetcherError;
  const outcomeLine = buildGiveawayOutcomeLine({
    plannedPayoutSats:
      plannedPayoutForFee != null && plannedPayoutForFee > 0
        ? plannedPayoutForFee
        : null,
    winnerCount,
  });

  const plannedPayoutDisplay =
    rewardMode === "advanced"
      ? "—"
      : plannedPayoutForFee != null
        ? `${plannedPayoutForFee.toLocaleString()} sats`
        : "0 sats";

  let finalizationDisplay: string;
  let dueAtLockDisplay: string;
  if (rewardMode === "advanced") {
    finalizationDisplay = "At preview";
    dueAtLockDisplay = "—";
  } else if (plannedPayoutForFee != null && feePreview) {
    finalizationDisplay =
      plannedPayoutForFee <= 0
        ? "0 sats"
        : feePreview.waivedByPlan
          ? "Included in plan"
          : `${feePreview.rateBps / 100}% (${feePreview.feeSats.toLocaleString()} sats)`;
    dueAtLockDisplay =
      plannedPayoutForFee <= 0
        ? "0 sats"
        : feePreview.waivedByPlan
          ? "0 sats"
          : `${feePreview.feeSats.toLocaleString()} sats`;
  } else {
    finalizationDisplay = "—";
    dueAtLockDisplay = "—";
  }

  return (
    <CampaignActionRail
      ariaLabel="Giveaway summary"
      className="mt-10 self-start lg:mt-0"
      snapshotLabel="Snapshot"
      snapshotRows={[
        { label: "Scope", value: asideScopeLine(scopeType, periodMode) },
        {
          label: "Entry",
          value: entryValue,
          placeholder: !isFollowGraphScope ? selectedTypes.length === 0 : false,
        },
        { label: "Winners", value: `${winnerCount} total` },
        { label: "Rewards", value: rewardsValue },
        { label: "Selection", value: selectionValue },
        { label: "Plan", value: planDisplayName },
      ]}
      financialLabel="Payout & fees"
      financialRows={[
        { label: "Planned payout", value: plannedPayoutDisplay },
        { label: "Finalization fee", value: finalizationDisplay },
        { label: "Due at lock", value: dueAtLockDisplay },
      ]}
      blocker={blocker}
      serverError={serverErr ?? null}
      outcomeHeadline="Ready to continue"
      outcomeLine={outcomeLine}
      footer={
        <ActionRailActions
          secondaryButton={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={RAIL_SECONDARY_ACTION}
              onClick={onSaveDraft}
              disabled={isBusy}
            >
              Save draft
            </Button>
          }
          primaryButton={
            <Button
              type="submit"
              size="sm"
              variant="default"
              disabled={isBusy}
              className="h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none"
            >
              Create draft & continue to preview
            </Button>
          }
        />
      }
    />
  );
}
/* eslint-enable sonarjs/cognitive-complexity */

function GiveawayNewBuilderPresetTemplates({
  planLimits,
  presets,
}: Pick<GiveawayNewBuilderProps, "planLimits" | "presets">) {
  return (
    <section
      className="border-border/60 space-y-3 border-t pt-10"
      aria-labelledby="preset-templates-heading"
    >
      <h2
        id="preset-templates-heading"
        className="text-muted-foreground text-sm font-medium"
      >
        Start from preset
      </h2>
      {!planLimits.canUsePresets ? (
        <p className="text-muted-foreground text-sm">
          Upgrade to save and use templates.
        </p>
      ) : presets.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {presets.map((p) => (
            <li key={p.id}>
              <form
                method="post"
                className="flex flex-wrap items-center justify-between gap-2 py-1"
              >
                <input type="hidden" name="intent" value="createFromPreset" />
                <input type="hidden" name="presetId" value={p.id} />
                <span className="text-foreground text-sm">
                  {p.name}{" "}
                  <span className="text-muted-foreground">
                    · {p.scopeType} · {p.winnerCount} winner
                    {p.winnerCount !== 1 ? "s" : ""}
                  </span>
                </span>
                <Button
                  type="submit"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                >
                  Use
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No presets yet — save one from a giveaway detail page.
        </p>
      )}
    </section>
  );
}

function GiveawayNewBuilderSelection({
  selectionMode,
  setSelectionMode,
  isFollowGraphScope,
}: {
  selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
  setSelectionMode: (v: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT") => void;
  isFollowGraphScope: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="sel-heading">
      <CampaignSectionHeader
        id="sel-heading"
        title="4. Winner selection"
        description={
          isFollowGraphScope
            ? "Uniform random from your follower or following pool after filters."
            : "How entries map to winners after filters."
        }
      />
      {isFollowGraphScope ? (
        <>
          <input type="hidden" name="selectionMode" value="UNIQUE_USER" />
          <CompactStatusMessage variant="info">
            One chance per eligible account. Pool is your follow graph at lock
            time.
          </CompactStatusMessage>
        </>
      ) : (
        <div className="max-w-md space-y-1">
          <label
            htmlFor="selectionMode"
            className="text-muted-foreground text-sm font-medium"
          >
            Selection mode
          </label>
          <select
            id="selectionMode"
            name="selectionMode"
            value={selectionMode}
            onChange={(e) => {
              setSelectionMode(
                e.target.value === "WEIGHTED_BY_ENGAGEMENT"
                  ? "WEIGHTED_BY_ENGAGEMENT"
                  : "UNIQUE_USER"
              );
            }}
            className={campaignSelectClassNames}
          >
            <option value="UNIQUE_USER">
              Unique user (one entry per pubkey)
            </option>
            <option value="WEIGHTED_BY_ENGAGEMENT">
              Weighted by engagement
            </option>
          </select>
        </div>
      )}
      <CompactStatusMessage variant="info">
        {isFollowGraphScope
          ? "Preview winners before lock. Locked giveaways cannot be edited."
          : "Random draw from eligible entries. Preview before lock — locked giveaways cannot be edited."}
      </CompactStatusMessage>
    </section>
  );
}

export function GiveawayNewBuilder({
  presets,
  queueTypes,
  recentPosts,
  planLimits,
  planType,
  planDisplayName,
  actionError,
}: GiveawayNewBuilderProps) {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const saveFetcher = useFetcher<{
    ok?: boolean;
    giveawayId?: string;
    error?: string;
  }>();

  useEffect(() => {
    const d = saveFetcher.data;
    if (d && d.ok === true && typeof d.giveawayId === "string") {
      navigate(`/dashboard/giveaway/detail/${d.giveawayId}`, {
        replace: true,
      });
    }
  }, [saveFetcher.data, navigate]);

  const isSubmitting = navigation.state === "submitting";
  const isSaveSubmitting = saveFetcher.state !== "idle";
  const isBusy = isSubmitting || isSaveSubmitting;

  const fetcherError =
    navigation.state === "submitting"
      ? undefined
      : saveFetcher.state === "idle" &&
          saveFetcher.data &&
          "error" in saveFetcher.data &&
          typeof saveFetcher.data.error === "string"
        ? saveFetcher.data.error
        : undefined;

  const handleSaveDraft = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("responseMode", "json");
    saveFetcher.submit(fd, { method: "post" });
  };

  const [scopeType, setScopeType] = useState<
    "PERIOD" | "SINGLE_POST" | "FOLLOWERS" | "FOLLOWING"
  >("PERIOD");
  const [periodMode, setPeriodMode] = useState<"days" | "custom">("days");
  const [selectedSinglePostId, setSelectedSinglePostId] = useState("");
  const [engagement, setEngagement] = useState<Record<string, boolean>>({
    REACTION: true,
    REPOST: true,
    COMMENT: true,
    ZAP: true,
  });
  const [rewardMode, setRewardMode] = useState<"simple" | "advanced">("simple");
  const [winnerCount, setWinnerCount] = useState(3);
  const [simpleSats, setSimpleSats] = useState(0);
  const [selectionMode, setSelectionMode] = useState<
    "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT"
  >("UNIQUE_USER");

  const canPickEngagementEntryTypes =
    scopeAllowsEngagementEntryTypePick(scopeType);
  const isFollowGraphScope = scopeIsFollowGraphAccountPool(scopeType);

  const effectiveRewardMode = isFollowGraphScope ? "simple" : rewardMode;
  const effectiveSelectionMode = isFollowGraphScope
    ? "UNIQUE_USER"
    : selectionMode;
  const effectiveEngagement = canPickEngagementEntryTypes
    ? engagement
    : DEFAULT_ENGAGEMENT_ALL;

  const selectedTypes = ENGAGEMENT_META.filter(
    (m) => effectiveEngagement[m.value]
  ).map((m) => m.value);

  const plannedPayoutForFee =
    effectiveRewardMode === "simple" ? winnerCount * simpleSats : null;
  const feePreview = useMemo(() => {
    if (plannedPayoutForFee == null) return null;
    const rateBps = getFinalizationFeeRateBps(planType);
    const { feeSats, waivedByPlan } = computeFinalizationFeeSats(
      plannedPayoutForFee,
      rateBps
    );
    return { feeSats, waivedByPlan, rateBps };
  }, [plannedPayoutForFee, planType]);

  const toggleEngagement = (key: string, checked: boolean) => {
    setEngagement((prev) => {
      const next = { ...prev, [key]: checked };
      const anyOn = Object.values(next).some(Boolean);
      if (!anyOn) return prev;
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/giveaway"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Giveaways
        </Link>
      </div>

      <form
        ref={formRef}
        method="post"
        className="lg:grid lg:grid-cols-[1fr_min(100%,312px)] lg:items-start lg:gap-8 xl:grid-cols-[1fr_min(100%,344px)]"
      >
        <input type="hidden" name="intent" value="create" />
        <input type="hidden" name="rewardMode" value={effectiveRewardMode} />
        <input type="hidden" name="periodMode" value={periodMode} />

        <div className="min-w-0 space-y-10">
          <div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              New giveaway
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Draft first, preview winners, then lock or pay.
            </p>
            <label htmlFor="giveaway-name" className="sr-only">
              Optional title
            </label>
            <input
              id="giveaway-name"
              name="name"
              type="text"
              placeholder="Optional giveaway title"
              className={`${campaignFieldClassNames} mt-4 max-w-md`}
            />
          </div>

          <section className="space-y-4" aria-labelledby="scope-heading">
            <CampaignSectionHeader
              id="scope-heading"
              title="1. Reward scope"
              description="Where entries come from for this giveaway."
            />
            <ChoiceTileGroup
              name="scopeType"
              value={scopeType}
              onChange={(v) => {
                setScopeType(v);
              }}
              options={SCOPE_TYPE_OPTIONS.map((o) => ({
                value: o.value,
                title: o.title,
                description: o.desc,
              }))}
            />

            {scopeType === "PERIOD" ? (
              <div className="border-border/60 space-y-3 border-t pt-4">
                <div className="flex flex-wrap gap-4">
                  <label className="text-foreground flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="periodModeUi"
                      checked={periodMode === "days"}
                      onChange={() => {
                        setPeriodMode("days");
                      }}
                    />
                    Last N days
                  </label>
                  <label className="text-foreground flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="periodModeUi"
                      checked={periodMode === "custom"}
                      onChange={() => {
                        setPeriodMode("custom");
                      }}
                    />
                    Custom date range
                  </label>
                </div>
                {periodMode === "days" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="periodDays"
                      className="text-muted-foreground text-sm"
                    >
                      Days
                    </label>
                    <select
                      id="periodDays"
                      name="periodDays"
                      className={`${campaignSelectClassNames} w-auto min-w-[140px]`}
                      defaultValue="7"
                    >
                      {[7, 14, 30].map((d) => (
                        <option key={d} value={d}>
                          Last {d} days
                        </option>
                      ))}
                    </select>
                    {planLimits.canUseQueueScope ? (
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="queueId"
                          className="text-muted-foreground text-sm"
                        >
                          Queue
                        </label>
                        <select
                          id="queueId"
                          name="queueId"
                          className={`${campaignSelectClassNames} min-w-[160px]`}
                        >
                          <option value="">All queues</option>
                          {queueTypes.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label
                        htmlFor="periodFrom"
                        className="text-muted-foreground mb-1 block text-xs"
                      >
                        From
                      </label>
                      <input
                        id="periodFrom"
                        name="periodFrom"
                        type="date"
                        className={`${campaignFieldClassNames} w-auto`}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="periodTo"
                        className="text-muted-foreground mb-1 block text-xs"
                      >
                        To
                      </label>
                      <input
                        id="periodTo"
                        name="periodTo"
                        type="date"
                        className={`${campaignFieldClassNames} w-auto`}
                      />
                    </div>
                    {planLimits.canUseQueueScope ? (
                      <div>
                        <label
                          htmlFor="queueId2"
                          className="text-muted-foreground mb-1 block text-xs"
                        >
                          Queue (optional)
                        </label>
                        <select
                          id="queueId2"
                          name="queueId"
                          className={`${campaignSelectClassNames} min-w-[160px]`}
                        >
                          <option value="">All queues</option>
                          {queueTypes.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {scopeType === "SINGLE_POST" ? (
              <div className="border-border/60 space-y-2 border-t pt-4">
                <input
                  type="hidden"
                  name="postId"
                  value={selectedSinglePostId}
                />
                <PublishedPostPickerGrid
                  posts={recentPosts}
                  value={selectedSinglePostId}
                  onValueChange={setSelectedSinglePostId}
                  searchInputId="giveaway-single-post-search"
                  emptyPostsMessage="No published posts in the last 90 days."
                  emptyFilterMessage="No posts match your search."
                />
              </div>
            ) : null}

            {scopeType === "FOLLOWERS" || scopeType === "FOLLOWING" ? (
              <CompactStatusMessage variant="info">
                Eligible accounts follow your graph at lock time (not frozen
                now).
              </CompactStatusMessage>
            ) : null}
          </section>

          <section className="space-y-4" aria-labelledby="elig-heading">
            <CampaignSectionHeader
              id="elig-heading"
              title="2. Eligibility & entry"
              description="What counts as an entry, and who can be excluded."
            />
            {canPickEngagementEntryTypes ? (
              <>
                <p className="text-foreground text-sm font-medium">
                  Entry methods
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ENGAGEMENT_META.map((m) => (
                    <label
                      key={m.value}
                      htmlFor={`giveaway-engagement-${m.value}`}
                      className="border-border bg-card flex cursor-pointer gap-3 rounded-lg border p-3"
                    >
                      <input
                        id={`giveaway-engagement-${m.value}`}
                        type="checkbox"
                        name="engagementTypes"
                        aria-label={`${m.label}: ${m.hint}`}
                        value={m.value}
                        checked={engagement[m.value] ?? false}
                        onChange={(e) => {
                          toggleEngagement(m.value, e.target.checked);
                        }}
                      />
                      <span>
                        <span className="text-foreground font-medium">
                          {m.label}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {m.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : isFollowGraphScope ? (
              <p className="text-muted-foreground text-sm">
                Random from your follower or following list at lock (not from
                note engagement). Use exclusions below to narrow the pool.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  For this scope, reactions, reposts, comments, and zaps can
                  count as entries. You can narrow types only for period or
                  single-post giveaways.
                </p>
                {ALL_GIVEAWAY_ENGAGEMENT_TYPES.map((t) => (
                  <input
                    key={t}
                    type="hidden"
                    name="engagementTypes"
                    value={t}
                  />
                ))}
              </>
            )}

            <div className="border-border/60 space-y-2 border-t pt-4">
              <p className="text-foreground text-sm font-medium">Exclusions</p>
              <div className="flex flex-wrap gap-4">
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input type="checkbox" name="excludeMuted" value="true" />
                  Muted
                </label>
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input type="checkbox" name="excludeBlocked" value="true" />
                  Blacklisted
                </label>
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input type="checkbox" name="excludeLowTrust" value="true" />
                  Low trust
                </label>
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="excludeNonFollowers"
                    value="true"
                  />
                  Non-followers
                </label>
              </div>
            </div>

            <details className="border-border/60 group border-t pt-4">
              <summary className="text-muted-foreground marker:text-muted-foreground cursor-pointer text-sm font-medium">
                Advanced fairness (optional)
              </summary>
              <div className="mt-3 flex flex-wrap gap-4">
                <div>
                  <label
                    htmlFor="minAccountAgeDays"
                    className="text-muted-foreground text-xs"
                  >
                    Min account age (days)
                  </label>
                  <input
                    id="minAccountAgeDays"
                    name="minAccountAgeDays"
                    type="number"
                    min={0}
                    placeholder="—"
                    className={`${campaignFieldClassNames} mt-1 block w-28`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="minFollowers"
                    className="text-muted-foreground text-xs"
                  >
                    Min followers
                  </label>
                  <input
                    id="minFollowers"
                    name="minFollowers"
                    type="number"
                    min={0}
                    placeholder="—"
                    className={`${campaignFieldClassNames} mt-1 block w-28`}
                  />
                </div>
              </div>
            </details>
          </section>

          <section className="space-y-4" aria-labelledby="reward-heading">
            <CampaignSectionHeader
              id="reward-heading"
              title="3. Reward distribution"
              description="Payout shape and amounts."
            />
            {!isFollowGraphScope ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setRewardMode("simple");
                  }}
                  className={
                    rewardMode === "simple"
                      ? "border-primary bg-primary/5 cursor-pointer rounded-lg border p-4 text-left transition-colors"
                      : "border-border bg-card hover:border-primary/40 cursor-pointer rounded-lg border p-4 text-left transition-colors"
                  }
                >
                  <p className="text-foreground font-medium">Simple payout</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Same sats per winner.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRewardMode("advanced");
                  }}
                  className={
                    rewardMode === "advanced"
                      ? "border-primary bg-primary/5 cursor-pointer rounded-lg border p-4 text-left transition-colors"
                      : "border-border bg-card hover:border-primary/40 cursor-pointer rounded-lg border p-4 text-left transition-colors"
                  }
                >
                  <p className="text-foreground font-medium">
                    Customize by entry type
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Per-type winners and sats.
                  </p>
                </button>
              </div>
            ) : null}

            {effectiveRewardMode === "simple" ? (
              <div className="border-border/60 flex flex-wrap gap-6 border-t pt-4">
                <div>
                  <label
                    htmlFor="winnerCount"
                    className="text-muted-foreground text-sm"
                  >
                    Number of winners
                  </label>
                  <input
                    id="winnerCount"
                    name="winnerCount"
                    type="number"
                    min={1}
                    max={planLimits.maxWinnerCount}
                    value={winnerCount}
                    onChange={(e) => {
                      setWinnerCount(
                        Math.min(
                          planLimits.maxWinnerCount,
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      );
                    }}
                    className={`${campaignFieldClassNames} mt-1 block w-24`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="simpleSatsPerWinner"
                    className="text-muted-foreground text-sm"
                  >
                    Sats per winner
                  </label>
                  <input
                    id="simpleSatsPerWinner"
                    name="simpleSatsPerWinner"
                    type="number"
                    min={0}
                    value={simpleSats}
                    onChange={(e) => {
                      setSimpleSats(
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      );
                    }}
                    className={`${campaignFieldClassNames} mt-1 block w-28`}
                  />
                </div>
                <div className="text-muted-foreground flex min-w-[12rem] flex-col justify-end text-sm">
                  <RewardSummaryLine>
                    Max payout:{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {(winnerCount * simpleSats).toLocaleString()}
                    </span>{" "}
                    sats
                  </RewardSummaryLine>
                  {simpleSats === 0 ? (
                    <CompactStatusMessage variant="info" className="mt-2">
                      Selection-only giveaway. No payout configured.
                    </CompactStatusMessage>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  Set winners and sats per selected engagement type. Totals must
                  stay within your plan limit ({planLimits.maxWinnerCount} max).
                </p>
                <input type="hidden" name="winnerCount" value="1" />
                <div className="border-border/60 grid max-w-xl gap-2 border-t pt-4 text-sm sm:grid-cols-[auto_1fr_1fr]">
                  <span className="text-muted-foreground font-medium">
                    Type
                  </span>
                  <span className="text-muted-foreground font-medium">
                    Winners
                  </span>
                  <span className="text-muted-foreground font-medium">
                    Sats each
                  </span>
                  {ENGAGEMENT_META.map((opt) => (
                    <div
                      key={opt.value}
                      className="text-foreground grid grid-cols-[auto_1fr_1fr] gap-2 sm:contents"
                    >
                      <span className="flex items-center">{opt.label}</span>
                      <input
                        name={`engagementWinners_${opt.value}`}
                        type="number"
                        min={0}
                        max={planLimits.maxWinnerCount}
                        defaultValue={0}
                        className={`${campaignFieldClassNames} w-20`}
                      />
                      <input
                        name={`engagementSats_${opt.value}`}
                        type="number"
                        min={0}
                        defaultValue={0}
                        className={`${campaignFieldClassNames} w-24`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Winner count for selection uses the sum of per-type winners
                  above (or the simple field if all zero — keep advanced rows
                  filled).
                </p>
              </div>
            )}
          </section>

          <GiveawayNewBuilderSelection
            selectionMode={effectiveSelectionMode}
            setSelectionMode={setSelectionMode}
            isFollowGraphScope={isFollowGraphScope}
          />
        </div>

        <GiveawayNewBuilderStickySummary
          scopeType={scopeType}
          periodMode={periodMode}
          selectedTypes={selectedTypes}
          winnerCount={winnerCount}
          rewardMode={effectiveRewardMode}
          simpleSats={simpleSats}
          selectionMode={effectiveSelectionMode}
          planDisplayName={planDisplayName}
          plannedPayoutForFee={plannedPayoutForFee}
          feePreview={feePreview}
          isFollowGraphScope={isFollowGraphScope}
          selectedSinglePostId={selectedSinglePostId}
          actionError={actionError}
          fetcherError={fetcherError}
          isBusy={isBusy}
          onSaveDraft={handleSaveDraft}
        />
      </form>

      <GiveawayNewBuilderPresetTemplates
        planLimits={planLimits}
        presets={presets}
      />
    </div>
  );
}
