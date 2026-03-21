import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { AdminPageHeader, MetricCard } from "~/features/admin";
import {
  defaultRangeForAdminPath,
  parseRangePreset,
} from "~/features/admin/metrics/date-range";
import { getAdminOperationsPageData } from "~/features/admin/repositories/admin-operations-queries.server";
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
  const data = await getAdminOperationsPageData(preset);
  return json(data);
}

export default function AdminOperationsPage() {
  const raw = useLoaderData<typeof loader>();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow from loose loader type
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    return <div className="p-4">Access denied.</div>;
  }
  const d = raw as Awaited<ReturnType<typeof getAdminOperationsPageData>>;

  const failedJobs =
    d.failedPosts.length + d.deadLetters.length + d.failedPayouts.length;

  return (
    <div>
      <AdminPageHeader
        title="Operations"
        subtitle="Failures, dead letters, queues, and outbox — surgical view for incident response."
        generatedAt={d.generatedAt}
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Failed publish rows (range)"
            value={d.failedPosts.length}
            tone={d.failedPosts.length > 0 ? "danger" : "positive"}
          />
          <MetricCard
            title="Dead-letter jobs (range)"
            value={d.deadLetters.length}
            tone={d.deadLetters.length > 0 ? "danger" : "positive"}
          />
          <MetricCard
            title="Failed payouts (range)"
            value={d.failedPayouts.length}
          />
          <MetricCard title="Issues in tables below" value={failedJobs} />
        </div>

        {d.queueError ? (
          <p className="text-sm text-amber-600">{d.queueError}</p>
        ) : null}

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Queue depth</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-2 text-left">Queue</th>
                  <th className="p-2 text-right">Waiting</th>
                  <th className="p-2 text-right">Active</th>
                  <th className="p-2 text-right">Failed</th>
                  <th className="p-2 text-right">Delayed</th>
                </tr>
              </thead>
              <tbody>
                {d.queueDepths.map((q) => (
                  <tr key={q.queue} className="border-b">
                    <td className="p-2 font-mono text-xs">{q.queue}</td>
                    <td className="p-2 text-right tabular-nums">{q.waiting}</td>
                    <td className="p-2 text-right tabular-nums">{q.active}</td>
                    <td className="p-2 text-right tabular-nums">{q.failed}</td>
                    <td className="p-2 text-right tabular-nums">{q.delayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {d.outbox ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Outbox</h2>
            <p className="text-muted-foreground text-sm">
              Pending: {d.outbox.pending} · Ready: {d.outbox.ready} ·
              Dead-lettered: {d.outbox.deadLettered}
            </p>
          </section>
        ) : null}

        <section className="space-y-2" id="failures">
          <h2 className="text-lg font-semibold">Publish failures</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-2 text-left">Updated</th>
                  <th className="p-2 text-left">Kind</th>
                  <th className="p-2 text-left">Account</th>
                  <th className="p-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {d.failedPosts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground p-4">
                      No failed posts in range.
                    </td>
                  </tr>
                ) : (
                  d.failedPosts.map((p) => (
                    <tr key={`${p.kind}-${p.id}`} className="border-b">
                      <td className="p-2 text-xs whitespace-nowrap">
                        {p.updatedAt}
                      </td>
                      <td className="p-2">{p.kind}</td>
                      <td className="max-w-[160px] truncate p-2 font-mono text-xs">
                        {p.npub}
                      </td>
                      <td className="text-muted-foreground max-w-md p-2 text-xs">
                        {p.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Dead-letter queue</h2>
          <p className="text-muted-foreground text-xs">
            Replay via{" "}
            <code className="text-foreground">
              scripts/replay-queue-dead-letter.ts
            </code>{" "}
            when appropriate.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-2 text-left">Created</th>
                  <th className="p-2 text-left">Queue</th>
                  <th className="p-2 text-left">Post</th>
                  <th className="p-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {d.deadLetters.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground p-4">
                      No dead-letter rows in range.
                    </td>
                  </tr>
                ) : (
                  d.deadLetters.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="p-2 text-xs whitespace-nowrap">
                        {row.createdAt}
                      </td>
                      <td className="p-2 font-mono text-xs">{row.queueType}</td>
                      <td className="p-2 font-mono text-xs">
                        {row.postId ?? "—"}
                      </td>
                      <td className="text-muted-foreground max-w-md p-2 text-xs">
                        {row.error}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Failed referral payouts</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-2 text-left">Created</th>
                  <th className="p-2 text-left">Referrer</th>
                  <th className="p-2 text-right">Sats</th>
                  <th className="p-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {d.failedPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground p-4">
                      None in range.
                    </td>
                  </tr>
                ) : (
                  d.failedPayouts.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="p-2 text-xs">{e.createdAt}</td>
                      <td className="max-w-[160px] truncate p-2 font-mono text-xs">
                        {e.referrerNpub}
                      </td>
                      <td className="p-2 text-right">{e.commissionSats}</td>
                      <td className="text-muted-foreground p-2 text-xs">
                        {e.payoutFailureReason ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <Link
          to="/dashboard/admin"
          className="text-primary text-sm hover:underline"
        >
          ← Overview
        </Link>
      </div>
    </div>
  );
}
