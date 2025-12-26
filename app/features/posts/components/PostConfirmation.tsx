import { useFetcher } from "@remix-run/react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { getSelectedQueueStyle } from "~/features/posts/queueColors";
import { logClientError } from "~/lib/error-handler.client";
import { signEventFn } from "~/lib/nostr";

export default function PostConfirmation({ preparedEvents, postsCount }) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  const handleSignAndSubmit = async () => {
    try {
      const signed = await Promise.all(
        preparedEvents.map(async (eventData, index) => {
          try {
            const { nostrEvent, signedEvent } = await signEventFn(
              eventData.events,
            );

            return {
              nostrEvent,
              signedEvent,
              fileUrl: eventData.fileUrl,
              caption: eventData.caption,
              queueType: eventData.queueType,
              isRecyclable: eventData.isRecyclable,
              originalPostId: eventData.originalPostId,
            };
          } catch (eventError) {
            const { handleAsyncError } = await import("~/lib/error-handler.client");
            handleAsyncError(eventError, {
              component: "PostConfirmation",
              action: "signEvent",
              eventIndex: index,
            }, false); // Don't show toast, throw to outer catch
            throw eventError;
          }
        }),
      );

      const finalFormData = new FormData();
      signed.forEach((data) => {
        finalFormData.append("nostrEvent", JSON.stringify(data.nostrEvent));
        finalFormData.append("signedEvents", JSON.stringify(data.signedEvent));
        finalFormData.append("fileUrl", JSON.stringify(data.fileUrl));
        finalFormData.append("caption", JSON.stringify(data.caption));
        finalFormData.append("queueType", data.queueType);
        finalFormData.append(
          "isRecyclable",
          data.isRecyclable ? "true" : "false",
        );
        finalFormData.append("originalPostId", data.originalPostId || "");
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
      handleAsyncError(error, {
        component: "PostConfirmation",
        action: "handleSignAndSubmit",
      }, false); // Don't show toast, let component handle it
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
        eventData.isRecyclable ? "true" : "false",
      );
      finalFormData.append("originalPostId", eventData.originalPostId || "");
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Confirm Your Posts
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Review your {postsCount} posts before scheduling them
          </p>
        </div>

        {/* Posts Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {preparedEvents?.map((eventData, index) => {
            // Check if this is a repost (kind 6)
            const isRepost = eventData.events.kind === 6;

            // Debug logging for reposts
            if (isRepost) {
              logClientError(
                `Repost ${index + 1} data`,
                {
                  component: "PostConfirmation",
                  action: "renderRepost",
                  index: index + 1,
                  fileUrl: eventData.fileUrl,
                  caption: eventData.caption,
                  kind: eventData.events.kind,
                  tags: eventData.events.tags,
                },
                "info",
              );
            }

            // For reposts, use the original fileUrl directly
            // For regular posts, parse content to extract media URLs
            let mediaUrl = "";
            let caption = "";
            let tags = "";

            if (isRepost) {
              // For reposts, use the fileUrl from the eventData
              mediaUrl = eventData.fileUrl || "";
              caption = eventData.caption || "";
              // Hide tags for reposts
              tags = "";
            } else {
              // For regular posts, parse content assuming format: "caption mediaUrl1 mediaUrl2 ..."
              if (
                eventData.events.content &&
                typeof eventData.events.content === "string"
              ) {
                const contentParts = eventData.events.content.split(" ");
                const mediaUrls = contentParts.filter(
                  (part) =>
                    part &&
                    part.trim() !== "" &&
                    part !== "null" &&
                    part.startsWith("http"),
                );
                const captionParts = contentParts.filter(
                  (part) =>
                    part &&
                    part.trim() !== "" &&
                    part !== "null" &&
                    !part.startsWith("http"),
                );

                caption = captionParts.join(" ");
                mediaUrl = mediaUrls[0] || "";
              } else {
                // Fallback to eventData.caption if content is not available
                caption = eventData.caption || "";
                mediaUrl = eventData.fileUrl || "";
              }
              tags = eventData.events.tags.map((tag) => `#${tag[1]}`).join(" ");
            }

            return (
              <div
                key={index}
                className="group overflow-hidden rounded-xl bg-white shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-gray-800"
              >
                {/* Post Header */}
                <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                      <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Caption
                      </h4>
                      <div className="max-h-20 overflow-y-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                          {caption}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Media preview - shown after caption */}
                  {mediaUrl ? (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
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
                    <div className="flex h-32 w-full items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700">
                      <span className="text-gray-500 dark:text-gray-400">
                        {isRepost ? "REPOST" : "TEXT"}
                      </span>
                    </div>
                  ) : null}

                  {/* Tags - Only show hashtag tags (t) for non-reposts */}
                  {tags && !isRepost ? (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {eventData.events.tags
                          .filter((tag) => tag[0] === "t") // Only show hashtag tags
                          .map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                            >
                              #{tag[1]}
                            </span>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Schedule time */}
                  <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-600">
                    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Scheduled for
                    </h4>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {new Date(
                        eventData.events.created_at * 1000,
                      ).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            disabled={isSubmitting}
          >
            ← Back to Edit
          </button>
          <button
            onClick={handleSaveAsDraft}
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            disabled={isSubmitting}
          >
            💾 Save as Draft
          </button>
          <button
            onClick={handleSignAndSubmit}
            className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-8 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-blue-300 disabled:to-blue-400"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
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
