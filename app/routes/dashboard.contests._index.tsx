import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { requireUserId } from "~/features/auth";
import {
  contestCopy,
  deleteContest,
  duplicateContest,
  getContestEntryCounts,
  formatContestStatusLabel,
  getContestKpiCounts,
  getContestSourcePostThumbnails,
  listContestsFiltered,
} from "~/features/contest";
import { requireAnySubscription } from "~/features/payments";
import { featureFlags } from "~/lib/feature-flags.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const metric = url.searchParams.get("metric") ?? "all";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = (url.searchParams.get("sort") ?? "newest") as
    | "newest"
    | "ending"
    | "completed";

  const [contests, kpiCounts] = await Promise.all([
    listContestsFiltered(userId, { status, metric, sort }),
    getContestKpiCounts(userId),
  ]);
  const filteredByQ = q
    ? contests.filter((c) => (c.title ?? "").toLowerCase().includes(q))
    : contests;
  const contestIds = filteredByQ.map((c) => c.id);
  const entryCounts = await getContestEntryCounts(userId, contestIds);
  const totalSatsPlanned = filteredByQ.reduce(
    (sum, c) => sum + (c.plannedPayoutSats ?? 0),
    0
  );
  const totalEntries = filteredByQ.reduce(
    (sum, c) => sum + (entryCounts[c.id] ?? 0),
    0
  );

  const sourcePostIds = [
    ...new Set(
      filteredByQ
        .map((c) => c.sourcePostId)
        .filter(
          (id): id is string => typeof id === "string" && id.trim() !== ""
        )
    ),
  ];
  const sourceThumbByPostId = await getContestSourcePostThumbnails(
    userId,
    sourcePostIds
  );

  return json({
    contests: filteredByQ.map((c) => ({
      id: c.id,
      title: c.title ?? `Contest ${c.id.slice(0, 8)}`,
      status: c.status,
      statusLabel: formatContestStatusLabel(c.status),
      metric: c.rankingMetric,
      endAt: c.contestEndAt.toISOString(),
      winners: c.winnerCount,
      plannedPayoutSats: c.plannedPayoutSats ?? 0,
      entries: entryCounts[c.id] ?? 0,
      updatedAt: c.updatedAt.toISOString(),
      sourceThumbUrl: c.sourcePostId
        ? (sourceThumbByPostId[c.sourcePostId] ?? null)
        : null,
    })),
    totals: { totalSatsPlanned, totalEntries },
    kpiCounts,
    filters: { status, metric, sort, q },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "delete") {
    const contestId = formData.get("contestId");
    if (typeof contestId !== "string" || !contestId.trim()) {
      return json({ error: "Missing contest id" }, { status: 400 });
    }
    const result = await deleteContest(userId, contestId);
    if (!result.success) {
      return json({ error: result.error ?? "Delete failed" }, { status: 400 });
    }
    return redirect("/dashboard/contests");
  }
  if (intent === "duplicate") {
    const contestId = formData.get("contestId");
    if (typeof contestId !== "string" || !contestId.trim()) {
      return json({ error: "Missing contest id" }, { status: 400 });
    }
    const result = await duplicateContest(userId, contestId);
    if (!result.success || !result.newId) {
      return json(
        { error: result.error ?? "Duplicate failed" },
        { status: 400 }
      );
    }
    return redirect(`/dashboard/contests/detail/${result.newId}`);
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

function contestStatusPillClass(status: string): string {
  const amberStatusClass = "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  const map: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    LIVE: "bg-blue-500/15 text-blue-800 dark:text-blue-200",
    ENDED_REVIEW: amberStatusClass,
    LOCKED: amberStatusClass,
    PAYOUT_IN_PROGRESS: amberStatusClass,
    COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    CANCELLED: "bg-destructive/15 text-destructive",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function contestStatusDotClass(status: string): string {
  const amber = "bg-amber-500";
  const map: Record<string, string> = {
    DRAFT: "bg-muted-foreground",
    LIVE: "bg-blue-500",
    ENDED_REVIEW: amber,
    LOCKED: amber,
    PAYOUT_IN_PROGRESS: amber,
    COMPLETED: "bg-emerald-500",
    CANCELLED: "bg-destructive",
  };
  return map[status] ?? "bg-muted-foreground";
}

function contestRowTitle(title: string | null | undefined, id: string): string {
  const trimmed = title?.trim();
  if (trimmed === undefined || trimmed === "") {
    return `Contest ${id.slice(0, 8)}`;
  }
  return trimmed;
}

function contestCanDeleteFromList(status: string): boolean {
  return (
    status !== "LOCKED" &&
    status !== "PAYOUT_IN_PROGRESS" &&
    status !== "COMPLETED"
  );
}

export default function ContestsIndexRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const setFilter = (key: "status" | "metric" | "sort", value: string) => {
    const next = new URLSearchParams(searchParams);
    if ((key === "status" || key === "metric") && value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    navigate(`/dashboard/contests?${next.toString()}`);
  };
  const k = data.kpiCounts;
  const draft = k["DRAFT"] ?? 0;
  const live = k["LIVE"] ?? 0;
  const activeReview =
    (k["ENDED_REVIEW"] ?? 0) +
    (k["LOCKED"] ?? 0) +
    (k["PAYOUT_IN_PROGRESS"] ?? 0);
  const done = k["COMPLETED"] ?? 0;
  const cancelled = k["CANCELLED"] ?? 0;
  const total = draft + live + activeReview + done + cancelled;
  const review = activeReview;
  const hasAnyContests = total > 0;

  return (
    <div className="space-y-6">
      {actionData?.error ? (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {actionData.error}
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-semibold tracking-tight">
            Contests
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Run live competitions, rank entries fairly, and track payout status.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/dashboard/contests/new">New contest</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total contests</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Live now</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{live}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting review</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{review}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total sats planned</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.totals.totalSatsPlanned.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total entries</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.totals.totalEntries.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Form
        method="get"
        replace
        className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="c-q"
              className="text-muted-foreground mb-1 block text-xs font-medium"
            >
              Search
            </label>
            <input
              id="c-q"
              name="q"
              type="search"
              defaultValue={data.filters.q}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                const value = e.target.value.trim();
                if (!value) next.delete("q");
                else next.set("q", value);
                navigate(`/dashboard/contests?${next.toString()}`);
              }}
              placeholder="Search by title…"
              className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="c-status"
              className="text-muted-foreground mb-1 block text-xs font-medium"
            >
              Status
            </label>
            <select
              id="c-status"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              value={data.filters.status}
              onChange={(e) => {
                setFilter("status", e.target.value);
              }}
            >
              <option value="all">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="LIVE">Live</option>
              <option value="ENDED_REVIEW">Ended (review)</option>
              <option value="LOCKED">Locked</option>
              <option value="PAYOUT_IN_PROGRESS">Payout in progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="c-metric"
              className="text-muted-foreground mb-1 block text-xs font-medium"
            >
              Metric
            </label>
            <select
              id="c-metric"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              value={data.filters.metric}
              onChange={(e) => {
                setFilter("metric", e.target.value);
              }}
            >
              <option value="all">All metrics</option>
              <option value="REACTIONS">Reactions</option>
              <option value="ZAPS">Zaps</option>
              <option value="SATS_ZAPPED">Sats zapped</option>
              <option value="REPLIES">Replies</option>
              <option value="REPOSTS">Reposts</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="c-sort"
              className="text-muted-foreground mb-1 block text-xs font-medium"
            >
              Sort
            </label>
            <select
              id="c-sort"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              value={data.filters.sort}
              onChange={(e) => {
                setFilter("sort", e.target.value);
              }}
            >
              <option value="newest">Newest</option>
              <option value="ending">Ending soon</option>
              <option value="completed">Recently completed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Apply
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/dashboard/contests">Reset</Link>
            </Button>
          </div>
        </div>
      </Form>

      {!hasAnyContests ? (
        <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-foreground font-medium">No contests yet</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Create your first contest to rank entries and reward winners.
          </p>
          <Button asChild className="mt-4">
            <Link to="/dashboard/contests/new">New contest</Link>
          </Button>
        </div>
      ) : data.contests.length > 0 ? (
        <>
          <div className="border-border bg-card hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-border text-muted-foreground border-b text-xs uppercase">
                <tr>
                  <th className="w-12 px-2 py-3 font-medium" aria-hidden>
                    <span className="sr-only">Source</span>
                  </th>
                  <th className="px-4 py-3 font-medium">Contest</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Metric</th>
                  <th className="px-4 py-3 font-medium">Entries</th>
                  <th className="px-4 py-3 font-medium">Winners / sats</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.contests.map((contest) => {
                  const canDelete = contestCanDeleteFromList(contest.status);
                  return (
                    <tr
                      key={contest.id}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => {
                        navigate(`/dashboard/contests/detail/${contest.id}`);
                      }}
                    >
                      <td className="w-12 px-2 py-2 align-middle">
                        <div className="border-border bg-muted/50 size-9 overflow-hidden rounded-md border">
                          {contest.sourceThumbUrl ? (
                            <img
                              src={contest.sourceThumbUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                              —
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-foreground font-medium">
                          {contestRowTitle(contest.title, contest.id)}
                        </span>
                        <p className="text-muted-foreground text-xs">
                          Ends{" "}
                          {new Date(contest.endAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${contestStatusPillClass(contest.status)}`}
                        >
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${contestStatusDotClass(contest.status)}`}
                            aria-hidden
                          />
                          {contest.statusLabel}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-xs">
                        {contest.metric.toLowerCase()}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {contest.entries.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {contest.winners} winners
                        <br />
                        <span className="text-muted-foreground">
                          {contest.plannedPayoutSats.toLocaleString()} sats
                          planned
                        </span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-xs">
                        {new Date(contest.updatedAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to={`/dashboard/contests/detail/${contest.id}`}
                            >
                              Open
                            </Link>
                          </Button>
                          <Form
                            method="post"
                            action="/dashboard/contests"
                            className="inline"
                          >
                            <input
                              type="hidden"
                              name="intent"
                              value="duplicate"
                            />
                            <input
                              type="hidden"
                              name="contestId"
                              value={contest.id}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              {contestCopy.duplicate}
                            </Button>
                          </Form>
                          <Form
                            method="post"
                            action="/dashboard/contests"
                            className="inline"
                          >
                            <input type="hidden" name="intent" value="delete" />
                            <input
                              type="hidden"
                              name="contestId"
                              value={contest.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              disabled={!canDelete}
                              title={
                                canDelete
                                  ? undefined
                                  : "Cannot delete locked, payout-in-progress, or completed contests"
                              }
                              className="text-destructive hover:text-destructive disabled:opacity-50"
                            >
                              Delete
                            </Button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="border-border bg-card divide-border divide-y rounded-lg border md:hidden">
            {data.contests.map((contest) => {
              const canDelete = contestCanDeleteFromList(contest.status);
              return (
                /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- whole card opens detail; action strip stops propagation */
                <li
                  key={contest.id}
                  className="hover:bg-muted/30 cursor-pointer p-4 transition-colors"
                  onClick={() => {
                    navigate(`/dashboard/contests/detail/${contest.id}`);
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="border-border bg-muted/50 size-12 shrink-0 overflow-hidden rounded-full border">
                      {contest.sourceThumbUrl ? (
                        <img
                          src={contest.sourceThumbUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                          —
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground font-medium">
                        {contestRowTitle(contest.title, contest.id)}
                      </span>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${contestStatusPillClass(contest.status)}`}
                        >
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${contestStatusDotClass(contest.status)}`}
                            aria-hidden
                          />
                          {contest.statusLabel}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {contest.metric.toLowerCase()} · Ends{" "}
                        {new Date(contest.endAt).toLocaleDateString()}
                      </p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {contest.winners} winners ·{" "}
                        {contest.plannedPayoutSats.toLocaleString()} sats
                        planned · {contest.entries.toLocaleString()} entries
                      </p>
                    </div>
                  </div>
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stop propagation to parent li */}
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Button size="sm" variant="secondary" asChild>
                      <Link to={`/dashboard/contests/detail/${contest.id}`}>
                        Open
                      </Link>
                    </Button>
                    <Form
                      method="post"
                      action="/dashboard/contests"
                      className="inline"
                    >
                      <input type="hidden" name="intent" value="duplicate" />
                      <input
                        type="hidden"
                        name="contestId"
                        value={contest.id}
                      />
                      <Button type="submit" size="sm" variant="outline">
                        {contestCopy.duplicate}
                      </Button>
                    </Form>
                    <Form
                      method="post"
                      action="/dashboard/contests"
                      className="inline"
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input
                        type="hidden"
                        name="contestId"
                        value={contest.id}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={!canDelete}
                        title={
                          canDelete
                            ? undefined
                            : "Cannot delete locked, payout-in-progress, or completed contests"
                        }
                        className="text-destructive disabled:opacity-50"
                      >
                        Delete
                      </Button>
                    </Form>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-foreground font-medium">
            No contests match filters
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Try clearing filters or create a new contest to reward top replies.
          </p>
          <Button asChild className="mt-4">
            <Link to="/dashboard/contests/new">New contest</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
