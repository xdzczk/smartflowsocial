import {
  useFetcher,
  useLoaderData,
  type FetcherWithComponents,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import type React from "react";
import { toast } from "react-hot-toast";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { handleErrorSafely } from "~/lib/error-handler.client";
import { isVideoFile } from "~/lib/helpers";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  formatForDateTimeLocal,
  formatForDisplay,
  fromDate,
  isAfter,
  nowInTimezone,
  parseDateTimeLocal,
  toDate,
  toUnixTimestamp,
} from "~/lib/temporal";

import type { QueueType, UserData } from "../../types";

import type { CalendarPost } from "./PostBlock.types";
interface RescheduleData {
  post: CalendarPost;
  newDateTime: Date;
  wasAutoScheduled: boolean;
  queueName: string | null;
  isEdit: boolean;
  isLongform: boolean;
}

interface RescheduleModalProps {
  data: RescheduleData | null;
  onClose: () => void;
  onConfirm: (success?: boolean) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseFileUrl(firstFileUrl: unknown): string | null {
  if (typeof firstFileUrl !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(firstFileUrl) as string[] | string;
    return Array.isArray(parsed) ? (parsed[0] ?? null) : firstFileUrl;
  } catch {
    return firstFileUrl;
  }
}

function getFirstMediaFromFileUrl(post: CalendarPost): string | null {
  if (post.fileUrl.length === 0) {
    return null;
  }
  try {
    const firstFileUrl = post.fileUrl[0];
    return parseFileUrl(firstFileUrl);
  } catch (error) {
    handleErrorSafely(error, {
      component: "RescheduleModal",
      action: "getFirstMedia",
    });
    return null;
  }
}

function getFirstMedia(data: RescheduleData): string | null {
  const { post, isLongform } = data;
  if (isLongform && post.image) {
    return post.image;
  }
  return getFirstMediaFromFileUrl(post);
}

function formatDateTime(date: Date, userTimezone: string): string {
  const zonedDateTime = fromDate(date, userTimezone);
  return formatForDisplay(zonedDateTime, userTimezone, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function validateDateTime(
  dateTime: Date | null,
  userTimezone: string,
  setValidationError: (error: string | null) => void
): boolean {
  if (!dateTime) return false;

  try {
    const now = nowInTimezone(userTimezone);
    const dateTimeZoned = fromDate(dateTime, userTimezone);

    if (!isAfter(dateTimeZoned, now)) {
      setValidationError("Cannot schedule posts in the past");
      return false;
    }

    setValidationError(null);
    return true;
  } catch {
    setValidationError("Invalid date/time");
    return false;
  }
}

function formatDateTimeForInput(date: Date, userTimezone: string): string {
  // Use Temporal for consistent datetime-local formatting
  const zonedDateTime = fromDate(date, userTimezone);
  return formatForDateTimeLocal(zonedDateTime, userTimezone);
}

function renderModalContent(
  post: CalendarPost,
  firstMedia: string | null,
  isEdit: boolean,
  editableDateTime: Date | null,
  userTimezone: string,
  formatDateTimeForInput: (date: Date, tz: string) => string,
  formatDateTime: (date: Date, tz: string) => string,
  handleDateTimeChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  selectedQueueType: string | null,
  setSelectedQueueType: (value: string | null) => void,
  queueTypes: QueueType[] | undefined,
  validationError: string | null,
  fetcherError: string | undefined,
  signingError: string | null
): React.ReactNode {
  return (
    <div className="space-y-4">
      {/* Post preview */}
      <div className="bg-secondary/30 rounded-lg p-3">
        <div className="text-foreground mb-2 text-sm font-medium">
          Post Preview:
        </div>

        {/* Show media thumbnail if available */}
        {firstMedia ? (
          <div className="mb-2">
            <div className="post-thumbnail h-20 w-full overflow-hidden rounded-md">
              <MediaThumbnail
                src={firstMedia}
                alt="Post preview"
                className="h-full w-full rounded-md"
                forceType={isVideoFile(firstMedia) ? "video" : "image"}
                hidePlayButton={false}
                fallback={
                  <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs font-medium">
                    {post.postType === "VIDEO" || isVideoFile(firstMedia)
                      ? "VIDEO"
                      : "MEDIA"}
                  </div>
                }
              />
            </div>
          </div>
        ) : null}

        <div className="text-muted-foreground text-sm">
          {post.caption ? (
            <span
              style={{
                display: "inline-block",
                maxWidth: "100%",
                wordBreak: "break-word",
                whiteSpace: "pre-line",
                overflowWrap: "anywhere",
              }}
            >
              {post.caption}
            </span>
          ) : (
            "No caption"
          )}
          {post.fileUrl.length > 0 ? (
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
          htmlFor="reschedule-datetime"
          className="text-foreground block text-sm font-medium"
        >
          {isEdit ? "Edit scheduled time:" : "New time:"}
        </label>
        <div className="flex items-center space-x-2">
          <svg
            className="text-muted-foreground h-4 w-4"
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
            id="reschedule-datetime"
            type="datetime-local"
            value={
              editableDateTime
                ? formatDateTimeForInput(editableDateTime, userTimezone)
                : ""
            }
            onChange={handleDateTimeChange}
            className="border-border bg-background text-foreground focus:border-primary focus:ring-primary flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2"
          />
        </div>
        {editableDateTime ? (
          <div className="text-muted-foreground text-xs">
            {formatDateTime(editableDateTime, userTimezone)}
          </div>
        ) : null}
      </div>

      {/* Queue Type Selection */}
      <div className="space-y-2">
        <label
          htmlFor="reschedule-queue-type"
          className="text-foreground block text-sm font-medium"
        >
          Queue Type:
        </label>
        <select
          id="reschedule-queue-type"
          value={selectedQueueType ?? ""}
          onChange={(e) => setSelectedQueueType(e.target.value || null)}
          className="border-border bg-background text-foreground focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2"
        >
          <option value="">Manual (No Queue)</option>
          {queueTypes?.map((queueType) => (
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

      {/* Re-signing warning */}
      <div className="border-primary/30 bg-primary/10 rounded-lg border p-3">
        <div className="flex items-start space-x-2">
          <svg
            className="text-primary mt-0.5 h-5 w-5 flex-shrink-0"
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
            <div className="text-primary text-sm font-medium">
              {isEdit ? "Editing this post" : "Rescheduling this post"} requires
              re-signing the Nostr event
            </div>
            <div className="text-primary/80 mt-1 text-xs">
              Your Nostr client will prompt you to sign the updated event with
              the new timestamp.
            </div>
          </div>
        </div>
      </div>

      {/* Validation error */}
      {validationError ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-3">
          <div className="text-destructive text-sm">{validationError}</div>
        </div>
      ) : null}

      {/* Error display */}
      {(fetcherError ?? signingError) ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-3">
          <div className="text-destructive text-sm">
            {fetcherError ?? signingError}
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function handleSignAndSubmitLogic(
  editableDateTime: Date,
  post: CalendarPost,
  selectedQueueType: string | null,
  shouldOverride: boolean,
  fetcher: FetcherWithComponents<{
    success?: boolean;
    needsSigning?: boolean;
    error?: string;
  }>,
  setIsSigningEvent: (isSigning: boolean) => void,
  setSigningError: (error: string | null) => void
): Promise<void> {
  // Use Temporal for Unix timestamp conversion
  const editableZoned = fromDate(editableDateTime, "UTC");
  const newTimeUnix = toUnixTimestamp(editableZoned);

  try {
    setIsSigningEvent(true);

    // Use the exact same content and tags from the original signed event
    const originalSignedEvent = post.signedEvent as
      | { content: string; kind?: number; tags?: string[][] }
      | undefined;
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
      kind: originalSignedEvent.kind ?? 1,
      tags: originalSignedEvent.tags ?? [], // Use exact same tags
    });

    // Submit the reschedule action with signed event
    const formData = new FormData();
    formData.append("action", "reschedule");
    formData.append("postId", post.id);
    formData.append("newTime", newTimeUnix.toString());
    formData.append("overrideQueue", shouldOverride.toString());
    formData.append("signedEvent", JSON.stringify(signedEvent));
    formData.append("nostrEvent", JSON.stringify(nostrEvent));
    if (selectedQueueType) {
      formData.append("queueTypeId", selectedQueueType);
    }

    fetcher.submit(formData, { method: "post" });
  } catch (error) {
    handleErrorSafely(error, {
      component: "RescheduleModal",
      action: "reSignEvent",
      message: "Error re-signing event",
    });
    setIsSigningEvent(false);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to sign event. Please try again.";
    setSigningError(errorMessage);
    toast.error(errorMessage);
  }
}

export function RescheduleModal({
  data,
  onClose,
  onConfirm,
  user: userProp,
  queueTypes,
}: RescheduleModalProps) {
  interface FetcherData {
    success?: boolean;
    needsSigning?: boolean;
    error?: string;
  }

  const fetcher = useFetcher<FetcherData>();
  const loaderData = useLoaderData<{ user?: UserData }>();
  const user = userProp ?? loaderData.user;
  const [isSigningEvent, setIsSigningEvent] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [editableDateTime, setEditableDateTime] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedQueueType, setSelectedQueueType] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.needsSigning) {
        // Event was rescheduled but needs re-signing, keep modal open
        return;
      }
      toast.success("Post rescheduled and re-signed successfully!");
      onConfirm(true);
    }
    if (fetcher.data?.error) {
      toast.error(`Reschedule failed: ${fetcher.data.error}`);
    }
  }, [fetcher.data, onConfirm]);

  // Initialize editable datetime and queue type when data changes
  useEffect(() => {
    if (!data) return;
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      setEditableDateTime(data.newDateTime);
      setValidationError(null);
      setSelectedQueueType(data.post.queueType?.id ?? null);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [data]);

  if (!data) return null;

  const { post, wasAutoScheduled, isEdit } = data;
  const firstMedia = getFirstMedia(data);
  const userTimezone = user?.timezone ?? "Etc/UTC";

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      // Parse datetime-local string using Temporal
      const zonedDateTime = parseDateTimeLocal(e.target.value, userTimezone);
      // Convert to UTC ZonedDateTime, then to Date using Temporal helper
      const utcZoned = zonedDateTime.withTimeZone("UTC");
      const dateValue = toDate(utcZoned);
      setEditableDateTime(dateValue);
      validateDateTime(dateValue, userTimezone, setValidationError);
    } catch {
      // If parsing fails, try fallback - still use Temporal for consistency
      try {
        const dateObj = new Date(e.target.value);
        const zoned = fromDate(dateObj, userTimezone);
        const utcZoned = zoned.withTimeZone("UTC");
        const newValue = toDate(utcZoned);
        setEditableDateTime(newValue);
        validateDateTime(newValue, userTimezone, setValidationError);
      } catch {
        // Ultimate fallback - only if Temporal completely fails
        setValidationError("Invalid date/time format");
      }
    }
  };

  const handleConfirm = async (shouldOverride = false) => {
    // Validate the selected time
    if (!editableDateTime) return;
    if (!validateDateTime(editableDateTime, userTimezone, setValidationError)) {
      return;
    }

    await handleSignAndSubmitLogic(
      editableDateTime,
      post,
      selectedQueueType,
      shouldOverride,
      fetcher,
      setIsSigningEvent,
      setSigningError
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="border-border bg-card w-full max-w-md rounded-lg border shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-foreground text-lg font-semibold">
              {isEdit
                ? "Edit Post Schedule"
                : wasAutoScheduled
                  ? "Override Queue Logic?"
                  : "Update Post Time?"}
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
          {renderModalContent(
            post,
            firstMedia,
            isEdit,
            editableDateTime,
            userTimezone,
            formatDateTimeForInput,
            formatDateTime,
            handleDateTimeChange,
            selectedQueueType,
            setSelectedQueueType,
            queueTypes,
            validationError,
            fetcher.data?.error,
            signingError
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>

            {wasAutoScheduled ? (
              <button
                onClick={() => void handleConfirm(false)}
                className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary/80 rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Keep Queue Rule
              </button>
            ) : null}

            <button
              onClick={() => void handleConfirm(wasAutoScheduled)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                fetcher.state === "submitting" ||
                isSigningEvent ||
                !!validationError
              }
            >
              {isSigningEvent
                ? "Signing Event..."
                : fetcher.state === "submitting"
                  ? "Updating..."
                  : isEdit
                    ? "Save Changes"
                    : wasAutoScheduled
                      ? "Convert to Manual"
                      : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
