import { Link } from "@remix-run/react";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

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
    desc: "One note or thread you choose",
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

function reviewScopeLine(
  scopeType: BuilderScopeType,
  periodMode: "days" | "custom"
): string {
  if (scopeType === "PERIOD" && periodMode === "days") {
    return "Last N days (set above)";
  }
  if (scopeType === "PERIOD") return "Custom dates";
  const hit = SCOPE_TYPE_OPTIONS.find((o) => o.value === scopeType);
  return hit?.title ?? scopeType;
}

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
  }>;
  planLimits: {
    maxWinnerCount: number;
    canUseQueueScope: boolean;
    canUsePresets: boolean;
  };
  actionError?: string;
}

function GiveawayNewBuilderStickySummary({
  scopeType,
  periodMode,
  selectedTypes,
  winnerCount,
  rewardMode,
  simpleSats,
  summary,
  selectionMode,
  typeCount,
}: {
  scopeType: BuilderScopeType;
  periodMode: "days" | "custom";
  selectedTypes: string[];
  winnerCount: number;
  rewardMode: "simple" | "advanced";
  simpleSats: number;
  summary: {
    maxPayout: number | null;
    avg: number | null;
    engagementLine: string;
  };
  selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
  typeCount: number;
}) {
  return (
    <aside className="mt-10 space-y-4 lg:mt-0">
      <Card className="lg:sticky lg:top-20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Giveaway summary</CardTitle>
          <CardDescription>Updates as you adjust the builder</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <div>
            <span className="text-foreground font-medium">Scope · </span>
            {asideScopeLine(scopeType, periodMode)}
          </div>
          <div>
            <span className="text-foreground font-medium">Engagement · </span>
            {selectedTypes.length ? selectedTypes.join(", ") : "None selected"}
          </div>
          <div>
            <span className="text-foreground font-medium">Winners · </span>
            {winnerCount} total
            {rewardMode === "simple" && typeCount > 1 ? (
              <span className="block text-xs">
                (split across {typeCount} types in the backend)
              </span>
            ) : null}
          </div>
          <div>
            <span className="text-foreground font-medium">Rewards · </span>
            {rewardMode === "simple" ? (
              simpleSats > 0 ? (
                <>
                  {simpleSats.toLocaleString()} sats × {winnerCount} →{" "}
                  <span className="text-foreground font-semibold">
                    {(simpleSats * winnerCount).toLocaleString()} sats max
                  </span>
                </>
              ) : (
                "Selection only (no sats)"
              )
            ) : (
              "Advanced per-type"
            )}
          </div>
          {summary.avg != null ? (
            <div>
              <span className="text-foreground font-medium">
                Avg per winner ·{" "}
              </span>
              {summary.avg.toLocaleString()} sats
            </div>
          ) : null}
          <div>
            <span className="text-foreground font-medium">Selection · </span>
            {selectionMode === "UNIQUE_USER" ? "Unique user" : "Weighted"}
          </div>
          {winnerCount > 50 ? (
            <p className="text-destructive text-xs">
              Winner count exceeds typical limits — check your plan cap.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
}

function GiveawayNewBuilderPresetTemplates({
  planLimits,
  presets,
}: Pick<GiveawayNewBuilderProps, "planLimits" | "presets">) {
  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <h2 className="text-foreground mb-2 text-sm font-semibold">
        Or use a template
      </h2>
      {!planLimits.canUsePresets ? (
        <p className="text-muted-foreground text-sm">
          Upgrade your plan to save and use giveaway templates.
        </p>
      ) : presets.length > 0 ? (
        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <form
              key={p.id}
              method="post"
              className="border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <input type="hidden" name="intent" value="createFromPreset" />
              <input type="hidden" name="presetId" value={p.id} />
              <div>
                <p className="text-foreground font-medium">{p.name}</p>
                <p className="text-muted-foreground text-xs">
                  {p.scopeType} · {p.winnerCount} winner
                  {p.winnerCount !== 1 ? "s" : ""}
                </p>
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Create from template
              </Button>
            </form>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No templates yet. Save a preset from a giveaway detail page.
        </p>
      )}
    </div>
  );
}

export function GiveawayNewBuilder({
  presets,
  queueTypes,
  recentPosts,
  planLimits,
  actionError,
}: GiveawayNewBuilderProps) {
  const [scopeType, setScopeType] = useState<
    "PERIOD" | "SINGLE_POST" | "FOLLOWERS" | "FOLLOWING"
  >("PERIOD");
  const [periodMode, setPeriodMode] = useState<"days" | "custom">("days");
  const [postSearch, setPostSearch] = useState("");
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

  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return recentPosts;
    return recentPosts.filter((p) => {
      const cap = (p.caption ?? "").toLowerCase();
      return cap.includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [recentPosts, postSearch]);

  const selectedTypes = ENGAGEMENT_META.filter((m) => engagement[m.value]).map(
    (m) => m.value
  );
  const typeCount = Math.max(1, selectedTypes.length);

  const summary = useMemo(() => {
    const maxPayout = rewardMode === "simple" ? winnerCount * simpleSats : null;
    const avg =
      rewardMode === "simple" && winnerCount > 0 && simpleSats > 0
        ? simpleSats
        : null;
    return {
      maxPayout,
      avg,
      engagementLine: selectedTypes.join(", ") || "—",
    };
  }, [rewardMode, winnerCount, simpleSats, selectedTypes]);

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
        method="post"
        className="lg:grid lg:grid-cols-[1fr_min(100%,320px)] lg:items-start lg:gap-8"
      >
        <input type="hidden" name="intent" value="create" />
        <input type="hidden" name="rewardMode" value={rewardMode} />
        <input type="hidden" name="periodMode" value={periodMode} />

        <div className="min-w-0 space-y-10">
          <div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              New giveaway
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Build your campaign in steps. You’ll create a draft, then preview
              winners before locking or paying.
            </p>
            <label htmlFor="giveaway-name" className="sr-only">
              Optional title
            </label>
            <input
              id="giveaway-name"
              name="name"
              type="text"
              placeholder="Optional giveaway title"
              className="border-border bg-background mt-4 w-full max-w-md rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <section className="space-y-4" aria-labelledby="scope-heading">
            <h2
              id="scope-heading"
              className="text-foreground text-lg font-semibold"
            >
              1. What should this giveaway reward?
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {SCOPE_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`border-border bg-card hover:border-primary/40 cursor-pointer rounded-lg border p-4 transition-colors ${
                    scopeType === opt.value
                      ? "border-primary ring-primary/20 ring-2"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="scopeType"
                    value={opt.value}
                    checked={scopeType === opt.value}
                    onChange={() => {
                      setScopeType(opt.value);
                    }}
                    className="sr-only"
                  />
                  <p className="text-foreground font-medium">{opt.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {opt.desc}
                  </p>
                </label>
              ))}
            </div>

            {scopeType === "PERIOD" ? (
              <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-4">
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
                      className="border-border bg-background rounded-md border px-2 py-1 text-sm"
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
                          className="border-border bg-background min-w-[160px] rounded-md border px-2 py-1 text-sm"
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
                        className="border-border bg-background rounded-md border px-2 py-1 text-sm"
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
                        className="border-border bg-background rounded-md border px-2 py-1 text-sm"
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
                          className="border-border bg-background min-w-[160px] rounded-md border px-2 py-1 text-sm"
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
              <div className="border-border bg-muted/20 space-y-2 rounded-lg border p-4">
                <label
                  htmlFor="postSearch"
                  className="text-muted-foreground text-sm"
                >
                  Search posts
                </label>
                <input
                  id="postSearch"
                  type="search"
                  value={postSearch}
                  onChange={(e) => {
                    setPostSearch(e.target.value);
                  }}
                  placeholder="Filter by caption…"
                  className="border-border bg-background mb-2 w-full max-w-md rounded-md border px-3 py-2 text-sm"
                />
                <label
                  htmlFor="postId"
                  className="text-muted-foreground text-sm"
                >
                  Post
                </label>
                <select
                  id="postId"
                  name="postId"
                  className="border-border bg-background max-w-xl rounded-md border px-2 py-2 text-sm"
                  size={Math.min(8, Math.max(3, filteredPosts.length))}
                >
                  <option value="">Select a post</option>
                  {filteredPosts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.caption
                        ? `${p.caption.slice(0, 56)}${p.caption.length > 56 ? "…" : ""}`
                        : `Post ${p.id.slice(0, 8)}`) +
                        ` · ${p.publishedAt.slice(0, 10)}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scopeType === "FOLLOWERS" || scopeType === "FOLLOWING" ? (
              <p className="text-muted-foreground border-border bg-muted/20 rounded-lg border px-4 py-3 text-sm">
                <span className="text-foreground font-medium">Snapshot: </span>
                Eligible accounts use your follow graph at the moment you lock
                winners — not a frozen list from now.
              </p>
            ) : null}
          </section>

          <section className="space-y-4" aria-labelledby="elig-heading">
            <h2
              id="elig-heading"
              className="text-foreground text-lg font-semibold"
            >
              2. Who is eligible?
            </h2>
            <p className="text-muted-foreground text-sm">
              Pick engagement types that count as entries.
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

            <div className="space-y-3">
              <p className="text-foreground text-sm font-medium">Exclude</p>
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

            <div className="border-border space-y-2 rounded-lg border p-4">
              <p className="text-foreground text-sm font-medium">
                Advanced fairness (optional)
              </p>
              <div className="flex flex-wrap gap-4">
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
                    className="border-border bg-background mt-1 block w-28 rounded-md border px-2 py-1 text-sm"
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
                    className="border-border bg-background mt-1 block w-28 rounded-md border px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4" aria-labelledby="reward-heading">
            <h2
              id="reward-heading"
              className="text-foreground text-lg font-semibold"
            >
              3. How should rewards be distributed?
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={rewardMode === "simple" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setRewardMode("simple");
                }}
              >
                Simple payout
              </Button>
              <Button
                type="button"
                variant={rewardMode === "advanced" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setRewardMode("advanced");
                }}
              >
                Customize by engagement type
              </Button>
            </div>

            {rewardMode === "simple" ? (
              <div className="border-border bg-muted/20 flex flex-wrap gap-6 rounded-lg border p-4">
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
                    className="border-border bg-background mt-1 block w-24 rounded-md border px-2 py-1 text-sm"
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
                    className="border-border bg-background mt-1 block w-28 rounded-md border px-2 py-1 text-sm"
                  />
                </div>
                <div className="text-muted-foreground flex flex-col justify-end text-sm">
                  <span>
                    Max payout:{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {(winnerCount * simpleSats).toLocaleString()}
                    </span>{" "}
                    sats
                  </span>
                  {simpleSats === 0 ? (
                    <span className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      No payout amount set — this giveaway will only select
                      winners.
                    </span>
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
                <div className="border-border bg-muted/20 grid max-w-xl gap-2 rounded-lg border p-3 text-sm sm:grid-cols-[auto_1fr_1fr]">
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
                        className="border-border bg-background w-20 rounded-md border px-2 py-1"
                      />
                      <input
                        name={`engagementSats_${opt.value}`}
                        type="number"
                        min={0}
                        defaultValue={0}
                        className="border-border bg-background w-24 rounded-md border px-2 py-1"
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

          <section className="space-y-4" aria-labelledby="sel-heading">
            <h2
              id="sel-heading"
              className="text-foreground text-lg font-semibold"
            >
              4. How should winners be chosen?
            </h2>
            <div className="max-w-md">
              <label
                htmlFor="selectionMode"
                className="text-muted-foreground text-sm"
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
                className="border-border bg-background mt-1 block w-full rounded-md border px-2 py-2 text-sm"
              >
                <option value="UNIQUE_USER">
                  Unique user — one entry per eligible pubkey
                </option>
                <option value="WEIGHTED_BY_ENGAGEMENT">
                  Weighted by engagement — more activity, higher chance
                </option>
              </select>
            </div>
            <div className="border-border rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm">
              <p className="text-foreground font-medium">Fairness</p>
              <p className="text-muted-foreground mt-2">
                Winners are picked at random from eligible participants after
                filters. In unique-user mode each eligible account gets one
                entry. Locked giveaways cannot be edited — preview first, then
                lock when you’re satisfied.
              </p>
            </div>
          </section>

          <section className="space-y-4" aria-labelledby="rev-heading">
            <h2
              id="rev-heading"
              className="text-foreground text-lg font-semibold"
            >
              5. Review
            </h2>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>
                Scope:{" "}
                <span className="text-foreground">
                  {reviewScopeLine(scopeType, periodMode)}
                </span>
              </li>
              <li>
                Engagement:{" "}
                <span className="text-foreground">
                  {summary.engagementLine}
                </span>
              </li>
              <li>
                Winners: <span className="text-foreground">{winnerCount}</span>{" "}
                ·{" "}
                {rewardMode === "simple" && simpleSats > 0 ? (
                  <span className="text-foreground">
                    {simpleSats.toLocaleString()} sats each · max{" "}
                    {summary.maxPayout?.toLocaleString()} sats
                  </span>
                ) : rewardMode === "simple" ? (
                  <span className="text-foreground">selection only</span>
                ) : (
                  <span className="text-foreground">
                    Per-type table (advanced)
                  </span>
                )}
              </li>
              <li>
                Selection:{" "}
                <span className="text-foreground">
                  {selectionMode === "UNIQUE_USER"
                    ? "Unique user"
                    : "Weighted by engagement"}
                </span>
              </li>
            </ul>
            {actionError ? (
              <p className="text-destructive text-sm">{actionError}</p>
            ) : null}
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              Create draft & continue to preview
            </Button>
          </section>
        </div>

        <GiveawayNewBuilderStickySummary
          scopeType={scopeType}
          periodMode={periodMode}
          selectedTypes={selectedTypes}
          winnerCount={winnerCount}
          rewardMode={rewardMode}
          simpleSats={simpleSats}
          summary={summary}
          selectionMode={selectionMode}
          typeCount={typeCount}
        />
      </form>

      <GiveawayNewBuilderPresetTemplates
        planLimits={planLimits}
        presets={presets}
      />
    </div>
  );
}
