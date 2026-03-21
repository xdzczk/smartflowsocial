import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { useEffect } from "react";

import {
  AdminCard,
  AdminDataTable,
  AdminDataTableEmpty,
  AdminDataTableHead,
  AdminPageHeader,
  AdminSection,
  MetricCard,
} from "~/features/admin";
import {
  defaultRangeForAdminPath,
  parseRangePreset,
} from "~/features/admin/metrics/date-range";
import { getAdminOperationsPageData } from "~/features/admin/repositories/admin-operations-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

const FOCUS_SECTION: Record<string, string> = {
  failures: "failures",
  deadletter: "deadletter",
  stuck: "stuck",
  relay: "relay",
};

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
  const [searchParams] = useSearchParams();
  const { formatDate } = useFormattedDate();

  const formatDateTime = (iso: string) =>
    formatDate(iso, {
      dateFormatOptions: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    });

  useEffect(() => {
    const focus = searchParams.get("focus");
    const id = focus ? FOCUS_SECTION[focus] : null;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-primary/35", "rounded-xl", "ring-2");
    const t = window.setTimeout(() => {
      el.classList.remove("ring-primary/35", "rounded-xl", "ring-2");
    }, 2400);
    return () => {
      window.clearTimeout(t);
    };
  }, [searchParams]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow from loose loader type
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    return <div className="p-4">Access denied.</div>;
  }
  const d = raw as Awaited<ReturnType<typeof getAdminOperationsPageData>>;

  const failedJobs =
    d.failedPosts.length + d.deadLetters.length + d.failedPayouts.length;

  const sum = d.operationalSummary;

  return (
    <div>
      <AdminPageHeader
        title="Operations"
        subtitle="Failures, dead letters, queues, and outbox — surgical view for incident response."
        generatedAt={d.generatedAt}
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <AdminCard
          variant="emphasis"
          className="border-primary/20 sticky top-[52px] z-[5] shadow-md backdrop-blur-sm lg:top-14"
        >
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Current operational state
          </p>
          <p className="text-foreground mt-1 text-sm leading-snug font-medium">
            {sum.headline}
          </p>
          <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
            <span>Stuck publishing: {sum.stuckPublishing}</span>
            <span>Outbox dead-lettered: {sum.outboxDeadLettered}</span>
            <span>
              Oldest sample:{" "}
              {sum.oldestUnresolvedIso
                ? formatDateTime(sum.oldestUnresolvedIso)
                : "—"}
            </span>
          </div>
          <p className="text-foreground/90 mt-3 text-sm">{sum.nextStep}</p>
        </AdminCard>

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

        <section className="space-y-2" id="relay">
          <h2 className="text-lg font-semibold">Relay publish ACKs (range)</h2>
          <p className="text-muted-foreground text-sm">
            {d.relayAcks.accepted + d.relayAcks.failed === 0
              ? "No relay acknowledgement rows in this window."
              : `${d.relayAcks.accepted} accepted vs ${d.relayAcks.failed} failed/timeout${
                  d.relayAcks.ratePct !== null
                    ? ` (${d.relayAcks.ratePct}% OK)`
                    : ""
                }. User relay sets vary; compare with Overview alerts.`}
          </p>
        </section>

        <section className="space-y-2" id="stuck">
          <h2 className="text-lg font-semibold">Stuck in publishing</h2>
          <p className="text-muted-foreground text-sm">
            Posts in PUBLISHING longer than the stuck threshold (see metric
            definitions). Count:{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {sum.stuckPublishing}
            </span>
            .
          </p>
        </section>

        <AdminSection eyebrow="Queues" title="Queue depth">
          <AdminDataTable>
            <AdminDataTableHead>
              <tr>
                <th className="p-2 text-left">Queue</th>
                <th className="p-2 text-right">Waiting</th>
                <th className="p-2 text-right">Active</th>
                <th className="p-2 text-right">Failed</th>
                <th className="p-2 text-right">Delayed</th>
              </tr>
            </AdminDataTableHead>
            <tbody>
              {d.queueDepths.map((q) => (
                <tr key={q.queue}>
                  <td className="p-2 font-mono text-xs">{q.queue}</td>
                  <td className="p-2 text-right tabular-nums">{q.waiting}</td>
                  <td className="p-2 text-right tabular-nums">{q.active}</td>
                  <td className="p-2 text-right tabular-nums">{q.failed}</td>
                  <td className="p-2 text-right tabular-nums">{q.delayed}</td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        </AdminSection>

        {d.outbox ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Outbox</h2>
            <p className="text-muted-foreground text-sm">
              Pending: {d.outbox.pending} · Ready: {d.outbox.ready} ·
              Dead-lettered: {d.outbox.deadLettered}
            </p>
          </section>
        ) : null}

        {d.failuresByReason.length > 0 ? (
          <AdminSection
            eyebrow="Triage"
            title="Failures by reason (sample)"
            description="Grouped from publish failure rows currently loaded."
          >
            <AdminDataTable density="compact">
              <AdminDataTableHead>
                <tr>
                  <th className="p-2 text-left">Reason</th>
                  <th className="p-2 text-right">Count</th>
                </tr>
              </AdminDataTableHead>
              <tbody>
                {d.failuresByReason.map((row) => (
                  <tr key={row.reason}>
                    <td className="text-muted-foreground max-w-md p-2 text-xs">
                      {row.reason}
                    </td>
                    <td className="p-2 text-right tabular-nums">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
          </AdminSection>
        ) : null}

        <section className="scroll-mt-24 space-y-2" id="failures">
          <h2 className="text-lg font-semibold">Publish failures</h2>
          <AdminDataTable>
            <AdminDataTableHead>
              <tr>
                <th className="p-2 text-left">Updated</th>
                <th className="p-2 text-left">Kind</th>
                <th className="p-2 text-left">Account</th>
                <th className="p-2 text-left">Reason</th>
              </tr>
            </AdminDataTableHead>
            <tbody>
              {d.failedPosts.length === 0 ? (
                <AdminDataTableEmpty colSpan={4}>
                  No failed posts in range.
                </AdminDataTableEmpty>
              ) : (
                d.failedPosts.map((p) => (
                  <tr key={`${p.kind}-${p.id}`}>
                    <td className="p-2 text-xs whitespace-nowrap">
                      {formatDateTime(p.updatedAt)}
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
          </AdminDataTable>
        </section>

        <section className="scroll-mt-24 space-y-2" id="deadletter">
          <h2 className="text-lg font-semibold">Dead-letter queue</h2>
          <p className="text-muted-foreground text-xs">
            Replay via{" "}
            <code className="text-foreground">
              scripts/replay-queue-dead-letter.ts
            </code>{" "}
            when appropriate.
          </p>
          <AdminDataTable>
            <AdminDataTableHead>
              <tr>
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Queue</th>
                <th className="p-2 text-left">Post</th>
                <th className="p-2 text-left">Error</th>
              </tr>
            </AdminDataTableHead>
            <tbody>
              {d.deadLetters.length === 0 ? (
                <AdminDataTableEmpty colSpan={4}>
                  No dead-letter rows in range.
                </AdminDataTableEmpty>
              ) : (
                d.deadLetters.map((row) => (
                  <tr key={row.id}>
                    <td className="p-2 text-xs whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
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
          </AdminDataTable>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Failed referral payouts</h2>
          <AdminDataTable>
            <AdminDataTableHead>
              <tr>
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Referrer</th>
                <th className="p-2 text-right">Sats</th>
                <th className="p-2 text-left">Reason</th>
              </tr>
            </AdminDataTableHead>
            <tbody>
              {d.failedPayouts.length === 0 ? (
                <AdminDataTableEmpty colSpan={4}>
                  None in range.
                </AdminDataTableEmpty>
              ) : (
                d.failedPayouts.map((e) => (
                  <tr key={e.id}>
                    <td className="p-2 text-xs">
                      {formatDateTime(e.createdAt)}
                    </td>
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
          </AdminDataTable>
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
