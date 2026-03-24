/* eslint-disable jsx-a11y/label-has-associated-control -- Builder form is temporary v1 scaffold to be replaced by shared form controls. */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useRevalidator,
} from "@remix-run/react";
import { useCallback, useMemo, useState } from "react";

import { requireUserId } from "~/features/auth";
import {
  ContestBuilderSummaryRail,
  ContestEmbeddedComposer,
  createContest,
} from "~/features/contest";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { getUserSubscription } from "~/features/payments/data";
import { getPlanDisplayName, getUserPlanType } from "~/features/payments/types";
import type { UserSubscription } from "~/features/payments/types";
import type { ContestEmbedPublishPayload } from "~/features/posts/composer";
import { getPostById, getRecentPublishedPosts } from "~/features/posts/server";
import { loadNewPostData } from "~/features/posts/server/composer";
import { featureFlags } from "~/lib/feature-flags.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const [composerLoader, rawPosts, subscription] = await Promise.all([
    loadNewPostData(userId, null, null),
    getRecentPublishedPosts({ userId, days: 90 }),
    getUserSubscription(userId),
  ]);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const planLabel = getPlanDisplayName(subscription as UserSubscription | null);
  const posts = rawPosts
    .filter((p) => p.nostrEventId != null && p.nostrEventId.trim() !== "")
    .slice(0, 50)
    .map((p) => ({
      id: p.id,
      caption: p.caption ?? null,
      publishedAt:
        p.publishedAt instanceof Date ? p.publishedAt.toISOString() : "",
    }));

  return json({ ...composerLoader, posts, planType, planLabel });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "");
  const sourcePostId = String(formData.get("sourcePostId") ?? "").trim();
  const rankingMetric = String(formData.get("rankingMetric") ?? "ZAPS") as
    | "REACTIONS"
    | "ZAPS"
    | "SATS_ZAPPED";
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

  if (!sourcePostId) {
    return json(
      { error: "Select the published post to use as the contest source." },
      { status: 400 }
    );
  }

  const sourcePost = await getPostById({ id: sourcePostId, userId });
  const sourceNoteId = sourcePost?.nostrEventId?.trim() ?? "";
  if (!sourcePost || !sourceNoteId) {
    return json(
      {
        error:
          "Selected post must be yours and published with a Nostr note id. Create or publish a post, then pick it here.",
      },
      { status: 400 }
    );
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

  const contest = await createContest(userId, {
    title,
    sourceNoteId,
    sourcePostId: sourcePost.id,
    rankingMetric,
    contestEndAt,
    prizeMode,
    winnerCount,
    equalRewardSats: prizeMode === "EQUAL" ? equalRewardSats : null,
    rankRewards: prizeMode === "RANKED" ? rankRewards : null,
    fairnessConfig: {
      excludeMuted: formData.get("excludeMuted") === "on",
      excludeBlocked: formData.get("excludeBlocked") === "on",
      excludeLowTrust: formData.get("excludeLowTrust") === "on",
      excludeNonFollowers: formData.get("excludeNonFollowers") === "on",
      minAccountAgeDays:
        parseInt(String(formData.get("minAccountAgeDays") ?? "0"), 10) ||
        undefined,
      minFollowers:
        parseInt(String(formData.get("minFollowers") ?? "0"), 10) || undefined,
    },
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
    : `Post ${p.id.slice(0, 8)}`;
  const date = p.publishedAt.slice(0, 10);
  return `${caption} · ${date}`;
}

export default function NewContestRoute() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [prizeMode, setPrizeMode] = useState<"EQUAL" | "RANKED">("EQUAL");
  const [winnerCount, setWinnerCount] = useState(3);
  const [postSearch, setPostSearch] = useState("");
  const [selectedSourcePostId, setSelectedSourcePostId] = useState("");
  const [composerSessionKey, setComposerSessionKey] = useState(0);
  const [sourceMode, setSourceMode] = useState<"create" | "existing">(
    "existing"
  );
  const [contestEndAt, setContestEndAt] = useState("");
  const [equalRewardSats, setEqualRewardSats] = useState(1000);
  const [rankRewards, setRankRewards] = useState<number[]>(() =>
    Array(3).fill(0)
  );
  const [rankingMetric, setRankingMetric] = useState<
    "REACTIONS" | "ZAPS" | "SATS_ZAPPED"
  >("ZAPS");
  const [excludeMuted, setExcludeMuted] = useState(false);
  const [excludeBlocked, setExcludeBlocked] = useState(false);
  const [excludeLowTrust, setExcludeLowTrust] = useState(false);
  const [excludeNonFollowers, setExcludeNonFollowers] = useState(false);
  const [minAccountAgeDays, setMinAccountAgeDays] = useState(0);
  const [minFollowers, setMinFollowers] = useState(0);

  const { posts, planType, planLabel } = loaderData;

  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => {
      const cap = (p.caption ?? "").toLowerCase();
      return cap.includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [postSearch, posts]);

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
      revalidator.revalidate();
    },
    [revalidator]
  );

  const canSubmit = selectedSourcePostId.trim() !== "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">New Contest</h1>
        <p className="text-muted-foreground text-sm">
          Source post → ranking metric → deadline → prize structure → fairness.
        </p>
      </div>

      {actionData?.error ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {actionData.error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setSourceMode("create");
          }}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            sourceMode === "create"
              ? "border-primary bg-primary/10"
              : "border-border bg-background"
          }`}
        >
          Create new contest post
        </button>
        <button
          type="button"
          onClick={() => {
            setSourceMode("existing");
          }}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            sourceMode === "existing"
              ? "border-primary bg-primary/10"
              : "border-border bg-background"
          }`}
        >
          Use existing published post
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr,minmax(260px,320px)] lg:items-start lg:gap-8">
        <Form method="post" className="min-w-0 space-y-6">
          <section className="space-y-2">
            <label className="text-sm font-medium" htmlFor="title">
              Contest title
            </label>
            <input
              id="title"
              name="title"
              className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <span className="text-sm font-medium">Source post</span>
              <p className="text-muted-foreground text-xs">
                Each direct reply to this note is an entry. Publish a new note
                or pick an existing published post.
              </p>
            </div>
            {sourceMode === "create" ? (
              <ContestEmbeddedComposer
                loaderData={loaderData as Record<string, unknown>}
                composerKey={composerSessionKey}
                onEmbedPublishSuccess={onContestComposerPublished}
              />
            ) : null}
            {sourceMode === "create" && posts.length === 0 ? (
              <p className="text-muted-foreground border-border bg-muted/20 rounded-md border px-3 py-2 text-sm">
                No eligible published posts yet (last 90 days, with a Nostr note
                id). Publish with the composer — your post will appear here for
                selection.
              </p>
            ) : null}
            {sourceMode === "existing" || posts.length > 0 ? (
              <>
                <label
                  className="text-muted-foreground text-sm"
                  htmlFor="postSearch"
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
                <label className="text-sm font-medium" htmlFor="sourcePostId">
                  Choose published post
                </label>
                {filteredPosts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {posts.length === 0
                      ? "No published posts with a Nostr id yet."
                      : "No posts match your search."}
                  </p>
                ) : (
                  <select
                    id="sourcePostId"
                    name="sourcePostId"
                    required={sourceMode === "existing"}
                    value={selectedSourcePostId}
                    onChange={(e) => {
                      setSelectedSourcePostId(e.target.value);
                    }}
                    className="border-border bg-background max-w-xl rounded-md border px-2 py-2 text-sm"
                    size={Math.min(8, Math.max(3, filteredPosts.length))}
                  >
                    <option value="">Select a post…</option>
                    {filteredPosts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatPostOptionLabel(p)}
                      </option>
                    ))}
                  </select>
                )}
              </>
            ) : null}
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rankingMetric">
                Ranking metric
              </label>
              <select
                id="rankingMetric"
                name="rankingMetric"
                value={rankingMetric}
                onChange={(e) => {
                  setRankingMetric(
                    e.target.value as "REACTIONS" | "ZAPS" | "SATS_ZAPPED"
                  );
                }}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="REACTIONS">Most reactions</option>
                <option value="ZAPS">Most zaps</option>
                <option value="SATS_ZAPPED">Most sats zapped</option>
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
                required
                value={contestEndAt}
                onChange={(e) => {
                  setContestEndAt(e.target.value);
                }}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </section>

          <section className="space-y-3">
            <label className="text-sm font-medium">Prize structure</label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="border-border bg-card flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  type="radio"
                  name="prizeMode"
                  value="EQUAL"
                  checked={prizeMode === "EQUAL"}
                  onChange={() => {
                    setPrizeMode("EQUAL");
                  }}
                />
                Equal rewards
              </label>
              <label className="border-border bg-card flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  type="radio"
                  name="prizeMode"
                  value="RANKED"
                  checked={prizeMode === "RANKED"}
                  onChange={() => {
                    setPrizeMode("RANKED");
                  }}
                />
                Rank-based rewards
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm" htmlFor="winnerCount">
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
                  className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm" htmlFor="equalRewardSats">
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
                  className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
            {prizeMode === "RANKED" ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  Set sats for each rank from 1 through {winnerCount}. Unused
                  ranks can be 0.
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
                          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-2">
            <label className="text-sm font-medium">Fairness exclusions</label>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label>
                <input
                  type="checkbox"
                  name="excludeMuted"
                  checked={excludeMuted}
                  onChange={(e) => {
                    setExcludeMuted(e.target.checked);
                  }}
                />{" "}
                Exclude muted
              </label>
              <label>
                <input
                  type="checkbox"
                  name="excludeBlocked"
                  checked={excludeBlocked}
                  onChange={(e) => {
                    setExcludeBlocked(e.target.checked);
                  }}
                />{" "}
                Exclude blocked
              </label>
              <label>
                <input
                  type="checkbox"
                  name="excludeLowTrust"
                  checked={excludeLowTrust}
                  onChange={(e) => {
                    setExcludeLowTrust(e.target.checked);
                  }}
                />{" "}
                Exclude low trust
              </label>
              <label>
                <input
                  type="checkbox"
                  name="excludeNonFollowers"
                  checked={excludeNonFollowers}
                  onChange={(e) => {
                    setExcludeNonFollowers(e.target.checked);
                  }}
                />{" "}
                Exclude non-followers
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="minAccountAgeDays"
                type="number"
                min={0}
                placeholder="Min account age (days)"
                value={minAccountAgeDays}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setMinAccountAgeDays(Number.isFinite(n) ? Math.max(0, n) : 0);
                }}
                className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              />
              <input
                name="minFollowers"
                type="number"
                min={0}
                placeholder="Min followers"
                value={minFollowers}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setMinFollowers(Number.isFinite(n) ? Math.max(0, n) : 0);
                }}
                className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:pointer-events-none disabled:opacity-50"
            >
              Create contest draft
            </button>
            <Link
              to="/dashboard/contests"
              className="text-muted-foreground text-sm hover:underline"
            >
              Cancel
            </Link>
          </div>
        </Form>

        <ContestBuilderSummaryRail
          planType={planType}
          planLabel={planLabel}
          sourceMode={sourceMode}
          hasSourcePost={selectedSourcePostId.trim() !== ""}
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
        />
      </div>
    </div>
  );
}
/* eslint-enable jsx-a11y/label-has-associated-control */
