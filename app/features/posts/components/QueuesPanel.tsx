import { Link, useFetcher, useRevalidator } from "@remix-run/react";
import {
  ListPlus,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { StatusIcon } from "~/components/ui/status-icon";
import { queueCapExceededMessage } from "~/features/payments/entitlements/entitlement-messages";
import {
  DASHBOARD_PAIR_CARD_CLASS,
  DASHBOARD_PAIR_CARD_CONTENT_CLASS,
  DASHBOARD_PAIR_CARD_HEADER_CLASS,
  DASHBOARD_PAIR_HEADER_ACTION_CLASS,
} from "~/features/posts/components/dashboard-pair-card";
import { buildComposeCreateUrl } from "~/features/posts/composer";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import { isQueuePaused } from "~/features/posts/queue-status";
import { runQueueResumeAutoResign } from "~/features/posts/scheduling/utils/queue-resume-auto-resign.client";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import type { QueueType } from "../types";

import { QueueLanesPreview } from "./queue-health-empty-preview";
import {
  estimatePostsPerDayForQueue,
  formatNextQueuePostLine,
  formatQueueCadenceRichDisplay,
  formatQueueRunwayDaysLabel,
} from "./queue-runway";

/** Default icon weight in row toolbars; resume/play is slightly stronger when queue is paused. */
const QUEUE_ROW_ICON_CLASS =
  "opacity-[0.42] text-text-secondary hover:opacity-100 focus-visible:opacity-100 motion-fast hover:text-text";

const QUEUE_ROW_RESUME_PLAY_CLASS =
  "opacity-[0.82] text-text-secondary hover:opacity-100 focus-visible:opacity-100 motion-fast hover:text-text";

type QueueToggleFetcherData =
  | {
      success: true;
      needsResignCount?: number;
      resumedCount?: number;
      pausedPostCount?: number;
      pausedLongFormCount?: number;
    }
  | { error: string };

type ToggleSuccessData = Extract<QueueToggleFetcherData, { success: true }>;

function isQueueToggleSuccess(
  data: QueueToggleFetcherData
): data is ToggleSuccessData {
  return "success" in data;
}

function buildResumeQueueSuccessFeedback(data: ToggleSuccessData): {
  variant: "success";
  message: string;
  scheduledLink?: boolean;
} {
  const needsResign = data.needsResignCount ?? 0;
  const resumed = data.resumedCount ?? 0;
  let message: string;
  let scheduledLink = false;
  if (needsResign > 0 && resumed > 0) {
    message = `Queue resumed. ${resumed} ${resumed === 1 ? "post" : "posts"} republished; signing ${needsResign} rescheduled ${needsResign === 1 ? "item" : "items"} now.`;
    scheduledLink = false;
  } else if (needsResign > 0) {
    message = `Queue resumed. Your signer will authorize ${needsResign} rescheduled ${needsResign === 1 ? "item" : "items"}.`;
    scheduledLink = false;
  } else if (resumed > 0) {
    message = `Queue resumed; ${resumed} scheduled ${resumed === 1 ? "post is" : "posts are"} back on the calendar.`;
  } else {
    message = "Queue resumed.";
  }
  return {
    variant: "success",
    message,
    scheduledLink,
  };
}

function buildPauseQueueSuccessFeedback(data: ToggleSuccessData): {
  variant: "success";
  message: string;
} {
  const posts = data.pausedPostCount ?? 0;
  const lf = data.pausedLongFormCount ?? 0;
  const total = posts + lf;
  return {
    variant: "success",
    message:
      total > 0
        ? `Queue paused; ${total} scheduled ${total === 1 ? "item" : "items"} held.`
        : "Queue paused.",
  };
}

export interface QueuesPanelProps {
  /** Queue definitions in display order (same as settings). */
  queueTypes: QueueType[];
  queueCounts: Array<{ queueName: string; count: number }>;
  /** Composer / interval queues: global quick-pick hours (for runway when a queue uses global interval). */
  globalScheduleIntervalHours: number[];
  onCreateQueueClick?: () => void;
  onEditQueue?: (queue: QueueType) => void;
  /** When false, create is blocked (plan limit). */
  canCreateMoreQueues: boolean;
  queuesLimit: number | null;
  /**
   * Earliest future scheduled time per queue name from loaded flow items (dashboard only).
   */
  earliestNextScheduledUtcMsByQueueName?: Record<string, number>;
  /** IANA TZ for formatting “Next: …”. */
  userTimezone?: string;
  /** Prefer 12-hour clock in next-time copy. */
  hour12Preferred?: boolean;
  /**
   * Wall-clock ms for relative “Next: …” copy. The dashboard should pass the
   * same value used to build earliest-next timestamps from flow; otherwise a
   * stable mount-time value is used once.
   */
  referenceNowMs?: number;
}

export function QueuesPanel({
  queueTypes,
  queueCounts,
  globalScheduleIntervalHours,
  onCreateQueueClick,
  onEditQueue,
  canCreateMoreQueues,
  queuesLimit,
  earliestNextScheduledUtcMsByQueueName = {},
  referenceNowMs: referenceNowMsProp,
  userTimezone = "Etc/UTC",
  hour12Preferred = true,
}: QueuesPanelProps) {
  const [clientReferenceNowMs] = useState(() => Date.now());
  const referenceNowMs = referenceNowMsProp ?? clientReferenceNowMs;
  const revalidator = useRevalidator();
  const toggleFetcher = useFetcher<QueueToggleFetcherData>();
  const prevFetcherSubmitting = useRef(false);
  const lastProcessedFetcherJson = useRef<string | null>(null);

  const [pendingIntent, setPendingIntent] = useState<{
    queueId: string;
    action: "pause_queue" | "resume_queue";
  } | null>(null);

  const [feedback, setFeedback] = useState<
    | {
        variant: "success";
        message: string;
        scheduledLink?: boolean;
      }
    | { variant: "error"; message: string }
    | null
  >(null);

  const lastActionMetaRef = useRef<{
    action: "pause_queue" | "resume_queue";
  } | null>(null);
  /** Queue whose resume action should trigger automatic batch signing on success. */
  const lastResumeQueueIdRef = useRef<string | null>(null);

  const countByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const { queueName, count } of queueCounts) {
      if (queueName === "Unassigned") continue;
      m.set(queueName, count);
    }
    return m;
  }, [queueCounts]);

  const maxQueueCountForVolume = useMemo(() => {
    let max = 1;
    for (const qt of queueTypes) {
      const c = countByName.get(qt.name) ?? 0;
      if (c > max) max = c;
    }
    return max;
  }, [queueTypes, countByName]);

  useEffect(() => {
    if (feedback?.variant !== "success") return;
    const t = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    const data = toggleFetcher.data;
    const isIdle = toggleFetcher.state === "idle";
    const becameIdle = isIdle && prevFetcherSubmitting.current && data != null;
    prevFetcherSubmitting.current = !isIdle;

    if (!isIdle) return;

    if (!becameIdle) return;

    const dedupeKey = JSON.stringify(data);
    if (lastProcessedFetcherJson.current === dedupeKey) return;
    lastProcessedFetcherJson.current = dedupeKey;

    queueMicrotask(() => {
      if ("error" in data && data.error) {
        setFeedback({ variant: "error", message: data.error });
        return;
      }

      if (!isQueueToggleSuccess(data)) return;

      revalidator.revalidate();

      const meta = lastActionMetaRef.current;
      lastActionMetaRef.current = null;

      if (meta?.action === "resume_queue") {
        const needsResignHint = data.needsResignCount ?? 0;
        const queueIdForResign = lastResumeQueueIdRef.current;
        lastResumeQueueIdRef.current = null;

        setFeedback(buildResumeQueueSuccessFeedback(data));

        // Always run batch resign after resume: rows can already be
        // NEEDS_RESIGN_AFTER_QUEUE_RESUME (e.g. left from a prior resume) and are
        // not part of the HELD_BY_QUEUE batch, so the action's count alone can be 0.
        if (queueIdForResign) {
          void (async () => {
            const tid = toast.loading(
              needsResignHint > 0
                ? `Signing ${needsResignHint} scheduled ${needsResignHint === 1 ? "item" : "items"}…`
                : "Checking for posts that need signatures…"
            );
            const outcome = await runQueueResumeAutoResign({
              queueTypeId: queueIdForResign,
              queueTypes,
            });
            toast.dismiss(tid);
            if (outcome.ok) {
              if (outcome.signedCount > 0) {
                toast.success(
                  outcome.signedCount === 1
                    ? "1 item signed and scheduled."
                    : `${outcome.signedCount} items signed and scheduled.`
                );
              }
            } else {
              toast.error(outcome.message);
            }
            revalidator.revalidate();
          })();
        }
        return;
      }

      if (meta?.action === "pause_queue") {
        setFeedback(buildPauseQueueSuccessFeedback(data));
      }
    });
  }, [toggleFetcher.data, toggleFetcher.state, revalidator, queueTypes]);

  const createDisabled = !canCreateMoreQueues || !onCreateQueueClick;
  const createTitle =
    !canCreateMoreQueues && queuesLimit != null
      ? queueCapExceededMessage(queuesLimit)
      : undefined;

  const handleCreateClick = () => {
    if (!onCreateQueueClick) return;
    if (!canCreateMoreQueues && queuesLimit != null) {
      toast.error(queueCapExceededMessage(queuesLimit));
      return;
    }
    onCreateQueueClick();
  };

  const submitQueueAction = (
    queue: QueueType,
    action: "pause_queue" | "resume_queue"
  ) => {
    const fd = new FormData();
    fd.set("_action", action);
    fd.set("id", queue.id);
    lastProcessedFetcherJson.current = null;
    lastActionMetaRef.current = { action };
    if (action === "resume_queue") {
      lastResumeQueueIdRef.current = queue.id;
    }
    setFeedback(null);
    setPendingIntent({ queueId: queue.id, action });
    toggleFetcher.submit(fd, { method: "post", action: "/dashboard/settings" });
  };

  return (
    <section
      className="flex w-full min-w-0 flex-col lg:min-h-0 lg:flex-1"
      aria-label="Queues"
    >
      <Card className={DASHBOARD_PAIR_CARD_CLASS}>
        <CardHeader className={DASHBOARD_PAIR_CARD_HEADER_CLASS}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h3 className="text-overline text-text-secondary">Queues</h3>
          </div>
          <div className="flex shrink-0 items-center">
            {onCreateQueueClick ? (
              <button
                type="button"
                disabled={createDisabled}
                title={createTitle}
                onClick={handleCreateClick}
                className={cn(
                  DASHBOARD_PAIR_HEADER_ACTION_CLASS,
                  createDisabled && "pointer-events-none opacity-40"
                )}
              >
                <Plus
                  className="size-3.5 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span>Create Queue</span>
              </button>
            ) : (
              <Link
                to="/dashboard/settings?tab=publishing"
                className={DASHBOARD_PAIR_HEADER_ACTION_CLASS}
              >
                <Plus
                  className="size-3.5 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span>Create Queue</span>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className={DASHBOARD_PAIR_CARD_CONTENT_CLASS}>
          {feedback?.variant === "success" ? (
            <p className="text-success mb-1.5 text-[11px] leading-snug">
              {feedback.message}
              {feedback.scheduledLink ? (
                <>
                  {" "}
                  <Link
                    to="/dashboard/scheduled"
                    className="font-medium underline underline-offset-2"
                  >
                    Open Scheduled
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {feedback?.variant === "error" ? (
            <div className="border-danger/30 bg-danger/10 text-danger mb-1.5 rounded-md border px-2 py-1.5 text-xs">
              <span className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 flex-1">{feedback.message}</span>
                <button
                  type="button"
                  className="text-danger shrink-0 underline underline-offset-2"
                  onClick={() => setFeedback(null)}
                >
                  Dismiss
                </button>
              </span>
            </div>
          ) : null}
          {queueTypes.length === 0 ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-1 py-3">
              <div className="flex w-full max-w-[17.5rem] flex-col items-center text-center">
                <div className="mb-3">
                  <QueueLanesPreview />
                </div>
                <h4 className="text-text mb-1 text-sm font-semibold tracking-tight">
                  No queues yet
                </h4>
                <p className="text-text-secondary mb-4 max-w-[17.5rem] text-xs leading-snug text-pretty">
                  Create publishing lanes for your content. Each queue keeps its
                  own cadence, runway, and scheduled backlog.
                </p>
                <div className="flex flex-col items-center gap-1">
                  {onCreateQueueClick ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateClick}
                      disabled={createDisabled}
                      title={createTitle}
                    >
                      Create first queue
                    </Button>
                  ) : (
                    <Button size="sm" asChild>
                      <Link to="/dashboard/settings?tab=publishing">
                        Create first queue
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-text-secondary hover:text-text h-auto py-1.5 font-normal"
                    asChild
                  >
                    <Link
                      to="/dashboard/settings?tab=publishing"
                      className="no-underline"
                    >
                      Queue settings
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <ul className="divide-border-subtle/60 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
                {queueTypes.map((qt) => {
                  const inQueue = countByName.get(qt.name) ?? 0;
                  const postsPerDay = estimatePostsPerDayForQueue(
                    qt,
                    globalScheduleIntervalHours
                  );
                  const runwayLabel = formatQueueRunwayDaysLabel(
                    inQueue,
                    postsPerDay
                  );
                  const cadenceRich = formatQueueCadenceRichDisplay(
                    qt,
                    globalScheduleIntervalHours,
                    postsPerDay
                  );
                  const token = qt.colorToken ?? null;
                  const dotColor =
                    token != null && token !== ""
                      ? getQueueAccentHex(token)
                      : (qt.color ?? "#6B7280");
                  const paused = isQueuePaused(qt);
                  const scheduledUrl = `/dashboard/scheduled?queueType=${encodeURIComponent(qt.name)}`;
                  const composeUrl = buildComposeCreateUrl({ queue: qt.name });
                  const nextMs =
                    earliestNextScheduledUtcMsByQueueName[qt.name] ?? undefined;
                  const nextLine =
                    !paused &&
                    typeof nextMs === "number" &&
                    Number.isFinite(nextMs)
                      ? formatNextQueuePostLine(
                          nextMs,
                          referenceNowMs,
                          userTimezone,
                          hour12Preferred
                        )
                      : null;
                  const volumePct =
                    maxQueueCountForVolume > 0
                      ? Math.round((inQueue / maxQueueCountForVolume) * 100)
                      : 0;

                  return (
                    <li
                      key={qt.id}
                      className="flex min-w-0 items-start gap-2.5 py-3.5"
                    >
                      <div
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span className="text-text truncate text-xs font-semibold tracking-tight">
                                {qt.name}
                              </span>
                              {paused ? (
                                <span className="border-border-subtle text-text-secondary inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                                  Paused
                                </span>
                              ) : null}
                            </div>
                            <div
                              className="bg-border-subtle/35 h-[3px] w-full max-w-[11rem] overflow-hidden rounded-full"
                              aria-hidden
                            >
                              <div
                                className="h-full rounded-full opacity-[0.65]"
                                style={{
                                  width: `${Math.max(inQueue > 0 ? 8 : 3, volumePct)}%`,
                                  backgroundColor: dotColor,
                                }}
                              />
                            </div>
                            <div className="text-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-relaxed">
                              {cadenceRich ? (
                                <span className="min-w-0">{cadenceRich}</span>
                              ) : null}
                              {cadenceRich && runwayLabel !== "—" ? (
                                <span
                                  className="text-text-tertiary/55 shrink-0"
                                  aria-hidden
                                >
                                  ·
                                </span>
                              ) : null}
                              {!paused ? (
                                <span className="tabular-nums">
                                  Runway {runwayLabel}
                                </span>
                              ) : (
                                <span className="text-text-tertiary tabular-nums">
                                  -
                                </span>
                              )}
                            </div>
                            {nextLine ? (
                              <p className="text-text-tertiary text-[11px] leading-relaxed">
                                {nextLine}
                              </p>
                            ) : null}
                            {paused ? (
                              <p className="text-text-tertiary text-[11px] leading-relaxed">
                                Not sending
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end pt-0.5 text-right">
                            <span className="text-text text-sm font-semibold tracking-tight tabular-nums">
                              {inQueue}
                            </span>
                            <span className="text-text-secondary mt-0.5 text-[11px] font-medium tabular-nums">
                              {paused ? "held" : "queued"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                        {onEditQueue ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn("size-8", QUEUE_ROW_ICON_CLASS)}
                            onClick={() => onEditQueue(qt)}
                            aria-label={`Edit ${qt.name}`}
                          >
                            <Pencil className={INLINE_ICON_SIZE_CLASS} />
                          </Button>
                        ) : null}
                        {paused ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn("size-8", QUEUE_ROW_ICON_CLASS)}
                            disabled
                            title={`${qt.name} is paused`}
                            aria-label={`${qt.name} is paused`}
                          >
                            <ListPlus className={INLINE_ICON_SIZE_CLASS} />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn("size-8", QUEUE_ROW_ICON_CLASS)}
                            asChild
                          >
                            <Link
                              to={composeUrl}
                              aria-label={`Add post to ${qt.name}`}
                            >
                              <ListPlus className={INLINE_ICON_SIZE_CLASS} />
                            </Link>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "size-8",
                            paused
                              ? QUEUE_ROW_RESUME_PLAY_CLASS
                              : QUEUE_ROW_ICON_CLASS
                          )}
                          disabled={toggleFetcher.state !== "idle"}
                          aria-busy={
                            pendingIntent?.queueId === qt.id
                              ? toggleFetcher.state !== "idle"
                              : undefined
                          }
                          onClick={() =>
                            submitQueueAction(
                              qt,
                              paused ? "resume_queue" : "pause_queue"
                            )
                          }
                          aria-label={
                            paused ? `Resume ${qt.name}` : `Pause ${qt.name}`
                          }
                        >
                          {pendingIntent?.queueId === qt.id &&
                          toggleFetcher.state !== "idle" ? (
                            <span className="inline-flex items-center justify-center">
                              <StatusIcon tone="pending" size="sm" />
                              <span className="sr-only">
                                {paused ? "Resuming queue" : "Pausing queue"}
                              </span>
                            </span>
                          ) : paused ? (
                            <Play className={INLINE_ICON_SIZE_CLASS} />
                          ) : (
                            <Pause className={INLINE_ICON_SIZE_CLASS} />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn("size-8", QUEUE_ROW_ICON_CLASS)}
                              aria-label={`More actions for ${qt.name}`}
                            >
                              <MoreHorizontal
                                className={INLINE_ICON_SIZE_CLASS}
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link to={scheduledUrl}>View scheduled</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/dashboard/settings?tab=publishing">
                                Publishing settings
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {queueTypes.length > 0 && queueTypes.length <= 2 ? (
                <div className="border-border-subtle/40 mt-1 border-t pt-2.5">
                  <p className="text-text-secondary/85 text-[11px] leading-snug">
                    Create queues for different content types to keep your flow
                    consistent.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
