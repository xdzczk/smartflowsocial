import {
  useFetcher,
  useLoaderData,
  type FetcherWithComponents,
} from "@remix-run/react";
import { CalendarDays, Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { toast } from "react-hot-toast";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type {
  QueueType,
  UserData,
  RepostConditions,
} from "~/features/posts/types";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "~/features/posts/utils/repost-quote-events.client";
import { handleErrorSafely } from "~/lib/error-handler.client";
import { isVideoFile } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { tryBackgroundReconnect } from "~/lib/nostr-signer-manager.client";
import {
  formatForDateTimeLocal,
  formatForDisplay,
  fromDate,
  getMinDatetimeLocalForSchedule,
  getMinScheduleTimestampMs,
  getNowForDateTimeLocal,
  isAfter,
  nowInTimezone,
  parseDateTimeLocal,
  toDate,
  toUnixTimestamp,
} from "~/lib/temporal";

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

function formatDateTime(
  date: Date,
  userTimezone: string,
  userTimeFormat: "12h" | "24h" = "12h",
  dateLocale: "en-GB" | "en-US" | "sv" = "en-GB"
): string {
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
    userTimeFormat,
    dateLocale
  );
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

function getRescheduleHeaderTitle(
  isEdit: boolean,
  wasAutoScheduled: boolean
): string {
  if (isEdit) return "Edit Post Schedule";
  if (wasAutoScheduled) return "Override Queue Logic?";
  return "Update Post Time?";
}

function getConfirmButtonLabel(
  isEdit: boolean,
  wasAutoScheduled: boolean,
  isSigningEvent: boolean,
  fetcherState: string
): string {
  if (isSigningEvent) return "Signing Event...";
  if (fetcherState === "submitting") return "Updating...";
  if (isEdit) return "Save Changes";
  if (wasAutoScheduled) return "Convert to Manual";
  return "Confirm";
}

interface SignedEventForRepost {
  id: string;
  pubkey: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
  sig?: string;
}

function canScheduleRepostQuoteForPost(
  isLongform: boolean,
  post: CalendarPost
): boolean {
  if (isLongform) return false;
  const ev = post.signedEvent;
  if (!ev || typeof ev !== "object") return false;
  return "id" in ev && "pubkey" in ev;
}

async function submitRepostSchedule(
  postId: string,
  originalSignedEvent: SignedEventForRepost,
  scheduledForUnix: number,
  submit: (formData: FormData) => void,
  repostConditions?: {
    minReactions?: number;
    minZaps?: number;
    minComments?: number;
    minReposts?: number;
    minSats?: number;
  } | null
): Promise<void> {
  const repostEvent = buildKind6RepostEvent(
    originalSignedEvent as SignedEventForRepost & {
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    },
    scheduledForUnix
  );
  const { signedEvent: repostSignedEvent } = await nostrAdapter.signEvent({
    content: repostEvent.content,
    created_at: repostEvent.created_at,
    kind: repostEvent.kind,
    tags: repostEvent.tags,
  });
  const formData = new FormData();
  formData.set("_action", "scheduleRepost");
  formData.set("postId", postId);
  formData.set("scheduledFor", scheduledForUnix.toString());
  formData.set("signedEvent", JSON.stringify(repostSignedEvent));
  if (repostConditions) {
    if (repostConditions.minReactions != null)
      formData.set("minReactions", String(repostConditions.minReactions));
    if (repostConditions.minZaps != null)
      formData.set("minZaps", String(repostConditions.minZaps));
    if (repostConditions.minComments != null)
      formData.set("minComments", String(repostConditions.minComments));
    if (repostConditions.minReposts != null)
      formData.set("minReposts", String(repostConditions.minReposts));
    if (repostConditions.minSats != null)
      formData.set("minSats", String(repostConditions.minSats));
  }
  submit(formData);
}

async function submitQuoteSchedule(
  postId: string,
  originalSignedEvent: SignedEventForRepost,
  scheduledForUnix: number,
  caption: string,
  submit: (formData: FormData) => void
): Promise<void> {
  const tagArray: string[][] = [];
  const quoteEvent = buildQuoteEvent(
    originalSignedEvent as SignedEventForRepost & {
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    },
    caption,
    scheduledForUnix,
    tagArray
  );
  const { signedEvent: quoteSignedEvent } = await nostrAdapter.signEvent({
    content: quoteEvent.content,
    created_at: quoteEvent.created_at,
    kind: quoteEvent.kind,
    tags: quoteEvent.tags,
  });
  const formData = new FormData();
  formData.set("_action", "scheduleQuote");
  formData.set("postId", postId);
  formData.set("scheduledFor", scheduledForUnix.toString());
  formData.set("signedEvent", JSON.stringify(quoteSignedEvent));
  if (caption) {
    formData.set("quoteCaption", caption);
  }
  submit(formData);
}

function renderModalContent(
  post: CalendarPost,
  firstMedia: string | null,
  isEdit: boolean,
  editableDateTime: Date | null,
  userTimezone: string,
  formatDateTimeForInput: (date: Date, tz: string) => string,
  formatDateTime: (
    date: Date,
    tz: string,
    timeFormat: "12h" | "24h",
    dateLocale: "en-GB" | "en-US" | "sv"
  ) => string,
  userTimeFormat: "12h" | "24h",
  dateLocale: "en-GB" | "en-US" | "sv",
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
          <CalendarDays
            className="text-muted-foreground h-4 w-4"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          <input
            id="reschedule-datetime"
            type="datetime-local"
            value={
              editableDateTime
                ? formatDateTimeForInput(editableDateTime, userTimezone)
                : ""
            }
            min={getNowForDateTimeLocal(userTimezone)}
            onChange={handleDateTimeChange}
            className="border-border bg-background text-foreground focus:border-primary focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2"
          />
        </div>
        {editableDateTime ? (
          <div className="text-muted-foreground text-xs">
            {formatDateTime(
              editableDateTime,
              userTimezone,
              userTimeFormat,
              dateLocale
            )}
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
          className="border-border bg-background text-foreground focus:border-primary focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2"
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
      <div className="border-border bg-muted rounded-lg border p-3">
        <div className="flex items-start space-x-2">
          <Info
            className="text-primary mt-0.5 h-5 w-5 flex-shrink-0"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
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
  const { dateLocale } = useFormattedDate();
  const [isSigningEvent, setIsSigningEvent] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [editableDateTime, setEditableDateTime] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedQueueType, setSelectedQueueType] = useState<string | null>(
    null
  );
  const [scheduleRepostQuoteMode, setScheduleRepostQuoteMode] = useState<
    null | "repost" | "quote"
  >(null);
  const [repostQuoteScheduledFor, setRepostQuoteScheduledFor] = useState("");
  const [repostQuoteCaption, setRepostQuoteCaption] = useState("");
  const [repostQuoteConditions, setRepostQuoteConditions] =
    useState<RepostConditions | null>(null);
  const scheduleRepostQuoteFetcher = useFetcher<{
    success?: boolean;
    postId?: string;
    error?: string;
  }>();
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Save focus on open, restore on close
  useEffect(() => {
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    return () => {
      previousActiveRef.current?.focus();
    };
  }, []);

  // Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // After successful remote signer reconnect, clear stuck signing state so user can retry.
  useEffect(() => {
    const handler = () => {
      setIsSigningEvent(false);
      setSigningError(null);
    };
    window.addEventListener("nostr-connection-healthy", handler);
    return () =>
      window.removeEventListener("nostr-connection-healthy", handler);
  }, []);

  // When awaiting signer approval, try background reconnect periodically.
  useEffect(() => {
    if (!isSigningEvent) return;
    let attempts = 0;
    const interval = setInterval(() => {
      void tryBackgroundReconnect();
      attempts++;
      if (attempts >= 5) clearInterval(interval);
    }, 10_000);
    return () => clearInterval(interval);
  }, [isSigningEvent]);

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !modalContentRef.current) return;
    const focusable =
      modalContentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const list = Array.from(focusable).filter(
      (el) => el.offsetParent !== null && !el.hasAttribute("aria-hidden")
    );
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (!first || !last) return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

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

  useEffect(() => {
    if (scheduleRepostQuoteFetcher.data?.success) {
      toast.success(
        scheduleRepostQuoteMode === "repost"
          ? "Repost scheduled successfully!"
          : "Quote post scheduled successfully!"
      );
      setScheduleRepostQuoteMode(null);
      onConfirm(true);
    }
    if (scheduleRepostQuoteFetcher.data?.error) {
      toast.error(String(scheduleRepostQuoteFetcher.data.error));
    }
  }, [scheduleRepostQuoteFetcher.data, scheduleRepostQuoteMode, onConfirm]);

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
  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

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

  const submitRepostQuote = (formData: FormData) => {
    scheduleRepostQuoteFetcher.submit(formData, {
      method: "post",
      action: "/dashboard/scheduled",
    });
  };

  const handleScheduleRepostQuoteConfirm = async () => {
    if (!repostQuoteScheduledFor.trim()) {
      toast.error("Please select a date and time.");
      return;
    }
    const originalSignedEvent = post.signedEvent as
      | { id: string; pubkey: string; content?: string; tags?: string[][] }
      | undefined;
    if (!originalSignedEvent?.id || !originalSignedEvent.pubkey) {
      toast.error("Original event not found. Cannot schedule repost/quote.");
      return;
    }
    try {
      setIsSigningEvent(true);
      setSigningError(null);
      const zoned = parseDateTimeLocal(repostQuoteScheduledFor, userTimezone);
      const utcZoned = zoned.withTimeZone("UTC");
      const scheduledForUnix = toUnixTimestamp(utcZoned);

      const minMs = getMinScheduleTimestampMs(
        userTimezone,
        post.scheduledAtUtc ?? undefined
      );
      if (utcZoned.epochMilliseconds < minMs) {
        toast.error(
          post.scheduledAtUtc
            ? "Repost/quote must be scheduled at or after the original post's scheduled time."
            : "Please select a date and time in the future."
        );
        return;
      }

      const ev = originalSignedEvent as SignedEventForRepost & {
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
        sig: string;
      };
      if (scheduleRepostQuoteMode === "repost") {
        await submitRepostSchedule(
          post.id,
          ev,
          scheduledForUnix,
          submitRepostQuote,
          repostQuoteConditions
        );
      } else if (scheduleRepostQuoteMode === "quote") {
        await submitQuoteSchedule(
          post.id,
          ev,
          scheduledForUnix,
          repostQuoteCaption,
          submitRepostQuote
        );
      }
    } catch (error) {
      handleErrorSafely(error, {
        component: "RescheduleModal",
        action: "handleScheduleRepostQuoteConfirm",
      });
      setSigningError(
        error instanceof Error
          ? error.message
          : "Failed to sign. Please try again."
      );
      toast.error("Failed to sign event.");
    } finally {
      setIsSigningEvent(false);
    }
  };

  const canScheduleRepostQuote = canScheduleRepostQuoteForPost(
    data.isLongform,
    post
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- focus trap requires onKeyDown on dialog container */}
      <div
        ref={modalContentRef}
        role="dialog"
        aria-modal="true"
        onKeyDown={handleModalKeyDown}
        className="w-full max-w-md rounded-[var(--calendar-radius-lg)] border border-[hsl(var(--calendar-surface-3-border))] bg-[hsl(var(--calendar-surface-3-bg))] shadow-[var(--calendar-surface-3-shadow)]"
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-foreground text-lg font-semibold">
              {getRescheduleHeaderTitle(isEdit, wasAutoScheduled)}
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X
                className="h-6 w-6"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </button>
          </div>

          {/* Content */}
          {scheduleRepostQuoteMode ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {scheduleRepostQuoteMode === "repost"
                  ? "Choose when to schedule the repost."
                  : "Choose when to schedule the quote and add an optional caption."}
              </p>
              <div>
                <label
                  htmlFor="repostQuoteScheduledFor"
                  className="text-foreground mb-1 block text-sm font-medium"
                >
                  Schedule at
                </label>
                <input
                  id="repostQuoteScheduledFor"
                  type="datetime-local"
                  value={repostQuoteScheduledFor}
                  onChange={(e) => {
                    const v = e.target.value;
                    const min = getMinDatetimeLocalForSchedule(
                      userTimezone,
                      data.post.scheduledAtUtc ?? undefined
                    );
                    setRepostQuoteScheduledFor(v && v < min ? min : v);
                  }}
                  min={getMinDatetimeLocalForSchedule(
                    userTimezone,
                    data.post.scheduledAtUtc ?? undefined
                  )}
                  className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2"
                />
              </div>
              {scheduleRepostQuoteMode === "repost" ? (
                <div className="border-border space-y-1.5 rounded border p-3">
                  <span className="text-muted-foreground text-xs">
                    Only repost if original gets (optional)
                  </span>
                  <div className="flex flex-wrap items-center gap-3 gap-y-1.5">
                    {[
                      { key: "minReactions" as const, label: "Reactions" },
                      { key: "minZaps" as const, label: "Zaps" },
                      { key: "minComments" as const, label: "Comments" },
                      { key: "minReposts" as const, label: "Reposts" },
                      { key: "minSats" as const, label: "Sats" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <label className="text-muted-foreground text-xs whitespace-nowrap">
                          {label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          placeholder="—"
                          value={repostQuoteConditions?.[key] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const v =
                              raw.trim() === ""
                                ? undefined
                                : Math.max(0, parseInt(raw, 10) || 0);
                            setRepostQuoteConditions((prev) => {
                              if (v === undefined) {
                                const next = prev ? { ...prev } : {};
                                delete next[key];
                                return Object.keys(next).length > 0
                                  ? next
                                  : null;
                              }
                              return { ...prev, [key]: v };
                            });
                          }}
                          className="border-border bg-background text-foreground w-20 rounded-md border px-2 py-1.5 text-sm"
                          aria-label={`Min ${label.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {scheduleRepostQuoteMode === "quote" ? (
                <div>
                  <label
                    htmlFor="repostQuoteCaption"
                    className="text-foreground mb-1 block text-sm font-medium"
                  >
                    Quote caption (optional)
                  </label>
                  <textarea
                    id="repostQuoteCaption"
                    value={repostQuoteCaption}
                    onChange={(e) => setRepostQuoteCaption(e.target.value)}
                    placeholder="Add your comment..."
                    rows={3}
                    className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2"
                  />
                </div>
              ) : null}
              {(scheduleRepostQuoteFetcher.data?.error ?? signingError) ? (
                <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-3">
                  <div className="text-destructive text-sm">
                    {scheduleRepostQuoteFetcher.data?.error ?? signingError}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            renderModalContent(
              post,
              firstMedia,
              isEdit,
              editableDateTime,
              userTimezone,
              formatDateTimeForInput,
              formatDateTime,
              userTimeFormat,
              dateLocale,
              handleDateTimeChange,
              selectedQueueType,
              setSelectedQueueType,
              queueTypes,
              validationError,
              fetcher.data?.error,
              signingError
            )
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            {scheduleRepostQuoteMode ? (
              <>
                <button
                  onClick={() => {
                    setScheduleRepostQuoteMode(null);
                    setRepostQuoteScheduledFor("");
                    setRepostQuoteCaption("");
                    setRepostQuoteConditions(null);
                  }}
                  className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => void handleScheduleRepostQuoteConfirm()}
                  disabled={
                    scheduleRepostQuoteFetcher.state !== "idle" ||
                    isSigningEvent ||
                    !repostQuoteScheduledFor.trim()
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {isSigningEvent ||
                  scheduleRepostQuoteFetcher.state === "submitting"
                    ? "Signing..."
                    : scheduleRepostQuoteMode === "repost"
                      ? "Schedule repost"
                      : "Schedule quote"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                {canScheduleRepostQuote ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setScheduleRepostQuoteMode("repost")}
                      className="border-primary/30 text-primary hover:bg-primary/5 rounded-lg border px-4 py-2 text-sm font-medium"
                    >
                      Schedule repost
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleRepostQuoteMode("quote")}
                      className="border-primary/30 text-primary hover:bg-primary/5 rounded-lg border px-4 py-2 text-sm font-medium"
                    >
                      Schedule quote
                    </button>
                  </>
                ) : null}
                {wasAutoScheduled ? (
                  <button
                    onClick={() => void handleConfirm(false)}
                    className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary/90 rounded-lg border px-4 py-2 text-sm font-medium"
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
                  {getConfirmButtonLabel(
                    isEdit,
                    wasAutoScheduled,
                    isSigningEvent,
                    fetcher.state
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
