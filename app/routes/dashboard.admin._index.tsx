/**
 * Admin Overview: KPI strip, alerts, publishing & user summaries, system health.
 */

import type { SerializeFrom } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { AdminAlertList, AdminPageHeader, MetricCard } from "~/features/admin";

import type { loader } from "./dashboard.admin._index.server";

export { loader } from "./dashboard.admin._index.server";

type LoaderData = SerializeFrom<typeof loader>;

function isSuccess(d: LoaderData): d is Exclude<LoaderData, { error: string }> {
  return !("error" in d);
}

export default function AdminOverviewPage() {
  const raw = useLoaderData<typeof loader>();
  if (!isSuccess(raw)) {
    return <div className="p-4">Access denied.</div>;
  }
  const d = raw;

  const maxDaily = Math.max(
    1,
    ...d.publishing.dailyPublishesShort.map((x) => x.count)
  );
  const stateTotal = d.publishing.stateMixShort.reduce(
    (s, r) => s + r.count,
    0
  );

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        subtitle="Executive snapshot: platform health, publishing, users, and referrals. Dangerous payout controls live under Referrals."
        generatedAt={d.generatedAt}
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            KPI strip
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Active paid users"
              value={d.kpis.activePaidUsers.current}
              interpretation="Subscriptions in ACTIVE status."
            />
            <MetricCard
              title="New users"
              value={d.kpis.newUsers.current}
              deltaPct={d.kpis.newUsers.deltaPct}
            />
            <MetricCard
              title="Posts published"
              value={d.kpis.postsPublished.current}
              deltaPct={d.kpis.postsPublished.deltaPct}
              interpretation={`${d.kpis.postsPublished.short} short · ${d.kpis.postsPublished.long} long-form`}
            />
            <MetricCard
              title="Publish success rate"
              value={`${d.kpis.publishSuccessRate}%`}
              interpretation={
                d.kpis.publishSuccessPrev !== null
                  ? `Prior window: ${d.kpis.publishSuccessPrev}%`
                  : "Published vs failed in selected range."
              }
            />
            <MetricCard
              title="Pending payout (sats)"
              value={d.kpis.pendingPayoutSats.toLocaleString()}
              tone={d.kpis.pendingPayoutSats > 0 ? "warning" : "neutral"}
            />
            <MetricCard
              title="Action-required issues"
              value={d.kpis.actionRequiredCount}
              tone={d.kpis.actionRequiredCount > 0 ? "danger" : "positive"}
              interpretation={
                d.kpis.actionRequiredCount > 0
                  ? "Open alerts below."
                  : "Nothing flagged right now."
              }
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Alerts
          </h2>
          <AdminAlertList alerts={d.alerts} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Publishing health</h2>
            <p className="text-muted-foreground text-xs">
              Queue depth (scheduled + publishing):{" "}
              <span className="text-foreground font-medium tabular-nums">
                {d.publishing.scheduledQueueDepth}
              </span>
              {" · "}
              Failed (all time, short):{" "}
              <Link
                to="/dashboard/admin/operations?focus=failures"
                className="text-primary font-medium hover:underline"
              >
                {d.publishing.failedShort}
              </Link>
              {" · "}
              Cancelled: {d.publishing.cancelledShort}
              {d.publishing.avgPublishLatencyMs !== null ? (
                <>
                  {" · "}
                  Avg publish latency:{" "}
                  <span className="font-mono text-xs">
                    {Math.round(d.publishing.avgPublishLatencyMs / 1000)}s
                  </span>
                </>
              ) : null}
            </p>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                Short post states (mix)
              </p>
              <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
                {stateTotal > 0
                  ? d.publishing.stateMixShort.map((row) => (
                      <div
                        key={row.state}
                        title={`${row.state}: ${row.count}`}
                        className="bg-primary/70 h-full first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${(row.count / stateTotal) * 100}%`,
                          opacity: 0.35 + (row.count / stateTotal) * 0.65,
                        }}
                      />
                    ))
                  : null}
              </div>
              <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {d.publishing.stateMixShort.slice(0, 8).map((row) => (
                  <li key={row.state}>
                    <span className="font-mono">{row.state}</span>: {row.count}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                Publishes per day (last 7 days, UTC)
              </p>
              <div className="flex h-24 items-end gap-1">
                {d.publishing.dailyPublishesShort.map((day) => (
                  <div
                    key={day.day}
                    className="bg-primary/80 min-w-[6px] flex-1 rounded-t"
                    style={{
                      height: `${(day.count / maxDaily) * 100}%`,
                      minHeight: day.count > 0 ? "4px" : "0",
                    }}
                    title={`${day.day}: ${day.count}`}
                  />
                ))}
              </div>
              <p className="text-muted-foreground text-[10px]">
                {d.publishing.dailyPublishesShort.map((x) => x.day).join(" · ")}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">User activity</h2>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                Active publishers (proxy):{" "}
                <span className="text-foreground font-medium">
                  {d.users.activeUsersProxy}
                </span>
              </li>
              <li>
                Signups in range:{" "}
                <span className="text-foreground font-medium">
                  {d.users.signupsInRange}
                </span>
              </li>
              <li>
                Avg posts / active publisher:{" "}
                <span className="text-foreground font-medium">
                  {d.users.avgPostsPerActiveUser === null
                    ? "—"
                    : d.users.avgPostsPerActiveUser.toFixed(2)}
                </span>
              </li>
            </ul>
            <Link
              to="/dashboard/admin/users"
              className="text-primary text-sm hover:underline"
            >
              Open user directory →
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Referrals snapshot</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Active subscriptions"
              value={d.referrals.activeSubscriptions}
            />
            <MetricCard
              title="Referral links"
              value={d.referrals.referralLinks}
            />
            <MetricCard
              title="Pending payout (sats)"
              value={d.referrals.pendingSats.toLocaleString()}
            />
            <MetricCard
              title="Paid in range (sats)"
              value={d.referrals.paidInRangeSats.toLocaleString()}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Ready for batch payout:{" "}
            <span className="text-foreground font-semibold">
              {d.referrals.batchReadyCount}
            </span>
            .{" "}
            <Link
              to="/dashboard/admin/referrals"
              className="text-primary hover:underline"
            >
              Open Referrals →
            </Link>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">System health</h2>
          <div className="flex flex-wrap gap-2">
            {d.systemHealth.map((row) => (
              <div
                key={row.id}
                className="border-border rounded-lg border px-3 py-2 text-xs"
              >
                <span className="font-medium">{row.label}</span>
                <span
                  className={
                    row.status === "healthy"
                      ? "ml-2 text-emerald-600"
                      : row.status === "degraded"
                        ? "ml-2 text-amber-600"
                        : row.status === "failing"
                          ? "ml-2 text-red-600"
                          : "text-muted-foreground ml-2"
                  }
                >
                  {row.status}
                </span>
                {row.detail ? (
                  <p className="text-muted-foreground mt-1 max-w-xs">
                    {row.detail}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <details className="text-muted-foreground text-xs">
          <summary className="cursor-pointer font-medium">
            Metric definitions
          </summary>
          <p className="mt-2 max-w-3xl leading-relaxed">
            Active publishers = distinct users with a published short or
            long-form post in the selected range. Publish success rate uses
            publishes vs failures with{" "}
            <code className="text-foreground">updatedAt</code> in the range.
            Queue and outbox probes run from the web app; worker liveness is
            inferred from queue depth, not a separate heartbeat.
          </p>
        </details>
      </div>
    </div>
  );
}
