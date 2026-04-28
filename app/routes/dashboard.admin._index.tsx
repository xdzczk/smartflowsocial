/**
 * Admin Overview: KPI strip, alerts, publishing & user summaries, system health.
 */

import type { SerializeFrom } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { ADMIN_PAGE_BODY_CLASS } from "~/components/layout/page-layout-constants";
import {
  AdminAccessDenied,
  AdminAlertList,
  AdminPageHeader,
  AdminSection,
  AdminStatusPill,
  MetricCard,
  getMetricDefinition,
  useAdminCurrency,
} from "~/features/admin";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

import type { loader } from "./dashboard.admin._index.server";

export { loader } from "./dashboard.admin._index.server";

type LoaderData = SerializeFrom<typeof loader>;

function isSuccess(d: LoaderData): d is Exclude<LoaderData, { error: string }> {
  return !("error" in d);
}

export default function AdminOverviewPage() {
  const raw = useLoaderData<typeof loader>();
  const { dateLocale } = useFormattedDate();
  const { unit, formatSats } = useAdminCurrency();

  if (!isSuccess(raw)) {
    return <AdminAccessDenied />;
  }
  const d = raw;
  const def = d.insights.definitions;
  const k = d.insights.kpi;
  const rangeQ = `?range=${encodeURIComponent(d.rangePreset)}`;
  const mrrDef = getMetricDefinition("mrr_sats");
  const mrrTitle = unit === "SATS" ? mrrDef.label : `MRR (${unit})`;
  const netFlow = d.monetization.netSubscriptionFlowInRange;
  const reconnectAttempts = d.signerConnect.reconnectAttemptsInRange;
  const reconnectFails = d.signerConnect.reconnectFailuresInRange;
  const reconnectOkPct =
    reconnectAttempts === 0
      ? null
      : Math.round(
          ((reconnectAttempts - reconnectFails) / reconnectAttempts) * 1000
        ) / 10;

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
      <div className={`${ADMIN_PAGE_BODY_CLASS} space-y-8`}>
        <AdminSection eyebrow="Pulse" title="Executive strip">
          <p className="text-text-secondary mb-3 text-xs leading-snug">
            Top-line business, publishing, and signer health. Click a card to
            drill into Analytics where linked.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title={mrrTitle}
              value={formatSats(d.monetization.mrrSats, dateLocale)}
              definition={`${mrrDef.description} ${mrrDef.formula}`}
              interpretation="Current recurring base (30-day billing periods)."
              href={`/dashboard/admin/analytics${rangeQ}#monetization`}
            />
            <MetricCard
              title="Net paid subscription flow"
              value={netFlow >= 0 ? `+${netFlow}` : `${netFlow}`}
              definition="Paid subscription rows created minus CANCELED updates in range (approximation)."
              interpretation="Starts vs cancellations in this window."
              tone={netFlow < 0 ? "warning" : "neutral"}
              href={`/dashboard/admin/analytics${rangeQ}#monetization`}
            />
            <MetricCard
              title="Posts published"
              value={d.kpis.postsPublished.current}
              deltaPct={d.kpis.postsPublished.deltaPct}
              definition={def.postsPublished}
              interpretation={k.postsPublished}
              href={`/dashboard/admin/analytics${rangeQ}#growth`}
            />
            <MetricCard
              title="Publish success rate"
              value={`${d.kpis.publishSuccessRate}%`}
              definition={def.publishSuccess}
              interpretation={k.publishSuccess}
              footnote={
                d.kpis.publishSuccessPrev !== null
                  ? `Prior comparable window: ${d.kpis.publishSuccessPrev}%. Uses publishes vs failures with activity timestamps in range.`
                  : undefined
              }
              href={`/dashboard/admin/analytics${rangeQ}#publishing-reliability`}
            />
            <MetricCard
              title="Signer reconnect success"
              value={reconnectOkPct === null ? "—" : `${reconnectOkPct}%`}
              definition="Share of recorded NIP-46 background reconnect attempts that succeeded in this range."
              interpretation={
                reconnectAttempts === 0
                  ? "No reconnect telemetry in this range yet."
                  : `${reconnectFails} failed of ${reconnectAttempts} attempts.`
              }
              tone={
                reconnectOkPct !== null && reconnectOkPct < 70
                  ? "warning"
                  : "neutral"
              }
              confidence={d.signerConnect.reconnectConfidence.confidence}
              confidenceNote={d.signerConnect.reconnectConfidence.note}
              href={`/dashboard/admin/analytics${rangeQ}#signer-connect`}
            />
            <MetricCard
              title="Open alerts"
              value={d.kpis.actionRequiredCount}
              tone={d.kpis.actionRequiredCount > 0 ? "danger" : "positive"}
              definition={def.actionRequired}
              interpretation={k.actionRequired}
              href="/dashboard/admin/operations?focus=failures"
            />
          </div>
        </AdminSection>

        <AdminSection eyebrow="Context" title="Supporting strip">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Active paid users"
              value={d.kpis.activePaidUsers.current}
              definition={def.activePaidUsers}
              interpretation={k.activePaidUsers}
            />
            <MetricCard
              title="New users"
              value={d.kpis.newUsers.current}
              deltaPct={d.kpis.newUsers.deltaPct}
              definition={def.newUsers}
              interpretation={k.newUsers}
            />
            <MetricCard
              title="DAU / WAU / MAU (rolling)"
              value={`${d.productUsage.dauRolling} / ${d.productUsage.wauRolling} / ${d.productUsage.mauRolling}`}
              definition="Distinct users with product session heartbeats (24h / 7d / 30d rolling)."
              interpretation="Session-based activity, not publishes only."
              confidence={d.productUsage.activeUsersConfidence}
            />
            <MetricCard
              title={
                unit === "SATS"
                  ? "Pending payout (sats)"
                  : `Pending payout (${unit})`
              }
              value={formatSats(d.kpis.pendingPayoutSats, dateLocale)}
              tone={d.kpis.pendingPayoutSats > 0 ? "warning" : "neutral"}
              definition={def.pendingPayout}
              interpretation={k.pendingPayout}
              href={`/dashboard/admin/referrals${rangeQ}`}
            />
            <MetricCard
              title="Active publishers (proxy)"
              value={d.users.activeUsersProxy}
              definition="Distinct users with a published post in range."
            />
            <MetricCard
              title="Paid subs started (range)"
              value={d.monetization.subscriptionsStartedInRange}
              definition="New paid subscription rows created in the window."
            />
            <MetricCard
              title="Avg publish latency"
              value={
                d.publishing.avgPublishLatencyMs === null
                  ? "—"
                  : `${Math.round(d.publishing.avgPublishLatencyMs / 1000)}s`
              }
              definition="Mean time from publishingStartedAt to publishedAt (short posts, sampled)."
            />
          </div>
        </AdminSection>

        <AdminSection eyebrow="Attention" title="Alerts">
          <AdminAlertList alerts={d.alerts} />
        </AdminSection>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Publishing health</h2>
            <p className="text-text/90 text-sm leading-snug">
              {d.insights.publishingNarrative}
            </p>
            <p className="text-text-secondary text-xs">
              Queue depth (scheduled + publishing):{" "}
              <span className="text-text font-medium tabular-nums">
                {d.publishing.scheduledQueueDepth}
              </span>
              {" · "}
              Failed (all time, short):{" "}
              <Link
                to="/dashboard/admin/operations?focus=failures"
                className="text-link hover:text-link-hover font-medium hover:underline"
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
              <p className="text-text-secondary text-xs font-medium">
                Short post states (mix)
              </p>
              <div className="bg-surface-hover flex h-3 w-full overflow-hidden rounded-full">
                {stateTotal > 0
                  ? d.publishing.stateMixShort.map((row) => (
                      <div
                        key={row.state}
                        title={`${row.state}: ${row.count}`}
                        className="bg-selection-fill/70 h-full first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${(row.count / stateTotal) * 100}%`,
                          opacity: 0.35 + (row.count / stateTotal) * 0.65,
                        }}
                      />
                    ))
                  : null}
              </div>
              <ul className="text-text-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {d.publishing.stateMixShort.slice(0, 8).map((row) => (
                  <li key={row.state}>
                    <span className="font-mono">{row.state}</span>: {row.count}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-text-secondary text-xs font-medium">
                Publishes per day (last 7 days, UTC)
              </p>
              <div className="flex h-24 items-end gap-1">
                {d.publishing.dailyPublishesShort.map((day) => (
                  <div
                    key={day.day}
                    className="bg-selection-fill/80 hover:bg-selection-fill min-w-[6px] flex-1 rounded-t transition-all"
                    style={{
                      height: `${(day.count / maxDaily) * 100}%`,
                      minHeight: day.count > 0 ? "4px" : "0",
                    }}
                    title={`${day.day}: ${day.count}`}
                  />
                ))}
              </div>
              <p className="text-text-secondary text-[10px]">
                {d.publishing.dailyPublishesShort.map((x) => x.day).join(" · ")}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">User activity</h2>
            <ul className="text-text-secondary space-y-2 text-sm">
              <li>
                Active publishers (proxy):{" "}
                <span className="text-text font-medium">
                  {d.users.activeUsersProxy}
                </span>
              </li>
              <li>
                Session-active users (range):{" "}
                <span className="text-text font-medium">
                  {d.productUsage.activeSessionUsersInRange}
                </span>
              </li>
              <li>
                Signups in range:{" "}
                <span className="text-text font-medium">
                  {d.users.signupsInRange}
                </span>
              </li>
              <li>
                Avg posts / active publisher:{" "}
                <span className="text-text font-medium">
                  {d.users.avgPostsPerActiveUser === null
                    ? "—"
                    : d.users.avgPostsPerActiveUser.toFixed(2)}
                </span>
              </li>
            </ul>
            <Link
              to="/dashboard/admin/users"
              className="text-link hover:text-link-hover text-sm hover:underline"
            >
              Open user directory →
            </Link>

            <div className="border-border bg-surface space-y-2 rounded-xl border p-3">
              <p className="text-text-secondary text-xs font-medium">
                Relay publish ACKs (range)
              </p>
              <p className="text-text text-sm leading-snug">
                {d.insights.relay.note}
              </p>
              <Link
                to="/dashboard/admin/operations?focus=relay"
                className="text-link hover:text-link-hover text-xs hover:underline"
              >
                Open Operations (relay) →
              </Link>
            </div>
          </div>
        </section>

        <AdminSection eyebrow="Growth" title="Referrals snapshot">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Active seats (all plans)"
              value={d.referrals.activeSubscriptions}
              definition="Every subscription row in ACTIVE status, including the free tier."
            />
            <MetricCard
              title="Referral links"
              value={d.referrals.referralLinks}
            />
            <MetricCard
              title={
                unit === "SATS"
                  ? "Pending payout (sats)"
                  : `Pending payout (${unit})`
              }
              value={formatSats(d.referrals.pendingSats, dateLocale)}
            />
            <MetricCard
              title={
                unit === "SATS"
                  ? "Paid in range (sats)"
                  : `Paid in range (${unit})`
              }
              value={formatSats(d.referrals.paidInRangeSats, dateLocale)}
            />
            <MetricCard
              title="Referral commission (range)"
              value={formatSats(
                d.monetization.referredRevenueSatsInRange,
                dateLocale
              )}
              definition="ReferralEarning rows created in the window (commission)."
            />
          </div>
          <p className="text-text-secondary text-sm">
            Ready for batch payout:{" "}
            <span className="text-text font-semibold">
              {d.referrals.batchReadyCount}
            </span>
            .{" "}
            <Link
              to="/dashboard/admin/referrals"
              className="text-link hover:text-link-hover hover:underline"
            >
              Open Referrals →
            </Link>
          </p>
        </AdminSection>

        <AdminSection eyebrow="Infra" title="System health">
          <div className="flex flex-wrap gap-2">
            {d.systemHealth.map((row) => (
              <AdminStatusPill
                key={row.id}
                label={row.label}
                status={row.status}
                detail={row.detail}
              />
            ))}
          </div>
        </AdminSection>

        <details className="text-text-secondary text-xs">
          <summary className="cursor-pointer font-medium">
            About these metrics
          </summary>
          <p className="mt-2 max-w-3xl leading-relaxed">
            Active publishers = distinct users with a published short or
            long-form post in the selected range. Publish success rate uses
            publishes vs failures with{" "}
            <code className="text-text">updatedAt</code> in the range. Queue and
            outbox probes run from the web app; worker liveness is inferred from
            waiting vs active job counts on BullMQ queues (no separate
            heartbeat). Relay ACK ratios depend on user-chosen relays and are
            informational; severe aggregate failure rates surface as alerts
            only.
          </p>
        </details>
      </div>
    </div>
  );
}
