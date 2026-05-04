import { Clock, Plus, CheckSquare, LayoutDashboard } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { StatusIcon } from "~/components/ui/status-icon";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useOptionalUser } from "~/lib/remix-utils";

// Staged substatus messages shown while waiting for server/relay data.
// These rotate based on elapsed time from publish intent click.
const STAGED_SUBSTATUS: Array<{ afterMs: number; label: string }> = [
  { afterMs: 0, label: "Signing event…" },
  { afterMs: 700, label: "Connecting to relays…" },
  { afterMs: 1800, label: "Broadcasting to relays…" },
  { afterMs: 4000, label: "Waiting for relay acknowledgements…" },
];

function stagedSubstatusLabelFromElapsed(elapsedMs: number): string {
  for (let i = STAGED_SUBSTATUS.length - 1; i >= 0; i--) {
    const entry = STAGED_SUBSTATUS[i];
    if (entry && elapsedMs >= entry.afterMs) {
      return entry.label;
    }
  }
  return STAGED_SUBSTATUS[0]?.label ?? "Initializing publish…";
}

import { formatRelayUrl } from "../utils/publish-result.utils";

/**
 * Minimum time to show the publishing state before revealing per-relay rows.
 * Outcomes are already decided on the server before redirect; this only improves
 * perceived pacing so the modal does not snap to success/partial instantly.
 */
const MIN_RELAY_RESULTS_REVEAL_MS = 1000;

interface RelayAck {
  relayUrl: string;
  // PENDING = the relay is in the canonical intended set but the publisher
  // has not yet returned a result for it (or never did). The modal renders
  // PENDING rows so the user can see the full intended fanout target list,
  // not just the relays that already responded.
  status: "PENDING" | "ACCEPTED" | "FAILED" | "TIMEOUT";
  receivedAt: string | null;
  createdAt: string;
}

type StatusType = "scheduled" | "publishing" | "success" | "partial" | "failed";

// Helper component for status title
function StatusTitle({ status }: { status: StatusType }) {
  if (status === "scheduled") {
    return (
      <>
        <StatusIcon tone="success" size="xl" icon={Clock} />
        Scheduled Successfully
      </>
    );
  }
  if (status === "publishing") {
    return (
      <>
        <StatusIcon tone="pending" size="xl" className="text-info" />
        Publishing post
      </>
    );
  }
  if (status === "success") {
    return (
      <>
        <StatusIcon tone="success" size="xl" />
        Published
      </>
    );
  }
  if (status === "partial") {
    return (
      <>
        <StatusIcon tone="warning" size="xl" />
        Partially Published
      </>
    );
  }
  return (
    <>
      <StatusIcon tone="danger" size="xl" />
      Publish Failed
    </>
  );
}

function formatBulkScheduleDetail(
  formatScheduledTime: () => string,
  lastScheduledAt?: string | null,
  queueSummary?: Record<string, number> | string,
  formatLastTime?: () => string
): { firstTime: string; parts: string[] } {
  const firstTime = formatScheduledTime();
  const lastTime = lastScheduledAt && formatLastTime ? formatLastTime() : "";
  const queueStr =
    queueSummary != null
      ? typeof queueSummary === "string"
        ? queueSummary
        : Object.entries(queueSummary)
            .map(([name, n]) => `${name} (${n})`)
            .join(", ")
      : "";
  const parts: string[] = [];
  if (firstTime) parts.push(`First: ${firstTime}`);
  if (lastTime) parts.push(`Last: ${lastTime}`);
  if (queueStr) parts.push(`Queues: ${queueStr}`);
  return { firstTime, parts };
}

