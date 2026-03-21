import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AdminPageHeader,
  AdminProofOfWorkSection,
  MetricCard,
} from "~/features/admin";
import {
  defaultRangeForAdminPath,
  parseRangePreset,
} from "~/features/admin/metrics/date-range";
import { getAdminAnalyticsPageData } from "~/features/admin/repositories/admin-analytics-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";

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

export default function AdminAnalyticsPage() {
  const raw = useLoaderData<typeof loader>();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow from loose loader type
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    return <div className="p-4">Access denied.</div>;
  }
  const d = raw as Awaited<ReturnType<typeof getAdminAnalyticsPageData>>;

  const growthData = mergeSeriesForChart(
    d.series.newUsersPerDay,
    d.series.postsPublishedPerDay,
    ["users", "posts"]
  );

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        subtitle="Growth, publishing mix, adoption proxies, and shareable milestones."
        generatedAt={d.generatedAt}
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Key takeaways
          </h2>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            {d.takeaways.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Growth</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="New users" value={d.totals.newUsers} />
            <MetricCard
              title="Posts published"
              value={d.totals.postsPublished}
            />
            <MetricCard
              title="Long-form published"
              value={d.totals.longFormPublished}
            />
            <MetricCard
              title="Referred signups"
              value={d.totals.referredSignups}
            />
          </div>
          <div className="border-border bg-card h-72 rounded-lg border p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(var(--primary))"
                  dot={false}
                  name="New users"
                />
                <Line
                  type="monotone"
                  dataKey="posts"
                  stroke="hsl(142 70% 45%)"
                  dot={false}
                  name="Posts published"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Publishing & subscriptions</h2>
          <div className="border-border bg-card h-64 rounded-lg border p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.series.subscriptionsStartedPerDay}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  dot={false}
                  name="Subscriptions started"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Feature adoption (range)</h2>
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
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Retention proxies</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              title="Multi-day publishers"
              value={d.retention.publishersMultiDay}
              interpretation="Distinct days with a publish in range."
            />
            <MetricCard
              title="Second-publish users"
              value={d.retention.secondPublishUsers}
              interpretation="Users with ≥2 published posts (all time)."
            />
          </div>
        </section>

        <AdminProofOfWorkSection stats={d.proofOfWork} />
      </div>
    </div>
  );
}
