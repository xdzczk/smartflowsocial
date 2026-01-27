import { useFetcher } from "@remix-run/react";
import React, { useEffect } from "react";
import type { z } from "zod";

import { handleErrorSafely } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  formatForDateTimeLocal,
  formatForDisplay,
  fromDate,
  nowUTC,
  parseDateTimeLocal,
  toDate,
  toUnixTimestamp,
} from "~/lib/temporal";
import {
  rescheduleModalClientSchema,
  rescheduleLongformModalClientSchema,
} from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client";

import type { PostData, LongFormPostData, UserData, QueueType } from "../types";

// ============================================================================
// Helper Functions
// ============================================================================

function getInitialScheduledFor(
  post: PostData | LongFormPostData,
  isLongform: boolean
): Date {
  try {
    const scheduledAtUtc = post.scheduledAtUtc;
    if (scheduledAtUtc instanceof Date && !isNaN(scheduledAtUtc.getTime())) {
      const zoned = fromDate(scheduledAtUtc, "UTC");
      return toDate(zoned);
    }

    // Longform fallback: if already published, use publishedAt for display/edit convenience
    if (isLongform && "publishedAt" in post && post.publishedAt) {
      const zoned = fromDate(new Date(post.publishedAt), "UTC");
      return toDate(zoned);
    }

    const now = nowUTC();
    return toDate(now);
  } catch {
    // Final fallback - still use Temporal for consistency
    try {
      const now = nowUTC();
      return toDate(now);
    } catch {
      // Final fallback - still use Temporal
      return toDate(nowUTC());
    }
  }
}

interface SimpleRescheduleModalProps {
  post: PostData | LongFormPostData;
  onClose: () => void;
  onConfirm: () => void;
  user?: UserData;
  queueTypes?: QueueType[];
  userTimeFormat?: "12h" | "24h";
}

