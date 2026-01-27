import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Plus,
  Calendar,
  CheckSquare,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { formatRelayUrl } from "../utils/publish-result.utils";

interface RelayAck {
  relayUrl: string;
  status: "ACCEPTED" | "FAILED" | "TIMEOUT";
  receivedAt: string | null;
  createdAt: string;
}

type StatusType = "scheduled" | "publishing" | "success" | "partial" | "failed";

// Helper component for status title
function StatusTitle({ status }: { status: StatusType }) {
  if (status === "scheduled") {
    return (
      <>
        <Calendar className="h-6 w-6 text-green-500" />
        Scheduled Successfully
      </>
    );
  }
  if (status === "publishing") {
    return (
      <>
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        Publishing...
      </>
    );
  }
  if (status === "success") {
    return (
      <>
        <CheckCircle2 className="h-6 w-6 text-green-500" />
        Published Successfully
      </>
    );
  }
  if (status === "partial") {
    return (
      <>
        <CheckCircle2 className="h-6 w-6 text-yellow-500" />
        Partially Published
      </>
    );
  }
  // status must be "failed" at this point
  return (
    <>
      <XCircle className="h-6 w-6 text-red-500" />
      Publishing Failed
    </>
  );
}

// Helper component for status description
function StatusDescription({
  action,
  status,
  postType,
  formatScheduledTime,
}: {
  action: "publish" | "schedule";
  status: StatusType;
  postType: "post" | "longform";
  formatScheduledTime: () => string;
}) {
  const contentType = postType === "longform" ? "article" : "post";

  if (action === "schedule") {
    return (
      <p>
        Your {contentType} has been scheduled and will be published at{" "}
        <strong>{formatScheduledTime()}</strong>.
      </p>
    );
  }

  if (status === "publishing") {
    return (
      <p>
        Your {contentType} is being published to relays. This may take a few
        moments...
      </p>
    );
  }

  if (status === "success") {
    return (
      <p>Your {contentType} has been successfully published to all relays.</p>
    );
  }

  if (status === "partial") {
    return (
      <p>
        Your {contentType} was published to some relays, but some failed or
        timed out.
      </p>
    );
  }

  // status must be "failed" at this point
  return (
    <p>Your {contentType} failed to publish to any relays. Please try again.</p>
  );
}

// Helper component for relay status badge
function RelayStatusBadge({ status }: { status: RelayAck["status"] }) {
  if (status === "ACCEPTED") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
        Accepted
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
        Failed
      </span>
    );
  }
  // status must be "TIMEOUT" at this point
  return (
    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
      Timeout
    </span>
  );
}

// Helper component for relay status icon
function RelayStatusIcon({ status }: { status: RelayAck["status"] }) {
  if (status === "ACCEPTED") {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  }
  if (status === "FAILED") {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
  // status must be "TIMEOUT" at this point
  return <Clock className="h-5 w-5 text-yellow-500" />;
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
}

export default function PublishResultModal({
  isOpen,
  postId,
  publishAttemptId,
  action,
  postType,
  scheduledFor,
  onCreateNew,
  onViewPage,
}: PublishResultModalProps) {
  const [relayAcks, setRelayAcks] = useState<RelayAck[]>([]);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const maxPollingAttempts = 10; // 10 attempts * 5 seconds = 50 seconds max
  const pollingInterval = 5000; // 5 seconds - increased to avoid rate limiting

  // Poll for relay acknowledgements (only for published posts)
  useEffect(() => {
    if (!isOpen || action !== "publish" || !publishAttemptId) {
      return;
    }

    // Reset state when modal opens - use setTimeout to avoid setState in effect warning
    setTimeout(() => {
      setRelayAcks([]);
      setHasTimedOut(false);
    }, 0);

    let currentPollCount = 0;
    let backoffDelay = pollingInterval; // Start with base interval
    let pollTimeout: NodeJS.Timeout | null = null;
    let isPolling = true;

    // Start polling with exponential backoff on errors
    const poll = async () => {
      if (!isPolling) {
        return;
      }

      if (currentPollCount >= maxPollingAttempts) {
        setTimeout(() => {
          setHasTimedOut(true);
        }, 0);
        return;
      }

      try {
        const response = await fetch(
          `/api/publish-result?postId=${postId}&publishAttemptId=${publishAttemptId}`
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
            setTimeout(() => {
              setRelayAcks(data.acks ?? []);
            }, 0);
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
          scheduleNextPoll();
        })();
      }, backoffDelay);
    };

    // Poll immediately, then schedule next
    void (async () => {
      await poll();
      scheduleNextPoll();
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
    publishAttemptId,
    postId,
    maxPollingAttempts,
    pollingInterval,
  ]);

  // Calculate relay status counts
  const relayStatusCounts = useMemo(() => {
    const acceptedCount = relayAcks.filter(
      (ack) => ack.status === "ACCEPTED"
    ).length;
    const failedCount = relayAcks.filter(
      (ack) => ack.status === "FAILED"
    ).length;
    const timeoutCount = relayAcks.filter(
      (ack) => ack.status === "TIMEOUT"
    ).length;
    return { acceptedCount, failedCount, timeoutCount };
  }, [relayAcks]);

  // Determine overall status
  const status = useMemo(() => {
    if (action === "schedule") {
      return "scheduled";
    }

    if (relayAcks.length === 0) {
      return "publishing";
    }

    const { acceptedCount, failedCount, timeoutCount } = relayStatusCounts;

    if (acceptedCount > 0 && failedCount === 0 && timeoutCount === 0) {
      return "success";
    }
    if (acceptedCount > 0) {
      return "partial";
    }
    if (failedCount > 0 || timeoutCount > 0) {
      return "failed";
    }

    return "publishing";
  }, [action, relayAcks.length, relayStatusCounts]);

  // Early return if modal is not open to prevent blocking
  // Must be after all hooks
  if (!isOpen) {
    return null;
  }

  // Format scheduled time
  const formatScheduledTime = () => {
    if (!scheduledFor) return "";
    try {
      const date =
        scheduledFor instanceof Date ? scheduledFor : new Date(scheduledFor);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
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
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <StatusTitle status={status} />
          </DialogTitle>
          <DialogDescription className="text-base">
            <StatusDescription
              action={action}
              status={status}
              postType={postType}
              formatScheduledTime={formatScheduledTime}
            />
            {hasTimedOut ? (
              <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                Still waiting for some relays to respond...
              </p>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {action === "publish" && relayAcks.length > 0 ? (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            <h3 className="text-sm font-semibold">Relay Status</h3>
            {relayAcks.map((ack) => (
              <div
                key={ack.relayUrl}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <RelayStatusIcon status={ack.status} />
                  <span className="font-mono text-sm">
                    {formatRelayUrl(ack.relayUrl)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <RelayStatusBadge status={ack.status} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {action === "publish" &&
        relayAcks.length === 0 &&
        status === "publishing" ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="text-muted-foreground ml-3 text-sm">
              Waiting for relay responses...
            </span>
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onCreateNew}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New {postType === "longform" ? "Article" : "Post"}
          </Button>
          <Button onClick={onViewPage} className="w-full sm:w-auto">
            <CheckSquare className="mr-2 h-4 w-4" />
            View {action === "schedule" ? "Scheduled" : "Posted"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
