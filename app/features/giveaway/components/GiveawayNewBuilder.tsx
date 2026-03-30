import {
  Link,
  useFetcher,
  useNavigate,
  useNavigation,
  useRevalidator,
} from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CampaignSectionHeader,
  ChoiceTileGroup,
  CompactStatusMessage,
  PublishedPostPickerGrid,
  RewardSummaryLine,
  SourcePostModule,
  campaignFieldClassNames,
  campaignSelectClassNames,
} from "~/features/campaign-ui";
import {
  computeFinalizationFeeSats,
  getFinalizationFeeRateBps,
} from "~/features/giveaway/giveaway-finalization-fee.shared";
import type { ContestEmbedPublishPayload } from "~/features/posts/composer";
import { getNowForDateTimeLocal } from "~/lib/temporal";

import {
  ALL_GIVEAWAY_ENGAGEMENT_TYPES,
  scopeAllowsEngagementEntryTypePick,
  scopeIsFollowGraphAccountPool,
} from "../types";

import {
  DEFAULT_ENGAGEMENT_ALL,
  ENGAGEMENT_META,
  GIVEAWAY_SINGLE_POST_SOURCE_OPTIONS,
  GiveawayNewBuilderPresetTemplates,
  GiveawayNewBuilderSelection,
  GiveawayNewBuilderStickySummary,
  SCOPE_TYPE_OPTIONS,
  type GiveawayNewBuilderProps,
} from "./giveaway-new-builder";
import { GiveawayEmbeddedComposer } from "./GiveawayEmbeddedComposer";

export type { GiveawayNewBuilderProps };