// Helper component for status description
function StatusDescription({
  action,
  status,
  postType,
  formatScheduledTime,
  bulkCount,
  lastScheduledAt,
  queueSummary,
  formatLastTime,
}: {
  action: "publish" | "schedule";
  status: StatusType;
  postType: "post" | "longform";
  formatScheduledTime: () => string;
  bulkCount?: number | null;
  lastScheduledAt?: string | null;
  queueSummary?: Record<string, number> | string;
  formatLastTime?: () => string;
}) {
  const contentType = postType === "longform" ? "article" : "post";

  // Use <span> so we can be used inside DialogDescription (which renders <p>); <p> cannot contain <p>
  if (action === "schedule") {
    if (bulkCount && bulkCount > 1) {
      const { firstTime, parts } = formatBulkScheduleDetail(
        formatScheduledTime,
        lastScheduledAt,
        queueSummary,
        formatLastTime
      );
      return (
        <span>
          Your {bulkCount} {contentType}s have been scheduled successfully.
          {parts.length > 0 ? (
            <> {parts.join(". ")}.</>
          ) : (
            <>
              {" "}
              The first post will be published at <strong>{firstTime}</strong>.
            </>
          )}
        </span>
      );
    }
    const timeStr = formatScheduledTime();
    return (
      <span>
        Your {contentType} has been scheduled
        {timeStr ? (
          <>
            {" "}
            and will be published at <strong>{timeStr}</strong>
          </>
        ) : null}
        .
      </span>
    );
  }

  if (status === "publishing") {
    return (
      <span>
        Sending your {contentType} to relays. This may take a few moments.
      </span>
    );
  }

  if (status === "success") {
    return (
      <span>Your {contentType} was published to relays successfully.</span>
    );
  }

  if (status === "partial") {
    return (
      <span>
        Your {contentType} was published to some relays, but some failed or
        timed out.
      </span>
    );
  }

  // status must be "failed" at this point
  return (
    <span>Your {contentType} could not be published. Please try again.</span>
  );
}

// Helper component for relay status badge
function RelayStatusBadge({
  status,
  substatus,
}: {
  status: RelayAck["status"];
  substatus?: "connecting";
}) {
  if (status === "ACCEPTED") {
    return (
      <span className="bg-success/12 text-success-text dark:bg-success/15 dark:text-success rounded-full px-2 py-1 text-xs font-medium">
        Accepted
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="bg-danger/12 text-danger-text dark:bg-danger/15 dark:text-danger rounded-full px-2 py-1 text-xs font-medium">
        Failed
      </span>
    );
  }
  if (status === "TIMEOUT") {
    return (
      <span className="bg-warning/12 text-warning-text dark:bg-warning/15 dark:text-warning rounded-full px-2 py-1 text-xs font-medium">
        Timed out
      </span>
    );
  }
  if (substatus === "connecting") {
    return (
      <span className="bg-info/10 text-info rounded-full px-2 py-1 text-xs font-medium">
        Connecting
      </span>
    );
  }
  // status must be "PENDING" at this point
  return (
    <span className="bg-surface-hover text-text-secondary rounded-full px-2 py-1 text-xs font-medium">
      Pending
    </span>
  );
}

function RelayStatusIcon({ status }: { status: RelayAck["status"] }) {
  if (status === "ACCEPTED") return <StatusIcon tone="success" size="lg" />;
  if (status === "FAILED") return <StatusIcon tone="danger" size="lg" />;
  if (status === "TIMEOUT")
    return <StatusIcon tone="warning" size="lg" icon={Clock} />;
  return <StatusIcon tone="pending" size="lg" />;
}

