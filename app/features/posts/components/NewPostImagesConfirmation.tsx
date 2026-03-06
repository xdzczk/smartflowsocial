import { useFetcher } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  formatAttemptElapsed,
  useSignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { tryBackgroundReconnect } from "~/lib/nostr-signer-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
import {
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  nowMillis,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";
interface PreparedEventData {
  /** Object: fileUrl/caption/etc. Or plain string URL. */
  content:
    | {
        fileUrl: string;
        scheduledFor?: string;
        caption?: string;
        queueType?: string;
      }
    | string;
  type: "media" | "image";
  queueType: string;
}

interface NewPostImagesConfirmationProps {
  preparedEvents: PreparedEventData[];
  onCancel: () => void;
  postsCount: number;
  tags: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getQueueTypeFromEvent(events: PreparedEventData[]): string {
  const firstEvent = events[0];
  if (
    firstEvent &&
    typeof firstEvent === "object" &&
    "queueType" in firstEvent &&
    typeof firstEvent.queueType === "string"
  ) {
    return firstEvent.queueType;
  }
  return "unassigned";
}

async function fetchEffectiveHashtags(
  userId: string | undefined,
  queueType: string,
  fallbackTags: string | string[]
): Promise<string> {
  try {
    const response = await fetch("/api/effective-hashtags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        queueTypeName: queueType,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { hashtags?: string };
      return data.hashtags ?? "";
    }
    return Array.isArray(fallbackTags) ? fallbackTags.join(" ") : fallbackTags;
  } catch (error) {
    const { handleErrorSafely } = await import("~/lib/error-handler.client");
    handleErrorSafely(error, {
      component: "NewPostImagesConfirmation",
      action: "fetchEffectiveHashtags",
    });
    return Array.isArray(fallbackTags) ? fallbackTags.join(" ") : fallbackTags;
  }
}

function getScheduledForString(events: PreparedEventData[]): string {
  const firstEvent = events[0];
  if (
    !firstEvent ||
    typeof firstEvent !== "object" ||
    !("content" in firstEvent)
  ) {
    return "";
  }
  const content = firstEvent.content;
  if (
    typeof content === "object" &&
    !Array.isArray(content) &&
    "scheduledFor" in content
  ) {
    const scheduledFor = content.scheduledFor;
    if (typeof scheduledFor === "string") {
      return scheduledFor;
    }
  }
  return "";
}

function calculateScheduledTime(
  isImmediate: boolean,
  scheduledForStr: string,
  userTimezone: string
): number {
  if (isImmediate) {
    // Use Temporal for consistency
    return nowMillis();
  }

  // Use Temporal for timezone conversion
  try {
    // Parse datetime-local string in user's timezone
    const zonedDateTime = parseDateTimeLocal(scheduledForStr, userTimezone);

    // Convert to UTC and get Unix timestamp in milliseconds
    const utcZoned = zonedDateTime.withTimeZone("UTC");
    return toUnixTimestamp(utcZoned) * 1000; // Convert seconds to milliseconds
  } catch {
    // Fallback: treat as UTC if parsing fails - use Temporal for 100% consistency
    try {
      const zoned = fromISOString(scheduledForStr + "Z", "UTC");
      return toUnixTimestamp(zoned) * 1000;
    } catch {
      // Fallback - try with Date conversion
      try {
        const dateObj = new Date(scheduledForStr + "Z");
        const zoned = fromDate(dateObj, "UTC");
        return toUnixTimestamp(zoned) * 1000;
      } catch {
        // Ultimate fallback
        const dateObj = new Date(scheduledForStr + "Z");
        return dateObj.getTime();
      }
    }
  }
}

function extractFileUrls(events: PreparedEventData[]): string[] {
  return events
    .map((event) => {
      const content = event.content;
      if (typeof content === "string" && content.length > 0) {
        return content;
      }
      if (
        typeof content === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime: typeof null === "object"
        content !== null &&
        "fileUrl" in content &&
        typeof (content as { fileUrl: unknown }).fileUrl === "string"
      ) {
        return (content as { fileUrl: string }).fileUrl;
      }
      return "";
    })
    .filter((url) => url !== "");
}

function getFirstCaption(events: PreparedEventData[]): string {
  const firstEventContent = events[0]?.content;
  if (
    typeof firstEventContent === "object" &&
    "caption" in firstEventContent &&
    typeof (firstEventContent as { caption: unknown }).caption === "string"
  ) {
    return (firstEventContent as { caption: string }).caption;
  }
  return "";
}

function buildTagArray(effectiveHashtags: string): string[][] {
  return effectiveHashtags
    .split(" ")
    .filter((tag: string) => tag.length > 0)
    .map((tag: string) => ["t", tag.replace("#", "")]);
}

export default function NewPostImagesConfirmation({
  preparedEvents,
  onCancel,
  postsCount,
  tags,
}: NewPostImagesConfirmationProps) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const { signAttempt, signElapsedSeconds } = useSignAttemptProgress(isSigning);
  const user = useOptionalUser();
  const { dateLocale } = useFormattedDate();

  // After successful remote signer reconnect, clear stuck signing state so user can retry.
  useEffect(() => {
    const handler = () => {
      setIsSigning(false);
      setSigningError(null);
    };
    window.addEventListener("nostr-connection-healthy", handler);
    return () =>
      window.removeEventListener("nostr-connection-healthy", handler);
  }, []);

  // When awaiting signer approval, try background reconnect periodically.
  useEffect(() => {
    if (!isSigning) return;
    let attempts = 0;
    const interval = setInterval(() => {
      void tryBackgroundReconnect();
      attempts++;
      if (attempts >= 5) clearInterval(interval);
    }, 10_000);
    return () => clearInterval(interval);
  }, [isSigning]);

  // Calculate addTags for display
  const addTags = user?.showHashTagsinPosts ? `\n${tags}` : "";

  // Flatten the array structure if needed
  const events: PreparedEventData[] = Array.isArray(preparedEvents[0])
    ? (preparedEvents[0] as PreparedEventData[])
    : preparedEvents;

  const handleSignAndSubmit = async (isImmediate: boolean) => {
    try {
      setSigningError(null);
      const queueType = getQueueTypeFromEvent(events);
      const effectiveHashtags = await fetchEffectiveHashtags(
        user?.id,
        queueType,
        tags
      );

      const addTags = user?.showHashTagsinPosts ? `\n${effectiveHashtags}` : "";

      const userTimezone = user?.timezone ?? "UTC";
      const scheduledForStr = getScheduledForString(events);
      const scheduledTime = calculateScheduledTime(
        isImmediate,
        scheduledForStr,
        userTimezone
      );

      const scheduledForUnix = Math.floor(scheduledTime / 1000);
      const tagArray = buildTagArray(effectiveHashtags);
      const firstCaption = getFirstCaption(events);
      const fileUrls = extractFileUrls(events);

      const eventData = {
        content:
          (firstCaption + addTags || "") +
          (fileUrls.length > 0 ? " " + fileUrls.join(" ") : ""),
        created_at: scheduledForUnix,
        kind: 1,
        tags: tagArray,
      };

      setIsSigning(true);
      const { signedEvent, nostrEvent } =
        await nostrAdapter.signEvent(eventData);

      const formData = new FormData();
      formData.append("_action", isImmediate ? "post-media" : "schedule-media");
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("nostrEvent", JSON.stringify(nostrEvent));
      const fileUrlsForForm = extractFileUrls(events);
      const firstEventContent = events[0]?.content;
      const captionForForm =
        typeof firstEventContent === "object" &&
        "caption" in firstEventContent &&
        typeof (firstEventContent as { caption: unknown }).caption === "string"
          ? (firstEventContent as { caption: string }).caption
          : "";
      const queueTypeForForm =
        typeof firstEventContent === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime: typeof null === "object"
        firstEventContent !== null &&
        "queueType" in firstEventContent &&
        typeof (firstEventContent as { queueType: unknown }).queueType ===
          "string"
          ? (firstEventContent as { queueType: string }).queueType
          : typeof events[0]?.queueType === "string"
            ? events[0].queueType
            : "unassigned";

      formData.append("fileUrl", JSON.stringify(fileUrlsForForm));
      formData.append("caption", captionForForm);
      formData.append("scheduledFor", scheduledForUnix.toString());
      formData.append("queueType", queueTypeForForm);

      fetcher.submit(formData, {
        method: "post",
        action: "/dashboard/newpost",
      });
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "NewPostImagesConfirmation",
          action: "handleSignAndSubmit",
        },
        false
      ); // Don't show toast, let component handle it
      setSigningError(
        error instanceof Error
          ? error.message
          : "Failed to sign post. Please try again."
      );
    } finally {
      setIsSigning(false);
    }
  };

  const handleSaveAsDraft = () => {
    const formData = new FormData();
    formData.append("_action", "draft-media");
    const draftFileUrls = extractFileUrls(events);
    const draftFirstEvent = events[0];
    const draftCaption =
      draftFirstEvent &&
      typeof draftFirstEvent === "object" &&
      "content" in draftFirstEvent &&
      typeof draftFirstEvent.content === "object" &&
      "caption" in draftFirstEvent.content &&
      typeof draftFirstEvent.content.caption === "string"
        ? draftFirstEvent.content.caption
        : "";
    const draftQueueType =
      draftFirstEvent &&
      typeof draftFirstEvent === "object" &&
      "content" in draftFirstEvent &&
      typeof draftFirstEvent.content === "object" &&
      "queueType" in draftFirstEvent.content &&
      typeof draftFirstEvent.content.queueType === "string"
        ? draftFirstEvent.content.queueType
        : "unassigned";
    formData.append("fileUrl", JSON.stringify(draftFileUrls));
    formData.append("caption", draftCaption);
    formData.append("queueType", draftQueueType);

    fetcher.submit(formData, {
      method: "post",
      action: "/dashboard/newpost",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-foreground text-3xl font-bold dark:text-white">
            Confirm Your Post
          </h1>
          <p className="text-foreground dark:text-foreground mt-2">
            Review your post before publishing or scheduling
          </p>
        </div>

        {isSigning ? (
          <div className="dark:bg-card/30 dark:text-foreground text-muted-foreground mx-auto mb-4 flex max-w-2xl items-center justify-between gap-2 rounded-md border bg-white/50 p-3 text-sm">
            <span>
              Waiting for signer approval…
              {signAttempt ? (
                <>
                  {" "}
                  Attempt {signAttempt.attempt} of {signAttempt.maxAttempts} ·{" "}
                  {formatAttemptElapsed(
                    signElapsedSeconds,
                    signAttempt.timeoutMs
                  )}
                </>
              ) : null}
              {" — "}
              If you’re using a remote signer, open it to approve the request.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => {
                setIsSigning(false);
                setSigningError(null);
                void tryBackgroundReconnect();
              }}
            >
              Cancel
            </Button>
          </div>
        ) : null}
        {signingError ? (
          <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive mx-auto mb-4 max-w-2xl rounded-md border p-3 text-sm">
            {signingError}
          </div>
        ) : null}

        {/* Post Card */}
        <div className="mx-auto max-w-2xl">
          <div className="group dark:bg-card overflow-hidden rounded-xl bg-white shadow-lg transition-all duration-300 hover:shadow-xl">
            {/* Post Header */}
            <div className="border-border dark:border-border flex items-center justify-between border-b p-4">
              <h3 className="text-foreground text-lg font-semibold dark:text-white">
                Media Post
              </h3>
              <span className="bg-muted text-foreground dark:bg-muted dark:text-foreground rounded-full px-3 py-1 text-xs font-medium">
                {postsCount} {postsCount === 1 ? "File" : "Files"}
              </span>
            </div>

            {/* Media Grid */}
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {events.map((event: PreparedEventData, index: number) => {
                  const content = event.content;
                  const fileUrl =
                    typeof content === "object" &&
                    "fileUrl" in content &&
                    typeof content.fileUrl === "string"
                      ? content.fileUrl
                      : "";
                  return (
                    <div
                      // eslint-disable-next-line react/no-array-index-key -- Stable list of image previews, no unique ID available
                      key={index}
                      className="relative overflow-hidden rounded-lg"
                    >
                      <MediaThumbnail
                        src={fileUrl}
                        alt={`Preview ${index + 1}`}
                        className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-4 p-4">
              {/* Caption */}
              {(() => {
                const firstEvent = events[0];
                const firstContent = firstEvent?.content;
                const caption =
                  firstContent &&
                  typeof firstContent === "object" &&
                  "caption" in firstContent &&
                  typeof firstContent.caption === "string"
                    ? firstContent.caption
                    : "";
                return caption ? (
                  <div>
                    <h4 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
                      Caption
                    </h4>
                    <div className="dark:bg-muted bg-muted max-h-20 overflow-y-auto rounded-lg p-3">
                      <p className="text-muted-foreground dark:text-foreground text-sm whitespace-pre-wrap">
                        {caption + addTags}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Tags */}
              {tags ? (
                <div>
                  <h4 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {tags
                      .split(" ")
                      .filter((tag: string) => tag.length > 0)
                      .map((tag: string, tagIndex: number) => (
                        <span
                          // eslint-disable-next-line react/no-array-index-key -- Stable list of tags, no unique ID available
                          key={tagIndex}
                          className="bg-muted text-foreground dark:bg-muted dark:text-foreground rounded-full px-2 py-1 text-xs font-medium"
                        >
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </span>
                      ))}
                  </div>
                </div>
              ) : null}

              {/* Schedule time */}
              <div className="border-border dark:border-border rounded-lg border p-3 text-center">
                <h4 className="text-muted-foreground dark:text-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  Scheduled for
                </h4>
                <p className="text-foreground text-sm font-semibold dark:text-white">
                  {(() => {
                    const firstContent = events[0]?.content;
                    const scheduledForStr =
                      typeof firstContent === "object" &&
                      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime: typeof null === "object"
                      firstContent !== null &&
                      "scheduledFor" in firstContent &&
                      typeof (firstContent as { scheduledFor?: string })
                        .scheduledFor === "string"
                        ? (firstContent as { scheduledFor: string })
                            .scheduledFor
                        : null;
                    return scheduledForStr
                      ? (() => {
                          try {
                            const timestamp = parseInt(scheduledForStr, 10);
                            if (isNaN(timestamp)) return "Invalid date";
                            const zoned = fromUnixTimestamp(timestamp, "UTC");
                            const userTimezone = user?.timezone ?? "UTC";
                            const userZoned = zoned.withTimeZone(userTimezone);
                            return formatForDisplay(
                              userZoned,
                              userTimezone,
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                              undefined,
                              dateLocale
                            );
                          } catch {
                            return "Invalid date";
                          }
                        })()
                      : "Not scheduled";
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="dark:bg-card border-border text-muted-foreground hover:bg-muted dark:border-border dark:text-foreground dark:hover:bg-muted rounded-lg border bg-white px-6 py-3 text-sm font-medium shadow-sm transition-all hover:shadow-md"
            disabled={isSubmitting || isSigning}
          >
            ← Back to Edit
          </button>
          <button
            onClick={handleSaveAsDraft}
            className="dark:bg-card border-border text-muted-foreground hover:bg-muted dark:border-border dark:text-foreground dark:hover:bg-muted rounded-lg border bg-white px-6 py-3 text-sm font-medium shadow-sm transition-all hover:shadow-md"
            disabled={isSubmitting || isSigning}
          >
            💾 Save as Draft
          </button>
          <button
            onClick={() => void handleSignAndSubmit(true)}
            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-green-600 hover:to-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-green-300 disabled:to-green-400"
            disabled={isSubmitting || isSigning}
          >
            {isSigning ? "Waiting for signer…" : "🚀 Post Now"}
          </button>
          <button
            onClick={() => void handleSignAndSubmit(false)}
            className="rounded-lg bg-gradient-to-r from-[hsl(255,77%,51%)] to-[hsl(255,97%,51%)] px-8 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-[hsl(255,97%,51%)] hover:to-[hsl(255,77%,51%)] hover:shadow-xl disabled:cursor-not-allowed disabled:from-[hsl(255,77%,30%)] disabled:to-[hsl(255,97%,40%)]"
            disabled={isSubmitting || isSigning}
          >
            {isSigning ? (
              "Waiting for signer…"
            ) : isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Signing & Scheduling...
              </span>
            ) : (
              <>
                🚀 Schedule {postsCount} {postsCount === 1 ? "Post" : "Posts"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