/* eslint-disable-next-line sonarjs/cognitive-complexity -- builder form + rail + single-post embed */
export function GiveawayNewBuilder({
  presets,
  queueTypes,
  recentPosts,
  planLimits,
  planType,
  planDisplayName,
  composerLoader,
  userTimezone,
  actionError,
}: GiveawayNewBuilderProps) {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const formRef = useRef<HTMLFormElement>(null);
  const embedApiRef = useRef<{
    publishNow: () => void;
    schedulePost: () => void;
  } | null>(null);
  const pendingGiveawaySubmitRef = useRef(false);
  const saveFetcher = useFetcher<{
    ok?: boolean;
    giveawayId?: string;
    error?: string;
  }>();
  const createAfterPublishFetcher = useFetcher<{ error?: string }>();

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
  const isCreateAfterPublishSubmitting =
    createAfterPublishFetcher.state !== "idle";
  const isBusy =
    isSubmitting || isSaveSubmitting || isCreateAfterPublishSubmitting;

  const fetcherError =
    navigation.state === "submitting"
      ? undefined
      : saveFetcher.state === "idle" &&
          saveFetcher.data &&
          "error" in saveFetcher.data &&
          typeof saveFetcher.data.error === "string"
        ? saveFetcher.data.error
        : undefined;

  const createAfterPublishError =
    createAfterPublishFetcher.state === "idle" &&
    createAfterPublishFetcher.data &&
    "error" in createAfterPublishFetcher.data &&
    typeof createAfterPublishFetcher.data.error === "string"
      ? createAfterPublishFetcher.data.error
      : undefined;

  const combinedFetcherError = fetcherError ?? createAfterPublishError;

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
  const [singlePostSourceMode, setSinglePostSourceMode] = useState<
    "create" | "existing"
  >("existing");
  const [composerSessionKey, setComposerSessionKey] = useState(0);
  const [sourcePostLaunchMode, setSourcePostLaunchMode] = useState<
    "now" | "schedule"
  >("now");
  const [scheduledSourcePostFor, setScheduledSourcePostFor] = useState(() =>
    getNowForDateTimeLocal(userTimezone)
  );
  const [scheduleCheckNow] = useState(() => Date.now());

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

  useEffect(() => {
    if (scopeType !== "SINGLE_POST" || singlePostSourceMode !== "create") {
      pendingGiveawaySubmitRef.current = false;
    }
  }, [scopeType, singlePostSourceMode]);

  const useRailPublishPrimary =
    scopeType === "SINGLE_POST" && singlePostSourceMode === "create";

  const scheduleTimeOk =
    scheduledSourcePostFor.trim() !== "" &&
    new Date(scheduledSourcePostFor).getTime() > scheduleCheckNow;
  const scheduleOk = sourcePostLaunchMode === "now" || scheduleTimeOk;

  const publishPrimaryDisabled = useMemo(() => {
    if (!useRailPublishPrimary) return false;
    if (sourcePostLaunchMode === "schedule" && !scheduleOk) return true;
    if (!isFollowGraphScope && selectedTypes.length === 0) return true;
    return false;
  }, [
    useRailPublishPrimary,
    sourcePostLaunchMode,
    scheduleOk,
    isFollowGraphScope,
    selectedTypes.length,
  ]);

  const publishPrimaryLabel = useMemo(() => {
    if (!useRailPublishPrimary) return "Create draft & continue to preview";
    return sourcePostLaunchMode === "now"
      ? "Publish post & create draft"
      : "Schedule post & create draft";
  }, [useRailPublishPrimary, sourcePostLaunchMode]);

  const railOutcomeHeadline = useMemo(() => {
    if (!useRailPublishPrimary) return "Ready to continue";
    return sourcePostLaunchMode === "now"
      ? "Publishes the source post now, then opens giveaway preview."
      : "Schedules the announcement; preview opens after the note publishes.";
  }, [useRailPublishPrimary, sourcePostLaunchMode]);

  const onGiveawayEmbedPublish = useCallback(
    (payload: ContestEmbedPublishPayload) => {
      if (payload.postId) {
        setSelectedSinglePostId(payload.postId);
      }
      setComposerSessionKey((k) => k + 1);
      try {
        localStorage.removeItem("composer-giveaway-embedded-draft");
      } catch {
        /* ignore */
      }
      if (
        pendingGiveawaySubmitRef.current &&
        formRef.current &&
        typeof payload.postId === "string"
      ) {
        pendingGiveawaySubmitRef.current = false;
        const fd = new FormData(formRef.current);
        fd.set("postId", payload.postId);
        fd.set("intent", "create");
        fd.delete("responseMode");
        createAfterPublishFetcher.submit(fd, { method: "post" });
      }
      revalidator.revalidate();
    },
    [createAfterPublishFetcher, revalidator]
  );

  const handlePublishPrimaryClick = useCallback(() => {
    if (publishPrimaryDisabled || isBusy) return;
    pendingGiveawaySubmitRef.current = true;
    if (sourcePostLaunchMode === "now") {
      embedApiRef.current?.publishNow();
    } else {
      embedApiRef.current?.schedulePost();
    }
  }, [publishPrimaryDisabled, isBusy, sourcePostLaunchMode]);

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
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8 sm:gap-y-2">
                    <div className="flex min-w-0 flex-col gap-1 sm:w-[min(100%,14rem)]">
                      <label
                        htmlFor="periodDays"
                        className="text-muted-foreground text-xs font-medium"
                      >
                        Period
                      </label>
                      <select
                        id="periodDays"
                        name="periodDays"
                        className={campaignSelectClassNames}
                        defaultValue="7"
                      >
                        {[7, 14, 30].map((d) => (
                          <option key={d} value={d}>
                            Last {d} days
                          </option>
                        ))}
                      </select>
                    </div>
                    {planLimits.canUseQueueScope ? (
                      <div className="flex min-w-0 flex-col gap-1 sm:w-[min(100%,16rem)]">
                        <label
                          htmlFor="queueId"
                          className="text-muted-foreground text-xs font-medium"
                        >
                          Queue
                        </label>
                        <select
                          id="queueId"
                          name="queueId"
                          className={campaignSelectClassNames}
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
                <SourcePostModule
                  id="giveaway-single-post-heading"
                  title="Source post"
                  description="Engagement on this note only — not nested replies deeper in the thread."
                  compactTiles
                  mode={singlePostSourceMode}
                  onModeChange={(m) => {
                    setSinglePostSourceMode(m);
                    if (m === "create") {
                      setSelectedSinglePostId("");
                    }
                  }}
                  choiceGroupName="_giveawaySinglePostSourceMode"
                  options={GIVEAWAY_SINGLE_POST_SOURCE_OPTIONS}
                  errorMessage={
                    singlePostSourceMode === "existing" &&
                    !selectedSinglePostId.trim()
                      ? "Choose a published post."
                      : singlePostSourceMode === "create" &&
                          !selectedSinglePostId.trim()
                        ? "Publish the giveaway post from the composer, then create the draft."
                        : null
                  }
                  createBody={
                    <div className="space-y-3">
                      <GiveawayEmbeddedComposer
                        loaderData={composerLoader}
                        composerKey={composerSessionKey}
                        contestRailLaunchMode={sourcePostLaunchMode}
                        contestRailScheduledFor={scheduledSourcePostFor}
                        onEmbedActionsReady={(api) => {
                          embedApiRef.current = api;
                        }}
                        onEmbedPublishSuccess={onGiveawayEmbedPublish}
                      />
                      {selectedSinglePostId.trim() ? (
                        <CompactStatusMessage variant="info">
                          Source post set — you can create the giveaway draft
                          below.
                        </CompactStatusMessage>
                      ) : null}
                    </div>
                  }
                  existingBody={
                    <PublishedPostPickerGrid
                      posts={recentPosts}
                      value={selectedSinglePostId}
                      onValueChange={setSelectedSinglePostId}
                      searchInputId="giveaway-single-post-search"
                      emptyPostsMessage="No published posts in the last 90 days."
                      emptyFilterMessage="No posts match your search."
                    />
                  }
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
              <div className="border-border/60 space-y-3 border-t pt-4">
                <div className="flex flex-wrap gap-6 sm:gap-8">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="winnerCount"
                      className="text-muted-foreground text-xs font-medium"
                    >
                      Winners
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
                      className={`${campaignFieldClassNames} block w-24`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="simpleSatsPerWinner"
                      className="text-muted-foreground text-xs font-medium"
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
                      className={`${campaignFieldClassNames} block w-28`}
                    />
                  </div>
                </div>
                <RewardSummaryLine>
                  Max payout{" "}
                  <span className="text-foreground font-semibold tabular-nums">
                    {(winnerCount * simpleSats).toLocaleString()}
                  </span>{" "}
                  sats
                </RewardSummaryLine>
                {simpleSats === 0 ? (
                  <p className="text-muted-foreground/85 text-[11px] leading-snug">
                    Selection-only — no payout.
                  </p>
                ) : null}
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
          singlePostSourceMode={singlePostSourceMode}
          actionError={actionError}
          fetcherError={combinedFetcherError}
          isBusy={isBusy}
          onSaveDraft={handleSaveDraft}
          userTimezone={userTimezone}
          sourcePostLaunchMode={sourcePostLaunchMode}
          onSourcePostLaunchModeChange={setSourcePostLaunchMode}
          scheduledSourcePostFor={scheduledSourcePostFor}
          onScheduledSourcePostForChange={setScheduledSourcePostFor}
          useRailPublishPrimary={useRailPublishPrimary}
          publishPrimaryLabel={publishPrimaryLabel}
          publishPrimaryDisabled={publishPrimaryDisabled}
          onPublishPrimaryClick={handlePublishPrimaryClick}
          outcomeHeadline={railOutcomeHeadline}
        />
      </form>

      <GiveawayNewBuilderPresetTemplates
        planLimits={planLimits}
        presets={presets}
      />
    </div>
  );
}