interface PublishResultModalProps {
  isOpen: boolean;
  postId: string;
  publishAttemptId: string | null;
  action: "publish" | "schedule";
  postType: "post" | "longform";
  scheduledFor?: Date | string | null;
  onCreateNew: () => void;
  onViewPage: () => void;
  /** Optional: when provided, shows a "Go to Dashboard" button. */
  onGoToDashboard?: () => void;
  bulkCount?: number | null;
  /** For bulk schedule: last post's scheduled time (ISO string). */
  lastScheduledAt?: string | null;
  /** For bulk schedule: queue name -> count. */
  queueSummary?: Record<string, number> | string;
  /**
   * When true, the modal was opened immediately on publish intent  -  before
   * a postId or relay data is available. Shows staged substatus copy and a
   * relay skeleton placeholder. Transitions automatically when postId arrives.
   */
  immediateProgress?: boolean;
  /**
   * Unix timestamp (Date.now()) when the publish intent fired.
   * Used to calculate staged substatus messages during the wait.
   */
  intentStartedAt?: number | null;
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- single dialog covers publish, schedule, bulk schedule, and relay polling */
export default function PublishResultModal({
  isOpen,
  postId,
  publishAttemptId,
  action,
  postType,
  scheduledFor,
  onCreateNew,
  onViewPage,
  onGoToDashboard,
  bulkCount,
  lastScheduledAt,
  queueSummary,
  immediateProgress = false,
  intentStartedAt,
}: PublishResultModalProps) {
  const [relayAcks, setRelayAcks] = useState<RelayAck[]>([]);
  const [relayResultsVisible, setRelayResultsVisible] = useState(false);
  const modalOpenedAtRef = useRef<number>(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Elapsed ms since publish intent, updated on an interval  -  never read
  // Date.now() during render (react-hooks/purity).
  const [stagedElapsedMs, setStagedElapsedMs] = useState(0);
  const runStagedSubstatusTicker =
    immediateProgress && intentStartedAt != null && relayAcks.length === 0;

  useEffect(() => {
    if (!runStagedSubstatusTicker) return;
    const startMs = intentStartedAt;
    const tick = (): void => {
      setStagedElapsedMs(Date.now() - startMs);
    };
    const id = setInterval(tick, 250);
    queueMicrotask(tick);
    return () => clearInterval(id);
  }, [runStagedSubstatusTicker, intentStartedAt]);

  const currentStagedSubstatus =
    immediateProgress && relayAcks.length === 0 && intentStartedAt != null
      ? stagedSubstatusLabelFromElapsed(stagedElapsedMs)
      : null;
  // When parent passes null (e.g. race after redirect), we may resolve via fetch
  const [resolvedPublishAttemptId, setResolvedPublishAttemptId] = useState<
    string | null
  >(publishAttemptId);
  // After trying to resolve publishAttemptId and failing (e.g. idempotent image post), show success anyway
  const [resolvedAttemptsGaveUp, setResolvedAttemptsGaveUp] = useState(false);

  const maxPollingAttempts = 10; // 10 attempts * 5 seconds = 50 seconds max
  const pollingInterval = 5000; // 5 seconds - increased to avoid rate limiting
  const maxResolveAttempts = 10;
  const resolveInterval = 2000;

  const relayAcksForUi = useMemo(
    () => (relayResultsVisible ? relayAcks : []),
    [relayResultsVisible, relayAcks]
  );

  // Helper function to calculate status from relay acks
  const calculateStatusFromAcks = useCallback(
    (acks: RelayAck[]): StatusType => {
      if (action === "schedule") {
        return "scheduled";
      }

      if (acks.length === 0) {
        return "publishing";
      }

      const acceptedCount = acks.filter(
        (ack) => ack.status === "ACCEPTED"
      ).length;
      const failedCount = acks.filter((ack) => ack.status === "FAILED").length;
      const timeoutCount = acks.filter(
        (ack) => ack.status === "TIMEOUT"
      ).length;
      const pendingCount = acks.filter(
        (ack) => ack.status === "PENDING"
      ).length;

      // Any PENDING row means at least one intended relay has not yet
      // returned a result; keep the modal in a publishing state until the
      // poller fills those in (or the receivedAt+TIMEOUT path catches up).
      if (pendingCount > 0 && acceptedCount === 0 && failedCount === 0) {
        return "publishing";
      }

      if (acceptedCount > 0 && failedCount === 0 && timeoutCount === 0) {
        // Treat "all responded relays accepted, some still pending" as a
        // partial success rather than full success so the user sees that
        // not every intended relay has confirmed yet.
        return pendingCount > 0 ? "partial" : "success";
      }
      if (acceptedCount > 0) {
        return "partial";
      }
      if (failedCount > 0 || timeoutCount > 0) {
        return "failed";
      }

      return "publishing";
    },
    [action]
  );

  // Sync resolved id from prop (e.g. when parent refetches and gets publishAttemptId)
  useEffect(() => {
    if (publishAttemptId == null) return;
    const id = publishAttemptId;
    const t = setTimeout(() => setResolvedPublishAttemptId(id), 0);
    return () => clearTimeout(t);
  }, [publishAttemptId]);

  // When modal opens for publish, reset and optionally resolve publishAttemptId if null (race after redirect)
  useEffect(() => {
    if (!isOpen || action !== "publish") return;
    const t = setTimeout(() => {
      modalOpenedAtRef.current = Date.now();
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setRelayResultsVisible(false);
      setRelayAcks([]);
      setHasTimedOut(false);
      setResolvedAttemptsGaveUp(false);
      setResolvedPublishAttemptId(publishAttemptId ?? null);
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen, action, publishAttemptId]);

  // After ACKs exist, wait at least MIN_RELAY_RESULTS_REVEAL_MS from modal open before showing rows.
  useEffect(() => {
    if (!isOpen || action !== "publish") {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      return;
    }
    if (relayAcks.length === 0) {
      queueMicrotask(() => {
        setRelayResultsVisible(false);
      });
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      return;
    }
    if (relayResultsVisible) return;
    if (revealTimerRef.current) return;

    const openedAt = modalOpenedAtRef.current || Date.now();
    const elapsed = Date.now() - openedAt;
    const delay = Math.max(0, MIN_RELAY_RESULTS_REVEAL_MS - elapsed);
    revealTimerRef.current = setTimeout(() => {
      revealTimerRef.current = null;
      setRelayResultsVisible(true);
    }, delay);
  }, [isOpen, action, relayAcks, relayResultsVisible]);

  // Resolve publishAttemptId by polling post when it was null (server may not have written it yet)
  const resolveAttemptsRef = useRef(0);
  const resolveIntervalIdRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  useEffect(() => {
    if (
      !isOpen ||
      action !== "publish" ||
      !postId ||
      resolvedPublishAttemptId != null
    ) {
      return;
    }
    resolveAttemptsRef.current = 0;
    const resolve = async () => {
      if (resolveAttemptsRef.current >= maxResolveAttempts) {
        if (resolveIntervalIdRef.current) {
          clearInterval(resolveIntervalIdRef.current);
          resolveIntervalIdRef.current = null;
        }
        setResolvedAttemptsGaveUp(true);
        return;
      }
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          post?: { publishAttemptId?: string | null };
          longFormPost?: { publishAttemptId?: string | null };
        };
        const id =
          data.post?.publishAttemptId ?? data.longFormPost?.publishAttemptId;
        if (id) {
          setResolvedPublishAttemptId(id);
          return;
        }
      } catch {
        // ignore
      }
      resolveAttemptsRef.current += 1;
    };
    const t = setInterval(() => {
      void resolve();
    }, resolveInterval);
    resolveIntervalIdRef.current = t;
    void resolve();
    return () => {
      clearInterval(t);
      resolveIntervalIdRef.current = null;
    };
  }, [
    isOpen,
    action,
    postId,
    resolvedPublishAttemptId,
    maxResolveAttempts,
    resolveInterval,
  ]);

  // Poll for relay acknowledgements (only for published posts, once we have an attempt id)
  useEffect(() => {
    if (!isOpen || action !== "publish" || !resolvedPublishAttemptId) {
      return;
    }

    let currentPollCount = 0;
    let backoffDelay = pollingInterval; // Start with base interval
    let pollTimeout: NodeJS.Timeout | null = null;
    let isPolling = true;
    let lastKnownAcks: RelayAck[] = [];

    // Start polling with exponential backoff on errors
    const poll = async () => {
      if (!isPolling) {
        return;
      }

      if (currentPollCount >= maxPollingAttempts) {
        // Check last known status before setting timeout
        const lastStatus = calculateStatusFromAcks(lastKnownAcks);
        if (lastStatus === "publishing" || lastStatus === "partial") {
          setTimeout(() => {
            setHasTimedOut(true);
          }, 0);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/publish-result?postId=${postId}&publishAttemptId=${resolvedPublishAttemptId}`
        );

        if (response.status === 429) {
          // Rate limited - increase backoff exponentially, max 30 seconds
          backoffDelay = Math.min(backoffDelay * 2, 30000);
          console.warn(
            "Rate limited (429), backing off to",
            backoffDelay,
            "ms"
          );
        } else if (response.ok) {
          // Success - reset backoff to base interval
          backoffDelay = pollingInterval;
          const data = (await response.json()) as {
            acks?: RelayAck[];
            error?: string;
          };
          if (data.acks) {
            const newAcks = data.acks;
            lastKnownAcks = newAcks; // Track last known acks
            const newStatus = calculateStatusFromAcks(newAcks);

            setTimeout(() => {
              setRelayAcks(newAcks);
            }, 0);

            // Stop polling if all relays have responded successfully
            if (newStatus === "success") {
              isPolling = false;
              if (pollTimeout) {
                clearTimeout(pollTimeout);
                pollTimeout = null;
              }
              return; // Don't increment poll count or schedule next poll
            }
          }
        } else {
          // Other error - use moderate backoff
          backoffDelay = Math.min(backoffDelay * 1.5, 20000);
        }
      } catch (error) {
        console.error("Error polling relay acks:", error);
        // Network error - use moderate backoff
        backoffDelay = Math.min(backoffDelay * 1.5, 20000);
      }

      currentPollCount += 1;
    };

    // Schedule next poll with backoff
    const scheduleNextPoll = () => {
      if (!isPolling) return;

      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
      pollTimeout = setTimeout(() => {
        if (!isPolling) return;
        void (async () => {
          await poll();
          // Only schedule next poll if still polling (not stopped due to success)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isPolling can be set to false by poll()
          if (isPolling) {
            scheduleNextPoll();
          }
        })();
      }, backoffDelay);
    };

    // Poll immediately, then schedule next
    void (async () => {
      await poll();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isPolling can be set to false by poll()
      if (isPolling) {
        scheduleNextPoll();
      }
    })();

    return () => {
      isPolling = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
  }, [
    isOpen,
    action,
    resolvedPublishAttemptId,
    postId,
    maxPollingAttempts,
    pollingInterval,
    calculateStatusFromAcks,
  ]);

  // Calculate relay status counts (respect minimum reveal delay for UI)
  const relayStatusCounts = useMemo(() => {
    const acceptedCount = relayAcksForUi.filter(
      (ack) => ack.status === "ACCEPTED"
    ).length;
    const failedCount = relayAcksForUi.filter(
      (ack) => ack.status === "FAILED"
    ).length;
    const timeoutCount = relayAcksForUi.filter(
      (ack) => ack.status === "TIMEOUT"
    ).length;
    const pendingCount = relayAcksForUi.filter(
      (ack) => ack.status === "PENDING"
    ).length;
    return { acceptedCount, failedCount, timeoutCount, pendingCount };
  }, [relayAcksForUi]);

  // Determine overall status
  const status = useMemo(() => {
    if (action === "schedule") {
      return "scheduled";
    }

    // Post was published but we never got publishAttemptId (e.g. idempotent image post); show success
    if (resolvedAttemptsGaveUp && relayAcks.length === 0) {
      return "success";
    }

    if (relayAcksForUi.length === 0) {
      return "publishing";
    }

    const { acceptedCount, failedCount, timeoutCount, pendingCount } =
      relayStatusCounts;

    // Mirror the early-return ack-poll logic: if every responded relay
    // accepted but some intended relays are still PENDING, treat as
    // partial so the user knows fanout isn't complete yet.
    if (pendingCount > 0 && acceptedCount === 0 && failedCount === 0) {
      return "publishing";
    }

    if (acceptedCount > 0 && failedCount === 0 && timeoutCount === 0) {
      return pendingCount > 0 ? "partial" : "success";
    }
    if (acceptedCount > 0) {
      return "partial";
    }
    if (failedCount > 0 || timeoutCount > 0) {
      return "failed";
    }

    return "publishing";
  }, [
    action,
    relayAcks.length,
    relayAcksForUi.length,
    relayStatusCounts,
    resolvedAttemptsGaveUp,
  ]);

  // Call hook before any conditional returns
  const user = useOptionalUser() ?? null;
  const { dateLocale } = useFormattedDate();

  // Early return if modal is not open to prevent blocking
  if (!isOpen) {
    return null;
  }
  const userTimezone =
    user && typeof user === "object" && "timezone" in user
      ? (user.timezone ?? "UTC")
      : "UTC";
  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

  // Format scheduled time
  const formatScheduledTime = () => {
    if (!scheduledFor) return "";
    try {
      const date =
        scheduledFor instanceof Date ? scheduledFor : new Date(scheduledFor);
      return date.toLocaleString(dateLocale, {
        timeZone: userTimezone,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: userTimeFormat === "12h",
      });
    } catch {
      return "";
    }
  };

  const formatLastTime = () => {
    if (!lastScheduledAt) return "";
    try {
      const date = new Date(lastScheduledAt);
      return date.toLocaleString(dateLocale, {
        timeZone: userTimezone,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: userTimeFormat === "12h",
      });
    } catch {
      return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        stackClassName="z-[130]"
        className="max-w-2xl [&>button]:hidden"
        onInteractOutside={(e) => {
          // Prevent closing by clicking outside
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with Escape key
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="cluster text-2xl">
            <StatusTitle status={status} />
          </DialogTitle>
          <DialogDescription className="text-base">
            {status === "success" &&
            resolvedAttemptsGaveUp &&
            relayAcks.length === 0 ? (
              <span>
                Your {postType === "longform" ? "article" : "post"} was
                published. Relay status is unavailable for this post.
              </span>
            ) : (
              <StatusDescription
                action={action}
                status={status}
                postType={postType}
                formatScheduledTime={formatScheduledTime}
                bulkCount={bulkCount}
                lastScheduledAt={lastScheduledAt}
                queueSummary={queueSummary}
                formatLastTime={formatLastTime}
              />
            )}
            {hasTimedOut &&
            (status === "publishing" || status === "partial") ? (
              <span className="text-warning-text mt-2 block text-sm">
                Still waiting for some relays to respond...
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {action === "publish" && relayAcksForUi.length > 0 ? (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Relay Status</h3>
              {relayStatusCounts.acceptedCount > 0 &&
              relayAcksForUi.length > 0 ? (
                <span className="text-text-secondary text-xs">
                  Accepted by {relayStatusCounts.acceptedCount} of{" "}
                  {relayAcksForUi.length}{" "}
                  {relayAcksForUi.length === 1 ? "relay" : "relays"}
                </span>
              ) : null}
            </div>
            {relayAcksForUi.map((ack) => (
              <div
                key={ack.relayUrl}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="cluster-loose">
                  <RelayStatusIcon status={ack.status} />
                  <span className="font-mono text-sm">
                    {formatRelayUrl(ack.relayUrl)}
                  </span>
                </div>
                <div className="cluster">
                  <RelayStatusBadge status={ack.status} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {action === "publish" &&
        relayAcksForUi.length === 0 &&
        status === "publishing" ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <StatusIcon tone="pending" size="xl" className="text-info" />
            <span className="text-text-secondary text-center text-sm">
              {currentStagedSubstatus ??
                (resolvedPublishAttemptId
                  ? "Waiting for relay responses…"
                  : "Connecting to relays…")}
            </span>
            {hasTimedOut ? (
              <span className="text-text-secondary text-center text-sm">
                Relay responses are taking longer than usual. Your post was
                published - you can close this and check Published.
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Hide action buttons during the immediate progress phase  -  no postId
            means there's nothing to navigate to yet. Show them once the post
            is known or when a terminal state is reached. */}
        {!immediateProgress ||
        status === "success" ||
        status === "partial" ||
        status === "failed" ? (
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onCreateNew}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New {postType === "longform" ? "Article" : "Post"}
            </Button>
            <Button
              type="button"
              onClick={onViewPage}
              className="w-full sm:w-auto"
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              View {action === "schedule" ? "Scheduled" : "Published"}
            </Button>
            {onGoToDashboard ? (
              <Button
                type="button"
                variant="outline"
                onClick={onGoToDashboard}
                className="w-full sm:w-auto"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
