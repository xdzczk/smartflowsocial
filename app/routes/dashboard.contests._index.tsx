import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  contestCopy,
  deleteContest,
  duplicateContest,
  formatContestStatusLabel,
  getContestKpiCounts,
  listContestsFiltered,
} from "~/features/contest";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { featureFlags } from "~/lib/feature-flags.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const metric = url.searchParams.get("metric") ?? "all";
  const sort = (url.searchParams.get("sort") ?? "newest") as
    | "newest"
    | "ending"
    | "completed";

  const [contests, kpiCounts] = await Promise.all([
    listContestsFiltered(userId, { status, metric, sort }),
    getContestKpiCounts(userId),
  ]);

  return json({
    contests: contests.map((c) => ({
      id: c.id,
      title: c.title ?? `Contest ${c.id.slice(0, 8)}`,
      status: c.status,
      statusLabel: formatContestStatusLabel(c.status),
      metric: c.rankingMetric,
      endAt: c.contestEndAt.toISOString(),
      winners: c.winnerCount,
      plannedPayoutSats: c.plannedPayoutSats ?? 0,
      updatedAt: c.updatedAt.toISOString(),
    })),
    kpiCounts,
    filters: { status, metric, sort },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

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

export default function ContestsIndexRoute() {
  const data = useLoaderData<typeof loader>();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contests</h1>
        <Link
          className="text-primary text-sm font-medium hover:underline"
          to="/dashboard/contests/new"
        >
          New contest
        </Link>
      </div>

      <div className="border-border bg-muted/30 grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm sm:grid-cols-5">
        <div>
          <p className="text-muted-foreground text-xs">Total</p>
          <p className="text-lg font-semibold">{total}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Draft</p>
          <p className="text-lg font-semibold">{draft}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Live</p>
          <p className="text-lg font-semibold">{live}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Review / payout</p>
          <p className="text-lg font-semibold">{activeReview}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Completed</p>
          <p className="text-lg font-semibold">{done}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Status</span>
          <select
            className="border-border bg-background rounded-md border px-2 py-1.5"
            value={data.filters.status}
            onChange={(e) => {
              setFilter("status", e.target.value);
            }}
          >
            <option value="all">All</option>
            <option value="DRAFT">Draft</option>
            <option value="LIVE">Live</option>
            <option value="ENDED_REVIEW">Ended (review)</option>
            <option value="LOCKED">Locked</option>
            <option value="PAYOUT_IN_PROGRESS">Payout in progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Metric</span>
          <select
            className="border-border bg-background rounded-md border px-2 py-1.5"
            value={data.filters.metric}
            onChange={(e) => {
              setFilter("metric", e.target.value);
            }}
          >
            <option value="all">All</option>
            <option value="REACTIONS">Reactions</option>
            <option value="ZAPS">Zaps</option>
            <option value="SATS_ZAPPED">Sats zapped</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Sort</span>
          <select
            className="border-border bg-background rounded-md border px-2 py-1.5"
            value={data.filters.sort}
            onChange={(e) => {
              setFilter("sort", e.target.value);
            }}
          >
            <option value="newest">Newest</option>
            <option value="ending">Ending soon</option>
            <option value="completed">Recently completed</option>
          </select>
        </label>
      </div>

      {data.contests.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No contests match these filters. Create one or adjust filters above.
        </p>
      ) : (
        <div className="border-border divide-border overflow-hidden rounded-lg border">
          {data.contests.map((contest) => (
            <div
              key={contest.id}
              className="bg-card flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{contest.title}</p>
                <p className="text-muted-foreground text-xs">
                  {contest.statusLabel} · {contest.metric.toLowerCase()} · Ends{" "}
                  {new Date(contest.endAt).toLocaleString()} ·{" "}
                  {contest.plannedPayoutSats.toLocaleString()} sats planned ·{" "}
                  {contest.winners} winner slots
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={`/dashboard/contests/detail/${contest.id}`}
                  className="text-primary text-sm hover:underline"
                >
                  Open
                </Link>
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="duplicate" />
                  <input type="hidden" name="contestId" value={contest.id} />
                  <button
                    type="submit"
                    className="text-muted-foreground text-sm hover:underline"
                  >
                    {contestCopy.duplicate}
                  </button>
                </Form>
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="contestId" value={contest.id} />
                  <button
                    type="submit"
                    className="text-destructive text-sm hover:underline"
                  >
                    Delete
                  </button>
                </Form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
