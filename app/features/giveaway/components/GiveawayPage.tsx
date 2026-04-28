import { Form, Link, useFetcher } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import {
  campaignFieldClassNames,
  campaignSelectClassNames,
} from "~/features/campaign-ui";
import { PublishingPageHeader } from "~/features/posts/ui";
import { cn } from "~/lib/utils";

import { giveawayStatusPillClass } from "../giveaway-status-ui";
import { scopeIsFollowGraphAccountPool } from "../types";

const GIVEAWAY_SELECT_FULL_WIDTH_CLASS = "w-full min-w-[9rem]";

function engagementLabel(t: string): string {
  const m: Record<string, string> = {
    REACTION: "Reaction",
    REPOST: "Repost",
    COMMENT: "Comment",
    ZAP: "Zap",
  };
  return m[t] ?? t;
}

function giveawayRowTitle(name: string | null | undefined, id: string): string {
  const trimmed = name?.trim();
  if (trimmed === undefined || trimmed === "") {
    return `Giveaway ${id.slice(0, 8)}`;
  }
  return trimmed;
}

export interface GiveawayListRow {
  id: string;
  name: string | null;
  status: string;
  statusLabel: string;
  scopeType: string;
  scopeSummaryLabel: string;
  winnerCount: number;
  snapshotWinnerCount: number;
  engagementTypes: string[];
  budgetSats: number;
  createdAt: string;
  updatedAt: string;
  payoutSettled: number;
  payoutTotal: number;
  canDelete: boolean;
}

export interface GiveawayPageProps {
  giveaways: GiveawayListRow[];
  kpis: {
    total: number;
    pendingPayout: number;
    completed: number;
    totalSatsPaid: number;
    totalWinnersSelected: number;
  };
  filters: {
    q: string;
    status: string;
    scope: string;
    sort: string;
    from: string;
    to: string;
  };
}

