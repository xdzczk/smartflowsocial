import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import {
  cleanFailedJobsInAllQueues,
  purgePublishRelayAcksAdmin,
} from "~/features/admin/repositories/admin-operations-cleanup.server";
import { getAdminOperationsPageData } from "~/features/admin/repositories/admin-operations-queries.server";
import type { DeadLetterRow } from "~/features/admin/repositories/admin-operations-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import { retryDeadLetterJob } from "~/infra/queue/dead-letter-queue.server";
import { withCSRFProtection } from "~/lib/csrf";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

const FOCUS_SECTION: Record<string, string> = {
  failures: "failures",
  deadletter: "deadletter",
  stuck: "stuck",
  relay: "relay",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readActionError(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const e = data["error"];
  return typeof e === "string" ? e : null;
}

function readCleanFailedPayload(
  data: unknown
): { total: number; byQueue: Record<string, number> } | null {
  if (!isRecord(data)) return null;
  const cf = data["cleanFailed"];
  if (!isRecord(cf)) return null;
  const total = cf["total"];
  const byQueueRaw = cf["byQueue"];
  if (typeof total !== "number" || !isRecord(byQueueRaw)) return null;
  const byQueue: Record<string, number> = {};
  for (const [k, v] of Object.entries(byQueueRaw)) {
    if (typeof v !== "number") return null;
    byQueue[k] = v;
  }
  return { total, byQueue };
}

function readPurgeRelayAckPayload(data: unknown): {
  deletedCount: number;
  cutoffIso: string;
  olderThanDays: number;
} | null {
  if (!isRecord(data)) return null;
  const pr = data["purgeRelayAcks"];
  if (!isRecord(pr)) return null;
  const deletedCount = pr["deletedCount"];
  const cutoffIso = pr["cutoffIso"];
  const olderThanDays = pr["olderThanDays"];
  if (
    typeof deletedCount !== "number" ||
    typeof cutoffIso !== "string" ||
    typeof olderThanDays !== "number"
  ) {
    return null;
  }
  return { deletedCount, cutoffIso, olderThanDays };
}

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

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const user = await requireUser(request);
    if (!isReferralAdmin(user.npub)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const op = formData.get("_action");

    if (op === "replay_dead_letter") {
      const entryId = String(formData.get("entry_id") ?? "").trim();
      const confirmPhrase = String(formData.get("confirm_phrase") ?? "").trim();
      if (!entryId) {
        return json(
          { error: "Missing dead-letter entry id." },
          { status: 400 }
        );
      }
      if (confirmPhrase !== "REPLAY") {
        return json(
          { error: "Type REPLAY in the confirmation field to proceed." },
          { status: 400 }
        );
      }

      const result = await retryDeadLetterJob(entryId);
      if (!result.success) {
        return json(
          { error: result.error ?? "Could not re-enqueue job." },
          { status: 422 }
        );
      }

      return json({ ok: true as const });
    }

    if (op === "clean_failed_jobs") {
      const confirmPhrase = String(formData.get("confirm_phrase") ?? "").trim();
      if (confirmPhrase !== "CLEAN") {
        return json(
          { error: "Type CLEAN in the confirmation field to proceed." },
          { status: 400 }
        );
      }
      const cleaned = await cleanFailedJobsInAllQueues({
        operatorNpub: user.npub,
      });
      if (!cleaned.ok) {
        return json({ error: cleaned.error }, { status: 422 });
      }
      return json({
        ok: true as const,
        cleanFailed: {
          total: cleaned.total,
          byQueue: cleaned.byQueue,
        },
      });
    }

    if (op === "purge_relay_acks") {
      const confirmPhrase = String(formData.get("confirm_phrase") ?? "").trim();
      if (confirmPhrase !== "PURGE") {
        return json(
          { error: "Type PURGE in the confirmation field to proceed." },
          { status: 400 }
        );
      }
      const daysRaw = String(formData.get("older_than_days") ?? "30").trim();
      const olderThanDays = parseInt(daysRaw, 10);
      if (!Number.isFinite(olderThanDays)) {
        return json({ error: "Invalid older_than_days." }, { status: 400 });
      }

      const purged = await purgePublishRelayAcksAdmin({
        olderThanDays,
        operatorNpub: user.npub,
      });
      if (!purged.ok) {
        return json({ error: purged.error }, { status: 422 });
      }
      return json({
        ok: true as const,
        purgeRelayAcks: {
          deletedCount: purged.deletedCount,
          cutoffIso: purged.cutoffIso,
          olderThanDays: purged.olderThanDays,
        },
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  }
);

export default function AdminOperationsPage() {
  const raw = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const cleanFetcher = useFetcher<typeof action>();
  const purgeFetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const focusParam = searchParams.get("focus");
  const [replayTarget, setReplayTarget] = useState<DeadLetterRow | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [cleanError, setCleanError] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [maintenanceNotice, setMaintenanceNotice] = useState<string | null>(
    null
  );
  const { formatDate } = useFormattedDate();

  const formatDateTime = (iso: string) =>
    formatDate(iso, {
      dateFormatOptions: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    });

  useEffect(() => {
    const id = focusParam ? FOCUS_SECTION[focusParam] : null;
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
  }, [focusParam]);

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const data: unknown = fetcher.data;
    if (data === undefined || data === null) return;
    const err = readActionError(data);
    if (err !== null) {
      queueMicrotask(() => setReplayError(err));
      return;
    }
    if (isRecord(data) && data["ok"] === true && replayTarget !== null) {
      queueMicrotask(() => {
        setReplayError(null);
        setReplayTarget(null);
        revalidator.revalidate();
      });
    }
  }, [fetcher.state, fetcher.data, revalidator, replayTarget]);

  useEffect(() => {
    if (cleanFetcher.state !== "idle") return;
    const data: unknown = cleanFetcher.data;
    if (data === undefined || data === null) return;
    const err = readActionError(data);
    if (err !== null) {
      queueMicrotask(() => setCleanError(err));
      return;
    }
    const cf = readCleanFailedPayload(data);
    if (cf !== null) {
      queueMicrotask(() => {
        setCleanError(null);
        setCleanDialogOpen(false);
        setMaintenanceNotice(
          `Cleaned ${cf.total} failed job(s) from Redis (${Object.entries(
            cf.byQueue
          )
            .map(([q, n]) => `${q}: ${n}`)
            .join(" · ")}).`
        );
        revalidator.revalidate();
      });
    }
  }, [cleanFetcher.state, cleanFetcher.data, revalidator]);

  useEffect(() => {
    if (purgeFetcher.state !== "idle") return;
    const data: unknown = purgeFetcher.data;
    if (data === undefined || data === null) return;
    const err = readActionError(data);
    if (err !== null) {
      queueMicrotask(() => setPurgeError(err));
      return;
    }
    const pr = readPurgeRelayAckPayload(data);
    if (pr !== null) {
      queueMicrotask(() => {
        setPurgeError(null);
        setPurgeDialogOpen(false);
        setMaintenanceNotice(
          `Deleted ${pr.deletedCount} relay ACK row(s) with createdAt before ${pr.cutoffIso} (older than ${pr.olderThanDays}d).`
        );
        revalidator.revalidate();
      });
    }
  }, [purgeFetcher.state, purgeFetcher.data, revalidator]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow from loose loader type
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    return <div className="p-4">Access denied.</div>;
  }
  const d = raw as Awaited<ReturnType<typeof getAdminOperationsPageData>>;

  const failedJobs =
    d.failedPosts.length + d.deadLetters.length + d.failedPayouts.length;

  const sum = d.operationalSummary;

  const CleanFailedForm = cleanFetcher.Form;
  const PurgeRelayAckForm = purgeFetcher.Form;

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

        <AdminSection
          eyebrow="Maintenance"
          title="Operational cleanup"
          description="Removes Redis failed job records and old PublishRelayAck rows. Actions are logged server-side. Does not fix FAILED posts or DB dead-letter rows."
        >
          {maintenanceNotice ? (
            <div className="border-border bg-muted/40 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="text-foreground/90">{maintenanceNotice}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => setMaintenanceNotice(null)}
              >
                Dismiss
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                Boolean(d.queueError) || cleanFetcher.state === "submitting"
              }
              title={
                d.queueError
                  ? "Redis unreachable — cannot clean failed jobs."
                  : undefined
              }
              onClick={() => {
                setCleanError(null);
                setCleanDialogOpen(true);
              }}
            >
              Clean failed queue jobs…
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={purgeFetcher.state === "submitting"}
              onClick={() => {
                setPurgeError(null);
                setPurgeDialogOpen(true);
              }}
            >
              Purge old relay ACKs…
            </Button>
          </div>

          <Dialog open={cleanDialogOpen} onOpenChange={setCleanDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Clean failed BullMQ jobs</DialogTitle>
                <DialogDescription>
                  Permanently removes jobs in the <strong>failed</strong> state
                  from all scheduler queues (up to 10k per queue per run). This
                  does not change post rows or Postgres dead-letter entries.
                </DialogDescription>
              </DialogHeader>
              <CleanFailedForm method="post" className="space-y-4">
                <input type="hidden" name="_action" value="clean_failed_jobs" />
                {cleanError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {cleanError}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="clean-confirm-phrase">
                    Type <span className="font-mono">CLEAN</span> to confirm
                  </Label>
                  <Input
                    id="clean-confirm-phrase"
                    name="confirm_phrase"
                    autoComplete="off"
                    placeholder="CLEAN"
                  />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCleanDialogOpen(false);
                      setCleanError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={cleanFetcher.state === "submitting"}
                  >
                    {cleanFetcher.state === "submitting"
                      ? "Cleaning…"
                      : "Run cleanup"}
                  </Button>
                </DialogFooter>
              </CleanFailedForm>
            </DialogContent>
          </Dialog>

          <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Purge old relay ACK rows</DialogTitle>
                <DialogDescription>
                  Deletes{" "}
                  <code className="text-foreground">PublishRelayAck</code> rows
                  with <code className="text-foreground">createdAt</code> older
                  than the retention window (7–365 days). Newer rows are kept.
                </DialogDescription>
              </DialogHeader>
              <PurgeRelayAckForm method="post" className="space-y-4">
                <input type="hidden" name="_action" value="purge_relay_acks" />
                {purgeError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {purgeError}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="purge-older-days">Older than (days)</Label>
                  <Input
                    id="purge-older-days"
                    name="older_than_days"
                    type="number"
                    min={7}
                    max={365}
                    defaultValue={30}
                  />
                  <p className="text-muted-foreground text-xs">
                    Values outside 7–365 are clamped server-side.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purge-confirm-phrase">
                    Type <span className="font-mono">PURGE</span> to confirm
                  </Label>
                  <Input
                    id="purge-confirm-phrase"
                    name="confirm_phrase"
                    autoComplete="off"
                    placeholder="PURGE"
                  />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPurgeDialogOpen(false);
                      setPurgeError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={purgeFetcher.state === "submitting"}
                  >
                    {purgeFetcher.state === "submitting"
                      ? "Purging…"
                      : "Purge rows"}
                  </Button>
                </DialogFooter>
              </PurgeRelayAckForm>
            </DialogContent>
          </Dialog>
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
            Re-enqueue sends the job back to BullMQ (same as{" "}
            <code className="text-foreground">
              scripts/replay-queue-dead-letter.ts
            </code>
            ). Confirm with <span className="text-foreground">REPLAY</span>.
            {d.queueError ? (
              <>
                {" "}
                <span className="text-amber-600 dark:text-amber-500">
                  Queue stats failed to load — replay may not work until Redis
                  is reachable.
                </span>
              </>
            ) : null}
          </p>
          <AdminDataTable>
            <AdminDataTableHead>
              <tr>
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Queue</th>
                <th className="p-2 text-left">Job</th>
                <th className="p-2 text-left">Post</th>
                <th className="p-2 text-left">Error</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </AdminDataTableHead>
            <tbody>
              {d.deadLetters.length === 0 ? (
                <AdminDataTableEmpty colSpan={6}>
                  No dead-letter rows in range.
                </AdminDataTableEmpty>
              ) : (
                d.deadLetters.map((row) => (
                  <tr key={row.id}>
                    <td className="p-2 text-xs whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="p-2 font-mono text-xs">{row.queueType}</td>
                    <td className="max-w-[140px] truncate p-2 font-mono text-xs">
                      {row.jobId}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {row.postId ?? "—"}
                    </td>
                    <td className="text-muted-foreground max-w-md p-2 text-xs">
                      {row.error}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={
                          Boolean(d.queueError) ||
                          fetcher.state === "submitting"
                        }
                        title={
                          d.queueError
                            ? "Queue/Redis unavailable — fix connectivity before replaying."
                            : "Re-enqueue this job"
                        }
                        onClick={() => {
                          setReplayError(null);
                          setReplayTarget(row);
                        }}
                      >
                        Re-enqueue
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </AdminDataTable>

          <Dialog
            open={replayTarget !== null}
            onOpenChange={(open) => {
              if (!open) {
                setReplayTarget(null);
                setReplayError(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Re-enqueue dead-letter job</DialogTitle>
                <DialogDescription>
                  The row will be removed from the dead-letter table and queued
                  again immediately. Only do this if the underlying issue is
                  fixed.
                </DialogDescription>
              </DialogHeader>
              {replayTarget ? (
                <fetcher.Form method="post" className="space-y-4">
                  <input
                    type="hidden"
                    name="_action"
                    value="replay_dead_letter"
                  />
                  <input
                    type="hidden"
                    name="entry_id"
                    value={replayTarget.id}
                  />
                  <dl className="text-muted-foreground space-y-1 text-xs">
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium">Entry</dt>
                      <dd className="min-w-0 truncate font-mono">
                        {replayTarget.id}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium">Queue</dt>
                      <dd className="font-mono">{replayTarget.queueType}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium">Job</dt>
                      <dd className="min-w-0 truncate font-mono">
                        {replayTarget.jobId}
                      </dd>
                    </div>
                  </dl>
                  {replayError ? (
                    <p className="text-destructive text-sm" role="alert">
                      {replayError}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="dead-letter-confirm-phrase">
                      Type <span className="font-mono">REPLAY</span> to confirm
                    </Label>
                    <Input
                      id="dead-letter-confirm-phrase"
                      name="confirm_phrase"
                      autoComplete="off"
                      placeholder="REPLAY"
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setReplayTarget(null);
                        setReplayError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={fetcher.state === "submitting"}
                    >
                      {fetcher.state === "submitting"
                        ? "Re-enqueuing…"
                        : "Confirm re-enqueue"}
                    </Button>
                  </DialogFooter>
                </fetcher.Form>
              ) : null}
            </DialogContent>
          </Dialog>
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
