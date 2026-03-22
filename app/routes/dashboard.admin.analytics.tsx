import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useMemo } from "react";

import {
  AdminChartCard,
  AdminLineChart,
  AdminPageHeader,
  AdminProofOfWorkSection,
  AdminSection,
  MetricCard,
} from "~/features/admin";
import {
  defaultRangeForAdminPath,
  parseRangePreset,
} from "~/features/admin/metrics/date-range";
import { getAdminAnalyticsPageData } from "~/features/admin/repositories/admin-analytics-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const preset = parseRangePreset(
    url.searchParams.get("range"),
    defaultRangeForAdminPath(url.pathname)
  );
  const data = await getAdminAnalyticsPageData(preset);
  return json(data);
}

function mergeSeriesForChart(
  a: Array<{ day: string; count: number }>,
  b: Array<{ day: string; count: number }>,
  keys: [string, string]
) {
  const days = new Set<string>();
  for (const row of a) days.add(row.day);
  for (const row of b) days.add(row.day);
  return [...days].sort().map((day) => ({
    day,
    [keys[0]]: a.find((r) => r.day === day)?.count ?? 0,
    [keys[1]]: b.find((r) => r.day === day)?.count ?? 0,
  }));
}

function mergeThreeSeries(
  a: Array<{ day: string; count: number }>,
  b: Array<{ day: string; count: number }>,
  c: Array<{ day: string; count: number }>,
  keys: [string, string, string]
) {
  const days = new Set<string>();
  for (const row of a) days.add(row.day);
  for (const row of b) days.add(row.day);
  for (const row of c) days.add(row.day);
  return [...days].sort().map((day) => ({
    day,
    [keys[0]]: a.find((r) => r.day === day)?.count ?? 0,
    [keys[1]]: b.find((r) => r.day === day)?.count ?? 0,
    [keys[2]]: c.find((r) => r.day === day)?.count ?? 0,
  }));
}