export default function GiveawayPage({
  giveaways,
  kpis,
  filters,
}: GiveawayPageProps) {
  const dupFetcher = useFetcher();
  const delFetcher = useFetcher();

  return (
    <div className="space-y-6">
      <PublishingPageHeader
        title="Giveaways"
        subtitle="Reward real engagement, pick winners fairly, and track payout status."
        actions={
          <Button asChild>
            <Link to="/dashboard/giveaway/new">New giveaway</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2">
            <CardDescription>Total giveaways</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.total}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2">
            <CardDescription>Pending payout</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.pendingPayout}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.completed}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2">
            <CardDescription>Total sats paid</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.totalSatsPaid.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2">
            <CardDescription>Winners selected</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.totalWinnersSelected}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Form
        method="get"
        replace
        className="border-border bg-surface shadow-1 flex flex-col gap-3 rounded-xl border p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="g-q"
              className="text-text-secondary mb-1 block text-xs font-medium"
            >
              Search
            </label>
            <input
              id="g-q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Title or id…"
              className={campaignFieldClassNames}
            />
          </div>
          <div>
            <label
              htmlFor="g-status"
              className="text-text-secondary mb-1 block text-xs font-medium"
            >
              Status
            </label>
            <select
              id="g-status"
              name="status"
              defaultValue={filters.status}
              className={cn(
                campaignSelectClassNames,
                GIVEAWAY_SELECT_FULL_WIDTH_CLASS
              )}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PREVIEWED">Preview</option>
              <option value="LOCKED">Locked</option>
              <option value="PAID_OUT">Paid out</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="g-scope"
              className="text-text-secondary mb-1 block text-xs font-medium"
            >
              Scope
            </label>
            <select
              id="g-scope"
              name="scope"
              defaultValue={filters.scope}
              className={cn(
                campaignSelectClassNames,
                GIVEAWAY_SELECT_FULL_WIDTH_CLASS
              )}
            >
              <option value="">All scopes</option>
              <option value="PERIOD">Period</option>
              <option value="SINGLE_POST">Single post</option>
              <option value="QUEUE">Queue</option>
              <option value="FOLLOWERS">Followers</option>
              <option value="FOLLOWING">Following</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="g-sort"
              className="text-text-secondary mb-1 block text-xs font-medium"
            >
              Sort
            </label>
            <select
              id="g-sort"
              name="sort"
              defaultValue={filters.sort}
              className={cn(
                campaignSelectClassNames,
                GIVEAWAY_SELECT_FULL_WIDTH_CLASS
              )}
            >
              <option value="newest">Newest</option>
              <option value="payout_pending">Payout pending</option>
              <option value="completed">Completed first</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="g-from"
              className="text-text-secondary mb-1 block text-xs font-medium"
            >
              From
            </label>
            <input
              id="g-from"
              name="from"
              type="date"
              defaultValue={filters.from}
              className={cn(campaignFieldClassNames, "w-auto min-w-[9rem]")}
            />
          </div>
          <div>
            <label
              htmlFor="g-to"
              className="text-text-secondary mb-1 block text-xs font-medium"
            >
              To
            </label>
            <input
              id="g-to"
              name="to"
              type="date"
              defaultValue={filters.to}
              className={cn(campaignFieldClassNames, "w-auto min-w-[9rem]")}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Apply
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/dashboard/giveaway">Reset</Link>
            </Button>
          </div>
        </div>
      </Form>

      {kpis.total === 0 ? (
        <div className="border-border bg-surface shadow-1 rounded-xl border">
          <EmptyState
            title="No giveaways yet"
            description="Create your first giveaway to pick winners from engagement, then lock and pay out fairly."
            action={
              <Button asChild>
                <Link to="/dashboard/giveaway/new">New giveaway</Link>
              </Button>
            }
          />
        </div>
      ) : giveaways.length > 0 ? (
        <>
          <div className="border-border bg-surface shadow-1 hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-hover/40 border-border text-text-secondary border-b text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Giveaway</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Engagement</th>
                  <th className="px-4 py-3 font-medium">Winners / sats</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {giveaways.map((g) => (
                  <tr key={g.id} className="hover:bg-surface-hover/30">
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/giveaway/detail/${g.id}`}
                        className="text-text font-medium hover:underline"
                      >
                        {giveawayRowTitle(g.name, g.id)}
                      </Link>
                      <p className="text-text-secondary text-xs">
                        Created{" "}
                        {new Date(g.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${giveawayStatusPillClass(g.status)}`}
                      >
                        {g.statusLabel}
                      </span>
                      {g.status === "LOCKED" &&
                      g.payoutTotal > 0 &&
                      g.payoutSettled < g.payoutTotal ? (
                        <p className="text-text-secondary mt-1 text-xs">
                          Paying
                        </p>
                      ) : null}
                    </td>
                    <td className="text-text-secondary max-w-[200px] px-4 py-3 text-xs">
                      {g.scopeSummaryLabel}
                    </td>
                    <td className="px-4 py-3">
                      {scopeIsFollowGraphAccountPool(g.scopeType) ? (
                        <span className="text-text-secondary text-xs">
                          Account pool
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {g.engagementTypes.map((t) => (
                            <span
                              key={t}
                              className="bg-surface-hover text-text-secondary rounded-xs px-1.5 py-0.5 text-xs"
                            >
                              {engagementLabel(t)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {g.snapshotWinnerCount > 0
                        ? g.snapshotWinnerCount
                        : g.winnerCount}{" "}
                      winners
                      <br />
                      <span className="text-text-secondary">
                        {g.budgetSats > 0
                          ? `${g.budgetSats.toLocaleString()} sats`
                          : "No payout set"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {g.payoutTotal > 0 ? (
                        <>
                          <div className="bg-surface-hover mb-1 h-1.5 w-24 overflow-hidden rounded-full">
                            <div
                              className="bg-brand h-full"
                              style={{
                                width: `${(100 * g.payoutSettled) / g.payoutTotal}%`,
                              }}
                            />
                          </div>
                          {g.payoutSettled}/{g.payoutTotal} paid
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-text-secondary px-4 py-3 text-xs">
                      {new Date(g.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/giveaway/detail/${g.id}`}>
                            Open
                          </Link>
                        </Button>
                        <dupFetcher.Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="duplicate"
                          />
                          <input type="hidden" name="giveawayId" value={g.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            disabled={dupFetcher.state !== "idle"}
                          >
                            Duplicate
                          </Button>
                        </dupFetcher.Form>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled
                          title="Generate proof cards from a completed giveaway (Proof Studio)"
                        >
                          Proof
                        </Button>
                        {g.canDelete ? (
                          <delFetcher.Form method="post">
                            <input type="hidden" name="intent" value="delete" />
                            <input
                              type="hidden"
                              name="giveawayId"
                              value={g.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="text-danger hover:text-danger"
                              disabled={delFetcher.state !== "idle"}
                              onClick={(e) => {
                                if (
                                  !confirm("Delete this giveaway permanently?")
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </delFetcher.Form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="border-border bg-surface shadow-1 divide-border divide-y rounded-xl border md:hidden">
            {giveaways.map((g) => (
              <li key={g.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/dashboard/giveaway/detail/${g.id}`}
                      className="text-text font-medium hover:underline"
                    >
                      {giveawayRowTitle(g.name, g.id)}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${giveawayStatusPillClass(g.status)}`}
                      >
                        {g.statusLabel}
                      </span>
                      {g.status === "LOCKED" &&
                      g.payoutTotal > 0 &&
                      g.payoutSettled < g.payoutTotal ? (
                        <span className="text-text-secondary text-xs">
                          Paying
                        </span>
                      ) : null}
                    </div>
                    <p className="text-text-secondary mt-2 text-xs">
                      {g.scopeSummaryLabel}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {scopeIsFollowGraphAccountPool(g.scopeType) ? (
                        <span className="text-text-secondary text-xs">
                          Account pool
                        </span>
                      ) : (
                        g.engagementTypes.map((t) => (
                          <span
                            key={t}
                            className="bg-surface-hover text-text-secondary rounded-xs px-1.5 py-0.5 text-xs"
                          >
                            {engagementLabel(t)}
                          </span>
                        ))
                      )}
                    </div>
                    <p className="text-text-secondary mt-2 text-xs">
                      {g.snapshotWinnerCount > 0
                        ? g.snapshotWinnerCount
                        : g.winnerCount}{" "}
                      winners ·{" "}
                      {g.budgetSats > 0
                        ? `${g.budgetSats.toLocaleString()} sats`
                        : "No payout set"}
                    </p>
                    {g.payoutTotal > 0 ? (
                      <p className="text-text-secondary mt-1 text-xs">
                        Progress: {g.payoutSettled}/{g.payoutTotal} marked sent
                        or paid
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/dashboard/giveaway/detail/${g.id}`}>Open</Link>
                  </Button>
                  <dupFetcher.Form method="post" className="inline">
                    <input type="hidden" name="intent" value="duplicate" />
                    <input type="hidden" name="giveawayId" value={g.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={dupFetcher.state !== "idle"}
                    >
                      Duplicate
                    </Button>
                  </dupFetcher.Form>
                  {g.canDelete ? (
                    <delFetcher.Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="giveawayId" value={g.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="text-danger"
                        disabled={delFetcher.state !== "idle"}
                        onClick={(e) => {
                          if (!confirm("Delete this giveaway permanently?")) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </delFetcher.Form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="border-border bg-surface shadow-1 flex flex-col items-center justify-center rounded-xl border p-12 text-center">
          <p className="text-text font-medium">No giveaways match filters</p>
          <p className="text-text-secondary mt-1 max-w-sm text-sm">
            Try clearing filters or create a new giveaway to reward engagement
            on your posts.
          </p>
          <Button asChild className="mt-4">
            <Link to="/dashboard/giveaway/new">New giveaway</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
