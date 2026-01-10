import { useFetcher } from "@remix-run/react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
interface PreparedEventData {
  content: {
    fileUrl: string;
    scheduledFor: string;
    caption: string;
    queueType: string;
  };
  type: "media";
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
    return Date.now();
  }

  if (userTimezone !== "UTC" && userTimezone !== "Etc/GMT") {
    const utcDate = new Date(scheduledForStr);
    const userDate = new Date(scheduledForStr).toLocaleString("en-US", {
      timeZone: userTimezone,
    });
    const userOffset =
      (new Date(userDate).getTime() - new Date(scheduledForStr).getTime()) /
      60000;
    utcDate.setMinutes(utcDate.getMinutes() - userOffset);
    return utcDate.getTime();
  }

  const dateObj = new Date(scheduledForStr + "Z");
  return dateObj.getTime();
}

function extractFileUrls(events: PreparedEventData[]): string[] {
  return events
    .map((event) => {
      const content = event.content;
      if (
        typeof content === "object" &&
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
  const user = useOptionalUser();

  // Calculate addTags for display
  const addTags = user?.showHashTagsinPosts ? `\n${tags}` : "";

  // Flatten the array structure if needed
  const events: PreparedEventData[] = Array.isArray(preparedEvents[0])
    ? (preparedEvents[0] as PreparedEventData[])
    : preparedEvents;

  const handleSignAndSubmit = async (isImmediate: boolean) => {
    try {
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

      const { signedEvent, nostrEvent } =
        await nostrAdapter.signEvent(eventData);

      const formData = new FormData();
      formData.append("_action", isImmediate ? "post-media" : "schedule-media");
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("nostrEvent", JSON.stringify(nostrEvent));
      const fileUrlsForForm = events
        .map((event) => {
          const content = event.content;
          if (
            typeof content === "object" &&
            "fileUrl" in content &&
            typeof content.fileUrl === "string"
          ) {
            return (content as { fileUrl: string }).fileUrl;
          }
          return "";
        })
        .filter((url) => url !== "");
      const firstEventContent = events[0]?.content;
      const captionForForm =
        typeof firstEventContent === "object" &&
        "caption" in firstEventContent &&
        typeof (firstEventContent as { caption: unknown }).caption === "string"
          ? (firstEventContent as { caption: string }).caption
          : "";
      const queueTypeForForm =
        typeof firstEventContent === "object" &&
        "queueType" in firstEventContent &&
        typeof (firstEventContent as { queueType: unknown }).queueType ===
          "string"
          ? (firstEventContent as { queueType: string }).queueType
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
    }
  };

  const handleSaveAsDraft = () => {
    const formData = new FormData();
    formData.append("_action", "draft-media");
    const draftFileUrls = events
      .map((event) => {
        const content = event.content;
        if (
          typeof content === "object" &&
          "fileUrl" in content &&
          typeof content.fileUrl === "string"
        ) {
          return (content as { fileUrl: string }).fileUrl;
        }
        return "";
      })
      .filter((url) => url !== "");
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Confirm Your Post
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Review your post before publishing or scheduling
          </p>
        </div>

        {/* Post Card */}
        <div className="mx-auto max-w-2xl">
          <div className="group overflow-hidden rounded-xl bg-white shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-gray-800">
            {/* Post Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Media Post
              </h3>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
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
                    <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Caption
                    </h4>
                    <div className="max-h-20 overflow-y-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                      <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                        {caption + addTags}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Tags */}
              {tags ? (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
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
                          className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                        >
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </span>
                      ))}
                  </div>
                </div>
              ) : null}

              {/* Schedule time */}
              <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-600">
                <h4 className="mb-1 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  Scheduled for
                </h4>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {events[0]?.content.scheduledFor
                    ? new Date(
                        events[0].content.scheduledFor
                      ).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Not scheduled"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={onCancel}
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
            onClick={() => void handleSignAndSubmit(true)}
            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-green-600 hover:to-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-green-300 disabled:to-green-400"
            disabled={isSubmitting}
          >
            🚀 Post Now
          </button>
          <button
            onClick={() => void handleSignAndSubmit(false)}
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