export default function AdminAnalyticsPage() {
  const raw = useLoaderData<typeof loader>();
  const { formatDate } = useFormattedDate();
  const formatChartDay = useMemo(
    () => (isoDay: string) =>
      formatDate(`${isoDay}T12:00:00.000Z`, {
        dateFormatOptions: { month: "short", day: "numeric" },
      }),
    [formatDate]
  );

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow from loose loader type
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    return <div className="p-4">Access denied.</div>;
  }
  const d = raw as Awaited<ReturnType<typeof getAdminAnalyticsPageData>>;

  const growthData = mergeThreeSeries(
    d.series.newUsersPerDay,
    d.series.postsPublishedPerDay,
    d.series.referredSignupsPerDay,
    ["users", "posts", "referred"]
  );

  const publishingMixData = mergeSeriesForChart(
    d.series.subscriptionsStartedPerDay,
    d.series.postsPublishedPerDay,
    ["subscriptions", "posts"]
  );

  const deltas = d.deltas;

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        subtitle="Growth, publishing mix, adoption proxies, and shareable milestones."
        generatedAt={d.generatedAt}
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
        <AdminSection
          id="narrative"
          eyebrow="Narrative"
          title="Insight summary"
          description="Rule-based read on this range — low volume stays intentionally cautious."
        >
          <ul className="border-border bg-card/50 space-y-2 rounded-xl border p-4 text-sm">
            {d.takeaways.map((t) => (
              <li key={t} className="text-foreground/90 list-inside list-disc">
                {t}
              </li>
            ))}
          </ul>
        </AdminSection>

        <AdminSection id="growth" eyebrow="Growth" title="Growth">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="New users"
              value={d.totals.newUsers}
              deltaPct={deltas?.newUsersPct ?? null}
              definition="Accounts created in the selected range."
            />
            <MetricCard
              title="Posts published"
              value={d.totals.postsPublished}
              deltaPct={deltas?.postsPublishedPct ?? null}
              definition="Short posts that reached PUBLISHED in the range."
            />
            <MetricCard
              title="Long-form published"
              value={d.totals.longFormPublished}
              deltaPct={deltas?.longFormPublishedPct ?? null}
            />
            <MetricCard
              title="Referred signups"
              value={d.totals.referredSignups}
              deltaPct={deltas?.referredSignupsPct ?? null}
              definition="Referral rows created in the range."
            />
          </div>
          <AdminChartCard
            className="mt-4"
            title="Daily growth mix"
            subtitle="New users, posts published, and referred signups by day (UTC)."
            empty={growthData.length === 0}
          >
            <AdminLineChart
              formatDayLabel={formatChartDay}
              data={growthData}
              series={[
                {
                  dataKey: "users",
                  name: "New users",
                  stroke: "hsl(var(--primary))",
                },
                {
                  dataKey: "posts",
                  name: "Posts published",
                  stroke: "hsl(142 70% 42%)",
                },
                {
                  dataKey: "referred",
                  name: "Referred signups",
                  stroke: "hsl(280 55% 52%)",
                },
              ]}
            />
          </AdminChartCard>
        </AdminSection>

        <AdminSection
          id="monetization"
          eyebrow="Monetization"
          title="Business"
          description="Recurring revenue and paid subscription flow (approximations documented in metric registry)."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="MRR (sats)"
              value={`${d.monetization.mrrSats} sats`}
              definition="Sum of amountSats on active paid subscriptions (30-day periods)."
            />
            <MetricCard
              title="ARR run-rate (sats)"
              value={`${d.monetization.arrRunRateSats} sats`}
              definition="MRR × 12 — run-rate, not recognized revenue."
            />
            <MetricCard
              title="Active paid subscribers"
              value={d.monetization.activePaidSubscribers}
            />
            <MetricCard
              title="Subscriptions started (range)"
              value={d.monetization.subscriptionsStartedInRange}
              deltaPct={deltas?.subscriptionsStartedPct ?? null}
            />
            <MetricCard
              title="Cancellations (range)"
              value={d.monetization.subscriptionsCanceledInRange}
              definition="Subscriptions moved to CANCELED in range (timestamp approximation)."
            />
            <MetricCard
              title="Net paid flow"
              value={d.monetization.netSubscriptionFlowInRange}
              definition="Starts minus cancellations in range."
            />
            <MetricCard
              title="ARPPU (sats, range payments)"
              value={d.monetization.arppuSatsInRange ?? "—"}
              definition="Completed payment amount in range ÷ active paid subscribers."
              confidence={d.monetization.revenueConfidence}
            />
            <MetricCard
              title="Referral commission (range)"
              value={d.monetization.referredRevenueSatsInRange}
              definition="Sum of ReferralEarning.commissionSats with createdAt in range."
            />
            <MetricCard
              title="Payment total (sats, range)"
              value={d.monetization.totalPaymentSatsInRange}
              definition="Completed Payment.amount in range."
            />
          </div>
          <AdminChartCard
            className="mt-4"
            title="Subscriptions vs post volume"
            subtitle="Daily subscription starts and short-form publishes."
            empty={publishingMixData.length === 0}
            emptyDescription="No subscription or publish days in this window."
            emptySuggestedRange="Try 30d or 90d for more subscription movement."
          >
            <AdminLineChart
              formatDayLabel={formatChartDay}
              data={publishingMixData}
              series={[
                {
                  dataKey: "subscriptions",
                  name: "Subscriptions started",
                  stroke: "hsl(var(--primary))",
                },
                {
                  dataKey: "posts",
                  name: "Posts published",
                  stroke: "hsl(32 90% 48%)",
                },
              ]}
            />
          </AdminChartCard>
        </AdminSection>

        <AdminSection
          id="product-usage"
          eyebrow="Product usage"
          title="Sessions"
          description="Distinct users with dashboard session beacons — not auth sessions."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Active session users (range)"
              value={d.productUsage.activeSessionUsersInRange}
              confidence={d.productUsage.activeUsersConfidence}
            />
            <MetricCard
              title="DAU (rolling)"
              value={d.productUsage.dauRolling}
            />
            <MetricCard
              title="WAU (rolling)"
              value={d.productUsage.wauRolling}
            />
            <MetricCard
              title="MAU (rolling)"
              value={d.productUsage.mauRolling}
            />
          </div>
        </AdminSection>

        <AdminSection
          id="publishing-reliability"
          eyebrow="Publishing"
          title="Reliability"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Publish success (range)"
              value={`${d.publishingReliability.publishSuccessRateInRange}%`}
              definition="Published ÷ (published + failed) with activity timestamps in range."
            />
            <MetricCard
              title="Failed short (range)"
              value={d.publishingReliability.failedShortInRange}
            />
            <MetricCard
              title="Failed long-form (range)"
              value={d.publishingReliability.failedLongInRange}
            />
            <MetricCard
              title="30d success % (context)"
              value={`${d.proofOfWork.publishSuccessRate30d}%`}
              definition="Separate rolling 30-day short-post success rate for context."
            />
          </div>
        </AdminSection>

        <AdminSection
          id="signer-connect"
          eyebrow="Signer"
          title="Remote signer vs extension"
          description="NIP-46 profile counts are a proxy for remote signer preference. Reconnect stats are background NIP-46 retries only."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Enabled users"
              value={d.signerConnect.enabledUsers}
            />
            <MetricCard
              title="NIP-46 profile saved"
              value={d.signerConnect.usersWithNip46Profile}
            />
            <MetricCard
              title="Extension / unset (proxy)"
              value={d.signerConnect.usersExtensionOrUnset}
            />
            <MetricCard
              title="Reconnect attempts (range)"
              value={d.signerConnect.reconnectAttemptsInRange}
            />
            <MetricCard
              title="Reconnect failures (range)"
              value={d.signerConnect.reconnectFailuresInRange}
            />
            <MetricCard
              title="Users with ≥1 failure"
              value={d.signerConnect.distinctUsersWithFailureInRange}
            />
          </div>
          {d.signerConnect.failuresByBucket.length > 0 ? (
            <ul className="text-muted-foreground mt-3 text-xs">
              {d.signerConnect.failuresByBucket.map((b) => (
                <li key={b.bucket}>
                  <span className="font-mono">{b.bucket}</span>: {b.count}
                </li>
              ))}
            </ul>
          ) : null}
        </AdminSection>

        <AdminSection
          id="feature-adoption"
          eyebrow="Product"
          title="Feature adoption (range)"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Scheduled reposts"
              value={d.featureAdoption.scheduledReposts}
            />
            <MetricCard
              title="Scheduled quotes"
              value={d.featureAdoption.scheduledQuotes}
            />
            <MetricCard
              title="Thread segments"
              value={d.featureAdoption.threadSegments}
            />
            <MetricCard
              title="Posts with media"
              value={d.featureAdoption.postsWithMedia}
            />
            <MetricCard
              title="Giveaways (locked/paid)"
              value={d.featureAdoption.giveawaysLockedOrPaid}
            />
          </div>
        </AdminSection>

        <AdminSection
          id="retention"
          eyebrow="Retention"
          title="Retention proxies"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              title="Multi-day publishers"
              value={d.retention.publishersMultiDay}
              definition="Users who published on 2+ different days in this window."
            />
            <MetricCard
              title="Second-publish users"
              value={d.retention.secondPublishUsers}
              definition="Users with ≥2 published short posts (all time)."
            />
          </div>
        </AdminSection>

        <AdminProofOfWorkSection proofCard={d.proofCard} />
      </div>
    </div>
  );
}
