import { useFetcher, type FetcherWithComponents } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { SignedEvent } from "~/features/nostr/types";
import { logClientError } from "~/lib/error-handler.client";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { fromUnixTimestamp, formatForDisplay } from "~/lib/temporal";

import { getSelectedQueueStyle } from "../queue-colors";
import type { BulkPost, PreparedEvent } from "../types";
import {
  buildAndSignQuoteSchedules,
  buildAndSignRepostSchedules,
} from "../utils/repost-quote-events.client";

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
  /** Original posts for per-row repost/quote schedules */
  posts: BulkPost[];
  postsCount: number;
  /** When editing a bulk draft group, pass so save-as-draft updates that group */
  groupId?: string | null;
  /** Override submit action URL (e.g. for in-page modal with mode). */
  submitAction?: string;
  /** Extra form fields to append on submit (e.g. _inModal). */
  extraFormData?: Record<string, string>;
  /** Optional fetcher to use (e.g. for modal to observe submit result). Must have submit(). */
  fetcher?: FetcherWithComponents<unknown>;
  /** User locale preferences for schedule display. */
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
}

export default function PostConfirmation({
  preparedEvents,
  posts,
  postsCount,
  groupId = null,
  submitAction: submitActionProp,
  extraFormData,
  fetcher: fetcherProp,
  userTimezone = "UTC",
  userTimeFormat = "12h",
}: PostConfirmationProps) {
  const { dateLocale } = useFormattedDate();
  const internalFetcher = useFetcher<{ error?: string }>();
  const fetcher = fetcherProp ?? internalFetcher;
  const isSubmitting = fetcher.state !== "idle";
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [signingProgress, setSigningProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const actionError =
    fetcher.state === "idle" &&
    fetcher.data != null &&
    typeof fetcher.data === "object" &&
    typeof (fetcher.data as { error?: string }).error === "string"
      ? (fetcher.data as { error: string }).error
      : null;

  useEffect(() => {
    if (actionError) {
      setSigningError(actionError);
    }
  }, [actionError]);

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

      for (let i = 0; i < signed.length; i++) {
        const signedEntry = signed[i];
        if (!signedEntry) continue;
        const eventData = preparedEvents[i];
        const mainScheduledUnix =
          typeof eventData?.scheduledFor === "number"
            ? eventData.scheduledFor
            : 0;
        const mainSigned = signedEntry.signedEvent as
          | { tags?: string[][] }
          | undefined;
        const tagArray = Array.isArray(mainSigned?.tags) ? mainSigned.tags : [];

        const repostSched = posts[i]?.repostSchedules;
        if (repostSched && repostSched.length > 0 && mainScheduledUnix > 0) {
          const repostArr = await buildAndSignRepostSchedules(
            mainScheduledUnix,
            repostSched,
            signedEntry.signedEvent as SignedEvent
          );
          finalFormData.append("repostSchedules", JSON.stringify(repostArr));
        } else {
          finalFormData.append("repostSchedules", JSON.stringify([]));
        }

        const quoteSched = posts[i]?.quoteSchedules;
        if (quoteSched && quoteSched.length > 0 && mainScheduledUnix > 0) {
          const quoteArr = await buildAndSignQuoteSchedules(
            mainScheduledUnix,
            quoteSched,
            signedEntry.signedEvent as SignedEvent,
            tagArray
          );
          finalFormData.append("quoteSchedules", JSON.stringify(quoteArr));
        } else {
          finalFormData.append("quoteSchedules", JSON.stringify([]));
        }
      }

      finalFormData.append("_action", "sign_and_schedule");
      if (extraFormData) {
        Object.entries(extraFormData).forEach(([k, v]) =>
          finalFormData.append(k, v)
        );
      }

      const actionUrl =
        submitActionProp ??
        `/dashboard/bulkposts${new URL(window.location.href).search}`;

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
        "scheduledFor",
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive for event payload
        eventData.scheduledFor != null ? String(eventData.scheduledFor) : ""
      );
      finalFormData.append(
        "isRecyclable",
        eventData.isRecyclable ? "true" : "false"
      );

      finalFormData.append("originalPostId", eventData.originalPostId ?? "");
    });
    finalFormData.append("_action", "save_as_draft");
    if (groupId) {
      finalFormData.append("groupId", groupId);
    }
    if (extraFormData) {
      Object.entries(extraFormData).forEach(([k, v]) =>
        finalFormData.append(k, v)
      );
    }

    const actionUrl =
      submitActionProp ??
      `/dashboard/bulkposts${new URL(window.location.href).search}`;

    fetcher.submit(finalFormData, {
      method: "post",
      encType: "multipart/form-data",
      action: actionUrl,
    });
  };

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-foreground text-3xl font-bold">
            Confirm Your Posts
          </h1>
          <p className="text-muted-foreground mt-2">
            Review your {postsCount} posts before scheduling them
          </p>
        </div>

        {isSigning ? (
          <div className="bg-muted text-muted-foreground mx-auto mb-4 max-w-3xl rounded-md border p-3 text-sm">
            Waiting for signer approval…
            {signingProgress ? (
              <span className="text-muted-foreground ml-2">
                ({signingProgress.current}/{signingProgress.total})
              </span>
            ) : null}{" "}
            If you’re using a remote signer, open it to approve the request.
          </div>
        ) : null}
        {(signingError ?? actionError) ? (
          <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive mx-auto mb-4 max-w-3xl rounded-md border p-3 text-sm">
            {signingError ?? actionError}
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
              mediaUrl = eventData.fileUrl[0] ?? "";
              caption = eventData.caption;
              tags = "";
            } else {
              const eventsContent = getEventsContent(eventsData);
              if (eventsContent) {
                const firstUrl = eventData.fileUrl[0] ?? "";
                const parsed = parseContentForRegularPost(
                  eventsContent,
                  eventData.caption,
                  firstUrl
                );
                caption = parsed.caption;
                mediaUrl = parsed.mediaUrl;
              } else {
                caption = eventData.caption;
                mediaUrl = eventData.fileUrl[0] ?? "";
              }
              const eventsTags = getEventsTags(eventsData);
              tags = extractTagsFromEvents(eventsTags);
            }

            const eventsTagsForDisplay = getEventsTags(eventsData);

            return (
              <div
                // eslint-disable-next-line react/no-array-index-key -- Stable list of prepared events, no unique ID available
                key={index}
                className="group bg-card overflow-hidden rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl"
              >
                {/* Post Header */}
                <div className="border-border flex items-center justify-between border-b p-4">
                  <h3 className="text-foreground text-lg font-semibold">
                    {isRepost ? `Repost ${index + 1}` : `Post ${index + 1}`}
                  </h3>
                  <span
                    className={`rounded-md border-2 px-3 py-1 text-xs font-medium ${getSelectedQueueStyle(eventData.queueType, true)}`}
                  >
                    {eventData.queueType}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-4 p-4">
                  {/* Caption */}
                  {caption ? (
                    <div>
                      <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                        Caption
                      </h4>
                      <div className="bg-muted max-h-20 overflow-y-auto rounded-lg p-3">
                        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                          {caption}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Media preview - shown after caption */}
                  {mediaUrl ? (
                    <div>
                      <h4 className="text-muted-foreground mb-2 text-sm font-medium">
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
                      <span className="text-muted-foreground">
                        {isRepost ? "REPOST" : "TEXT"}
                      </span>
                    </div>
                  ) : null}

                  {/* Tags - Only show hashtag tags (t) for non-reposts */}
                  {tags && !isRepost ? (
                    <div>
                      <h4 className="text-muted-foreground mb-2 text-sm font-medium">
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
                                className="bg-muted text-foreground rounded-full px-2 py-1 text-xs font-medium"
                              >
                                #{tagValue}
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}

                  {/* Schedule time */}
                  <div className="border-border rounded-lg border p-3 text-center">
                    <h4 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                      Scheduled for
                    </h4>
                    <p className="text-foreground text-sm font-semibold">
                      {(() => {
                        try {
                          const timestamp =
                            typeof eventData.scheduledFor === "number"
                              ? eventData.scheduledFor
                              : getCreatedAtTimestamp(eventsData);
                          const zoned = fromUnixTimestamp(timestamp, "UTC");
                          const userZoned = zoned.withTimeZone(userTimezone);
                          return formatForDisplay(
                            userZoned,
                            userTimezone,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: userTimeFormat === "12h",
                            },
                            userTimeFormat,
                            dateLocale
                          );
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
          <a
            href="/dashboard"
            className="bg-card border-border text-foreground hover:bg-muted rounded-lg border px-6 py-3 text-sm font-medium shadow-sm transition-all hover:shadow-md"
          >
            Dashboard
          </a>
          <button
            onClick={() => window.history.back()}
            className="bg-card border-border text-foreground hover:bg-muted rounded-lg border px-6 py-3 text-sm font-medium shadow-sm transition-all hover:shadow-md"
            disabled={isSubmitting || isSigning}
          >
            ← Back to Edit
          </button>
          <button
            onClick={handleSaveAsDraft}
            className="bg-card border-border text-foreground hover:bg-muted rounded-lg border px-6 py-3 text-sm font-medium shadow-sm transition-all hover:shadow-md"
            disabled={isSubmitting || isSigning}
          >
            💾 Save as Draft
          </button>
          <button
            onClick={() => void handleSignAndSubmit()}
            className="rounded-lg bg-gradient-to-r from-[hsl(255,77%,51%)] to-[hsl(255,97%,51%)] px-8 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-[hsl(255,97%,51%)] hover:to-[hsl(255,77%,51%)] hover:shadow-xl disabled:cursor-not-allowed disabled:from-[hsl(255,77%,30%)] disabled:to-[hsl(255,97%,40%)]"
            disabled={isSubmitting || isSigning}
          >
            {isSigning ? (
              <>Waiting for signer…</>
            ) : isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
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
