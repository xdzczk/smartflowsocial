import { useFetcher } from "@remix-run/react";
import { useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { logClientError } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { fromUnixTimestamp, formatForDisplay } from "~/lib/temporal";

import { getSelectedQueueStyle } from "../queue-colors";
import type { PreparedEvent } from "../types";

// ============================================================================
// Helper Functions
// ============================================================================

function getEventsKind(eventsData: unknown): number | undefined {
  if (
    typeof eventsData === "object" &&
    eventsData !== null &&
    "kind" in eventsData
  ) {
    return (eventsData as { kind?: unknown }).kind as number | undefined;
  }
  return undefined;
}

function getEventsContent(eventsData: unknown): string | undefined {
  if (
    typeof eventsData === "object" &&
    eventsData !== null &&
    "content" in eventsData
  ) {
    const content = (eventsData as { content?: unknown }).content;
    return typeof content === "string" ? content : undefined;
  }
  return undefined;
}

function getEventsTags(eventsData: unknown): unknown {
  if (
    typeof eventsData === "object" &&
    eventsData !== null &&
    "tags" in eventsData
  ) {
    return (eventsData as { tags?: unknown }).tags;
  }
  return undefined;
}

function parseContentForRegularPost(
  eventsContent: string,
  fallbackCaption: string,
  fallbackFileUrl: string
): { caption: string; mediaUrl: string } {
  const contentParts = eventsContent.split(" ");
  const mediaUrl =
    contentParts.find(
      (part) =>
        part && part.trim() !== "" && part !== "null" && part.startsWith("http")
    ) ?? "";

  const captionParts = contentParts.filter(
    (part) =>
      part && part.trim() !== "" && part !== "null" && !part.startsWith("http")
  );

  return {
    caption: captionParts.length > 0 ? captionParts.join(" ") : fallbackCaption,
    mediaUrl: mediaUrl || fallbackFileUrl,
  };
}

function extractTagsFromEvents(eventsTags: unknown): string {
  if (!Array.isArray(eventsTags)) {
    return "";
  }
  return eventsTags
    .map((tag) =>
      Array.isArray(tag) && typeof tag[1] === "string" ? `#${tag[1]}` : ""
    )
    .filter((t) => t !== "")
    .join(" ");
}

function getCreatedAtTimestamp(eventsData: unknown): number {
  if (
    typeof eventsData === "object" &&
    eventsData !== null &&
    "created_at" in eventsData &&
    typeof (eventsData as { created_at?: unknown }).created_at === "number"
  ) {
    return (eventsData as { created_at: number }).created_at;
  }
  return 0;
}

interface PostConfirmationProps {
  preparedEvents: PreparedEvent[];
  postsCount: number;
}

export default function PostConfirmation({
  preparedEvents,
  postsCount,
}: PostConfirmationProps) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [signingProgress, setSigningProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleSignAndSubmit = async () => {
    try {
      setSigningError(null);
      setIsSigning(true);
      setSigningProgress({ current: 0, total: preparedEvents.length });

      // Sign sequentially to avoid flooding remote signers with concurrent requests
      const signed: Array<{
        nostrEvent: unknown;
        signedEvent: unknown;
        fileUrl: unknown;
        caption: unknown;
        queueType: string;
        isRecyclable: boolean;
        originalPostId: string | null | undefined;
      }> = [];

      for (let index = 0; index < preparedEvents.length; index++) {
        const eventData = preparedEvents[index];
        if (!eventData) {
          throw new Error("Missing prepared event data");
        }
        try {
          const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
            eventData.events
          );
          signed.push({
            nostrEvent,
            signedEvent,
            fileUrl: eventData.fileUrl,
            caption: eventData.caption,
            queueType: eventData.queueType,
            isRecyclable: eventData.isRecyclable,
            originalPostId: eventData.originalPostId,
          });
          setSigningProgress({
            current: index + 1,
            total: preparedEvents.length,
          });
        } catch (eventError) {
          const { handleAsyncError } =
            await import("~/lib/error-handler.client");
          handleAsyncError(
            eventError,
            {
              component: "PostConfirmation",
              action: "signEvent",
              eventIndex: index,
            },
            false
          ); // Don't show toast, throw to outer catch
          throw eventError;
        }
      }

      const finalFormData = new FormData();
      signed.forEach((data) => {
        finalFormData.append("nostrEvent", JSON.stringify(data.nostrEvent));
        finalFormData.append("signedEvents", JSON.stringify(data.signedEvent));
        finalFormData.append("fileUrl", JSON.stringify(data.fileUrl));
        finalFormData.append("caption", JSON.stringify(data.caption));
        finalFormData.append("queueType", data.queueType);
        finalFormData.append(
          "isRecyclable",
          data.isRecyclable ? "true" : "false"
        );
        finalFormData.append("originalPostId", data.originalPostId ?? "");
      });
      finalFormData.append("_action", "sign_and_schedule");

      // Preserve the current URL's search params (including mode=recycle)
      const currentUrl = new URL(window.location.href);
      const actionUrl = `/dashboard/bulkposts${currentUrl.search}`;

      fetcher.submit(finalFormData, {
        method: "post",
        encType: "multipart/form-data",
        action: actionUrl,
      });
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "PostConfirmation",
          action: "handleSignAndSubmit",
        },
        false
      ); // Don't show toast, let component handle it
      setSigningError(
        error instanceof Error
          ? error.message
          : "Failed to sign posts. Please try again."
      );
    } finally {
      setIsSigning(false);
      setSigningProgress(null);
    }
  };

  const handleSaveAsDraft = () => {
    const finalFormData = new FormData();
    preparedEvents.forEach((eventData) => {
      finalFormData.append("fileUrl", JSON.stringify(eventData.fileUrl));
      finalFormData.append("caption", JSON.stringify(eventData.caption));
      finalFormData.append("queueType", eventData.queueType);
      finalFormData.append(
        "isRecyclable",
        eventData.isRecyclable ? "true" : "false"
      );
      finalFormData.append("originalPostId", eventData.originalPostId ?? "");
    });
    finalFormData.append("_action", "save_as_draft");

    // Preserve the current URL's search params (including mode=recycle)
    const currentUrl = new URL(window.location.href);
    const actionUrl = `/dashboard/bulkposts${currentUrl.search}`;

    fetcher.submit(finalFormData, {
      method: "post",
      encType: "multipart/form-data",
      action: actionUrl,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-foreground text-3xl font-bold dark:text-white">
            Confirm Your Posts
          </h1>
          <p className="text-foreground dark:text-foreground mt-2">
            Review your {postsCount} posts before scheduling them
          </p>
        </div>

        {isSigning ? (
          <div className="dark:bg-card/30 dark:text-foreground text-muted-foreground mx-auto mb-4 max-w-3xl rounded-md border bg-white/50 p-3 text-sm">
            Waiting for signer approval…
            {signingProgress ? (
              <span className="text-muted-foreground ml-2">
                ({signingProgress.current}/{signingProgress.total})
              </span>
            ) : null}{" "}
            If you’re using a remote signer, open it to approve the request.
          </div>
        ) : null}
        {signingError ? (
          <div className="mx-auto mb-4 max-w-3xl rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {signingError}
          </div>
        ) : null}

        {/* Posts Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {preparedEvents.map((eventData, index) => {
            const eventsData = eventData.events;
            const eventsKind = getEventsKind(eventsData);
            const isRepost = eventsKind === 6;

            // Debug logging for reposts
            if (isRepost) {
              const eventsTags = getEventsTags(eventsData);
              logClientError(
                `Repost ${index + 1} data`,
                {
                  component: "PostConfirmation",
                  action: "renderRepost",
                  index: index + 1,
                  fileUrl: eventData.fileUrl,
                  caption: eventData.caption,
                  kind: eventsKind,
                  tags: eventsTags,
                },
                "info"
              );
            }

            // Extract media URL, caption, and tags
            let mediaUrl = "";
            let caption = "";
            let tags = "";

            if (isRepost) {
              mediaUrl = eventData.fileUrl;
              caption = eventData.caption;
              tags = "";
            } else {
              const eventsContent = getEventsContent(eventsData);
              if (eventsContent) {
                const parsed = parseContentForRegularPost(
                  eventsContent,
                  eventData.caption,
                  eventData.fileUrl
                );
                caption = parsed.caption;
                mediaUrl = parsed.mediaUrl;
              } else {
                caption = eventData.caption;
                mediaUrl = eventData.fileUrl;
              }
              const eventsTags = getEventsTags(eventsData);
              tags = extractTagsFromEvents(eventsTags);
            }

            const eventsTagsForDisplay = getEventsTags(eventsData);

            return (
              <div
                // eslint-disable-next-line react/no-array-index-key -- Stable list of prepared events, no unique ID available
                key={index}
                className="group dark:bg-card overflow-hidden rounded-xl bg-white shadow-lg transition-all duration-300 hover:shadow-xl"
              >
                {/* Post Header */}
                <div className="border-border dark:border-border flex items-center justify-between border-b p-4">
                  <h3 className="text-foreground text-lg font-semibold dark:text-white">
                    {isRepost ? `Repost ${index + 1}` : `Post ${index + 1}`}
                  </h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getSelectedQueueStyle(eventData.queueType, true)}`}
                  >
                    {eventData.queueType}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-4 p-4">
                  {/* Caption */}
                  {caption ? (
                    <div>
                      <h4 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
                        Caption
                      </h4>
                      <div className="dark:bg-muted bg-muted max-h-20 overflow-y-auto rounded-lg p-3">
                        <p className="text-muted-foreground dark:text-foreground text-sm whitespace-pre-wrap">
                          {caption}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Media preview - shown after caption */}
                  {mediaUrl ? (
                    <div>
                      <h4 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
                        Media
                      </h4>
                      <div className="relative overflow-hidden rounded-lg">
                        <MediaThumbnail
                          src={mediaUrl}
                          alt={`Preview ${index + 1}`}
                          className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      </div>
                    </div>
                  ) : null}

                  {/* Show placeholder for text-only posts */}
                  {!mediaUrl && !caption ? (
                    <div className="dark:bg-muted bg-muted flex h-32 w-full items-center justify-center rounded-lg">
                      <span className="text-muted-foreground dark:text-foreground">
                        {isRepost ? "REPOST" : "TEXT"}
                      </span>
                    </div>
                  ) : null}

                  {/* Tags - Only show hashtag tags (t) for non-reposts */}
                  {tags && !isRepost ? (
                    <div>
                      <h4 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(eventsTagsForDisplay)
                          ? eventsTagsForDisplay
                          : []
                        )
                          .filter((tag) => Array.isArray(tag) && tag[0] === "t") // Only show hashtag tags
                          .map((tag, tagIndex) => {
                            const tagValue =
                              Array.isArray(tag) && typeof tag[1] === "string"
                                ? tag[1]
                                : "";
                            return (
                              <span
                                // eslint-disable-next-line react/no-array-index-key -- Stable list of tags, no unique ID available
                                key={tagIndex}
                                className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                              >
                                #{tagValue}
                              </span>
                            );
                          })}
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
                        try {
                          const timestamp = getCreatedAtTimestamp(eventsData);
                          const zoned = fromUnixTimestamp(timestamp, "UTC");
                          const userTimezone = "UTC"; // Default timezone - user prop not available in this scope
                          const userZoned = zoned.withTimeZone(userTimezone);
                          return formatForDisplay(userZoned, userTimezone, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        } catch {
                          return "Invalid date";
                        }
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => window.history.back()}
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
            onClick={() => void handleSignAndSubmit()}
            className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-8 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-blue-300 disabled:to-blue-400"
            disabled={isSubmitting || isSigning}
          >
            {isSigning ? (
              <>Waiting for signer…</>
            ) : isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Signing & Scheduling...
              </span>
            ) : (
              <>🚀 Sign and Schedule {postsCount} Posts</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