export function SimpleRescheduleModal({
  post,
  onClose,
  onConfirm,
  user,
  queueTypes = [],
  userTimeFormat = "12h",
}: SimpleRescheduleModalProps) {
  interface FetcherData {
    success?: boolean;
    error?: string;
    needsSigning?: boolean;
  }
  const fetcher = useFetcher<FetcherData>();
  const [isSigningEvent, setIsSigningEvent] = React.useState(false);
  const [signingError, setSigningError] = React.useState<string | null>(null);

  // Determine if this is a longform post
  const isLongform = "title" in post;

  // Initialize form with appropriate schema
  const schema = isLongform
    ? rescheduleLongformModalClientSchema
    : rescheduleModalClientSchema;

  const initialScheduledFor = getInitialScheduledFor(post, isLongform);

  const form = useZodForm(schema, {
    defaultValues: {
      scheduledFor: initialScheduledFor,
      ...(!isLongform && "queueType" in post
        ? { queueTypeId: post.queueType?.id ?? "" }
        : {}),
    },
  });

  const scheduledFor = form.watch("scheduledFor");
  // queueTypeId is conditionally in the schema, so we need to access it safely
  // Type assertion needed because queueTypeId only exists in non-longform schema
  interface FormValues {
    scheduledFor: Date;
    queueTypeId?: string;
  }
  const formValues = form.getValues() as FormValues;
  const selectedQueueType = !isLongform ? formValues.queueTypeId : undefined;

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.needsSigning) {
        return; // Keep modal open for re-signing
      }
      onConfirm();
    }
    if (fetcher.data?.error) {
      setSigningError(fetcher.data.error);
    }
  }, [fetcher.data, onConfirm]);

  const formatDateTimeForInput = (date: Date) => {
    const userTimezone = user?.timezone ?? "UTC";
    const zonedDateTime = fromDate(date, userTimezone);
    return formatForDateTimeLocal(zonedDateTime, userTimezone);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      setIsSigningEvent(true);
      setSigningError(null);

      // Use Temporal for Unix timestamp conversion
      const scheduledZoned = fromDate(data.scheduledFor, "UTC");
      const newTimeUnix = toUnixTimestamp(scheduledZoned);

      // Use the exact same content and tags from the original signed event
      const originalSignedEvent = post.signedEvent;
      const originalNostrEvent = post.nostrEvent;

      if (!originalSignedEvent || !originalNostrEvent) {
        throw new Error(
          "Original event not found. Cannot reschedule unsigned posts."
        );
      }

      // Re-sign with the same content but new timestamp
      const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
        content: originalSignedEvent.content, // Use exact same content
        created_at: newTimeUnix, // Only change the timestamp
        kind: originalSignedEvent.kind,
        tags: originalSignedEvent.tags, // Use exact same tags
      });

      // Submit the reschedule action with signed event
      const formData = new FormData();
      formData.append(
        "_action",
        isLongform ? "rescheduleLongform" : "reschedule"
      );
      formData.append("postId", post.id);
      formData.append("newTime", newTimeUnix.toString());
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("nostrEvent", JSON.stringify(nostrEvent));

      if (!isLongform) {
        const regularData = data as z.infer<typeof rescheduleModalClientSchema>;
        formData.append("overrideQueue", "false");
        if (regularData.queueTypeId) {
          formData.append("queueTypeId", regularData.queueTypeId);
        }
      }

      fetcher.submit(formData, { method: "post" });
    } catch (error: unknown) {
      const { handleAsyncErrorWithMessage, getErrorMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "Failed to sign event. Please try again.",
        {
          component: "SimpleRescheduleModal",
          action: "handleReschedule",
        },
        false // Don't show toast, we set signingError instead
      );
      setIsSigningEvent(false);
      setSigningError(
        getErrorMessage(error) || "Failed to sign event. Please try again."
      );
    }
  });

  const getFirstImage = () => {
    if ("fileUrl" in post && post.fileUrl.length > 0) {
      try {
        const firstFileUrl = post.fileUrl[0];
        if (typeof firstFileUrl === "string") {
          try {
            const parsed = JSON.parse(firstFileUrl) as string[] | string;
            return Array.isArray(parsed) ? parsed[0] : firstFileUrl;
          } catch {
            return firstFileUrl;
          }
        }
        return firstFileUrl;
      } catch (error) {
        handleErrorSafely(error, {
          component: "SimpleRescheduleModal",
          action: "getFirstImage",
        });
        return null;
      }
    }
    return null;
  };

  const firstImage = getFirstImage();

  const formatDateTime = (date: Date) => {
    const userTimezone = user?.timezone ?? "UTC";
    const zonedDateTime = fromDate(date, userTimezone);
    return formatForDisplay(
      zonedDateTime,
      userTimezone,
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
      userTimeFormat
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card w-full max-w-md rounded-lg shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-foreground text-lg font-semibold">
              Reschedule {isLongform ? "Article" : "Post"}
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {/* Post preview */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-foreground mb-2 text-sm font-medium">
                {isLongform ? "Article" : "Post"} Preview:
              </div>

              {/* Show image thumbnail if available */}
              {firstImage ? (
                <div className="mb-2">
                  <div className="h-20 w-full overflow-hidden rounded-md">
                    <img
                      src={firstImage}
                      alt="Post preview"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              ) : null}

              <div className="text-foreground text-sm">
                {isLongform && "title" in post
                  ? (post.title ?? "Untitled Article")
                  : "caption" in post
                    ? (post.caption ?? "No caption")
                    : "No caption"}
                {"fileUrl" in post && post.fileUrl.length > 0 ? (
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({post.fileUrl.length} file
                    {post.fileUrl.length > 1 ? "s" : ""})
                  </span>
                ) : null}
              </div>
            </div>

            {/* New time */}
            <div className="space-y-2">
              <label
                htmlFor="simple-reschedule-datetime"
                className="text-muted-foreground block text-sm font-medium"
              >
                New scheduled time:
              </label>
              <div className="flex items-center space-x-2">
                <svg
                  className="text-foreground h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <input
                  id="simple-reschedule-datetime"
                  name="simple-reschedule-datetime"
                  type="datetime-local"
                  value={formatDateTimeForInput(scheduledFor)}
                  onChange={(e) => {
                    if (e.target.value) {
                      try {
                        // Parse datetime-local string using Temporal
                        const userTimezone = user?.timezone ?? "UTC";
                        const zonedDateTime = parseDateTimeLocal(
                          e.target.value,
                          userTimezone
                        );
                        const utcZoned = zonedDateTime.withTimeZone("UTC");
                        const newValue = toDate(utcZoned);
                        form.setValue("scheduledFor", newValue, {
                          shouldValidate: true,
                        });
                      } catch {
                        // Fallback to Date parsing - still convert through Temporal for consistency
                        try {
                          const dateObj = new Date(e.target.value);
                          const userTimezone = user?.timezone ?? "UTC";
                          const zoned = fromDate(dateObj, userTimezone);
                          const utcZoned = zoned.withTimeZone("UTC");
                          const newValue = toDate(utcZoned);
                          form.setValue("scheduledFor", newValue, {
                            shouldValidate: true,
                          });
                        } catch {
                          // Ultimate fallback - only if Temporal completely fails
                          const newValue = new Date(e.target.value);
                          form.setValue("scheduledFor", newValue, {
                            shouldValidate: true,
                          });
                        }
                      }
                    }
                  }}
                  className="bg-card border-border text-foreground focus:border-primary focus:ring-primary flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2"
                />
              </div>
              <div className="text-muted-foreground text-xs">
                {formatDateTime(scheduledFor)}
              </div>
            </div>

            {/* Queue Type Selection for regular posts */}
            {!isLongform ? (
              <div className="space-y-2">
                <label
                  htmlFor="simple-reschedule-queue-type"
                  className="text-muted-foreground block text-sm font-medium"
                >
                  Queue Type:
                </label>
                <select
                  id="simple-reschedule-queue-type"
                  {...form.register("queueTypeId" as never)}
                  value={selectedQueueType ?? ""}
                  onChange={(e) => {
                    // Type assertion needed because queueTypeId only exists in non-longform schema
                    (form.setValue as (name: string, value: string) => void)(
                      "queueTypeId",
                      e.target.value
                    );
                  }}
                  className="bg-card border-border text-foreground focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2"
                >
                  <option value="">Manual (No Queue)</option>
                  {queueTypes.map((queueType) => (
                    <option key={queueType.id} value={queueType.id}>
                      {queueType.name}
                    </option>
                  ))}
                </select>
                <div className="text-muted-foreground text-xs">
                  {selectedQueueType
                    ? "Post will be managed by the selected queue type"
                    : "Post will be manually scheduled"}
                </div>
              </div>
            ) : null}

            {/* Re-signing warning */}
            <div className="border-border bg-muted dark:border-border dark:bg-muted/20 rounded-lg border p-3">
              <div className="flex items-start space-x-2">
                <svg
                  className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <div className="text-foreground text-sm font-medium">
                    Rescheduling this {isLongform ? "article" : "post"} requires
                    re-signing the Nostr event
                  </div>
                </div>
              </div>
            </div>
            {isSigningEvent ? (
              <div className="bg-muted text-muted-foreground rounded-lg border p-3 text-sm">
                Waiting for signer approval… If you’re using a remote signer,
                open it to approve the request.
              </div>
            ) : null}

            {/* Validation error */}
            {form.formState.errors.scheduledFor ? (
              <div className="border-destructive bg-destructive/10 dark:border-destructive dark:bg-destructive/20/20 rounded-lg border p-3">
                <div className="text-destructive dark:text-destructive text-sm">
                  {form.formState.errors.scheduledFor.message}
                </div>
              </div>
            ) : null}

            {/* Error display */}
            {(fetcher.data?.error ?? signingError) ? (
              <div className="border-destructive bg-destructive/10 dark:border-destructive dark:bg-destructive/20/20 rounded-lg border p-3">
                <div className="text-destructive dark:text-destructive text-sm">
                  {fetcher.data?.error ?? signingError}
                </div>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={fetcher.state === "submitting" || isSigningEvent}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningEvent
                ? "Signing Event..."
                : fetcher.state === "submitting"
                  ? "Rescheduling..."
                  : "Confirm Reschedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
