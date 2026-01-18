import type { Post } from "@prisma/client";
import { useFetcher, Link } from "@remix-run/react";
import { useState } from "react";

import MediaModal from "~/components/ui/MediaModal";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { formatDate, getImageUrls } from "~/lib/helpers";
import { formatForDisplay, fromUnixTimestamp } from "~/lib/temporal";

import { getQueueColor } from "../queue-colors";
import type { CombinedContent, PostData } from "../types";
interface PostDetailsModalProps {
  post: Post | PostData | CombinedContent;
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  onClose: () => void;
  showStats?: boolean;
  showSignedEvent?: boolean;
  type?: "draft" | "posted" | "scheduled";
  userTimezone?: string;
}

export default function PostDetailsModal({
  post,
  stats,
  onClose,
  showStats = false,
  showSignedEvent = false,
  type = "posted",
  userTimezone,
}: PostDetailsModalProps) {
  const deleteFetcher = useFetcher();
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [activeMediaSrc, setActiveMediaSrc] = useState<string | null>(null);

  // Type guard to check if post has queueType property
  const hasQueueType = (
    p: Post | PostData | CombinedContent
  ): p is PostData | CombinedContent => {
    return "queueType" in p;
  };

  const queueType = hasQueueType(post) ? post.queueType : null;

  const formatScheduledDate = (scheduledFor: string | null | undefined) => {
    if (!scheduledFor) return "Not scheduled";

    try {
      // Use Temporal for consistent formatting
      const timezone = userTimezone ?? "UTC";
      const timestamp = parseInt(scheduledFor, 10);
      if (isNaN(timestamp)) return "Not scheduled";

      const zoned = fromUnixTimestamp(timestamp, "UTC");
      const userZoned = zoned.withTimeZone(timezone);

      return formatForDisplay(userZoned, timezone, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      // Fallback to simple formatting
      const dateObj = new Date(parseInt(scheduledFor, 10) * 1000);
      return dateObj.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  };

  const getModalTitle = () => {
    switch (type) {
      case "draft":
        return "Draft Details";
      case "scheduled":
        return "Scheduled Post Details";
      default:
        return "Post Details";
    }
  };

  const getDeleteButtonText = () => {
    switch (type) {
      case "draft":
        return "Delete Draft";
      case "scheduled":
        return "Delete Scheduled Post";
      default:
        return "Delete Post";
    }
  };

  const getStatusBadge = () => {
    const badgeClasses =
      "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium";

    switch (type) {
      case "draft":
        return (
          <span
            className={`${badgeClasses} bg-orange-100 text-orange-900 dark:bg-orange-700/10 dark:text-orange-200`}
          >
            Draft
          </span>
        );
      case "scheduled":
        return (
          <span
            className={`${badgeClasses} bg-blue-100 text-blue-900 dark:bg-blue-700/10 dark:text-blue-200`}
          >
            Scheduled
          </span>
        );
      default:
        return (
          <span
            className={`${badgeClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200`}
          >
            Posted
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {getModalTitle()}
              </h2>
              {getStatusBadge()}
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {post.fileUrl && post.fileUrl.length > 0 ? (
            <div className="mb-6">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {getImageUrls(post.fileUrl).map((url, index) => (
                  <MediaThumbnail
                    // eslint-disable-next-line react/no-array-index-key -- Stable list of image URLs, no unique ID available
                    key={index}
                    src={url}
                    alt={`Post media ${index + 1}`}
                    className="h-48 w-auto flex-shrink-0 rounded-lg object-cover ring-1 shadow-sm ring-gray-200 dark:ring-gray-700"
                    onClick={() => {
                      setActiveMediaSrc(url);
                      setIsMediaOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-6">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
              <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Caption
              </h3>
              <p className="leading-relaxed text-gray-900 dark:text-white">
                {post.caption}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {type === "draft" ? (
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Created
                  </h3>
                  <p className="text-gray-900 dark:text-white">
                    {formatDate(post.createdAt)}
                  </p>
                </div>
              ) : null}

              {type === "scheduled" ? (
                <>
                  {"scheduledAtUtc" in post && post.scheduledAtUtc ? (
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h3 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Scheduled For
                      </h3>
                      <p className="text-gray-900 dark:text-white">
                        {formatScheduledDate(
                          Math.floor(
                            post.scheduledAtUtc.getTime() / 1000
                          ).toString()
                        )}
                      </p>
                    </div>
                  ) : null}

                  {queueType ? (
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Queue Type
                      </h3>
                      {(() => {
                        const colors = getQueueColor(
                          queueType.name,
                          queueType.color
                        );
                        return (
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${colors?.bg ?? ""} ${colors?.text ?? ""}`}
                          >
                            {queueType.name}
                          </span>
                        );
                      })()}
                    </div>
                  ) : null}
                </>
              ) : null}

              {type === "posted" ? (
                <>
                  {post.postedAt ? (
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h3 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Posted At
                      </h3>
                      <p className="text-gray-900 dark:text-white">
                        {formatDate(post.postedAt)}
                      </p>
                    </div>
                  ) : null}

                  {queueType ? (
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Queue Type
                      </h3>
                      {(() => {
                        const colors = getQueueColor(
                          queueType.name,
                          queueType.color
                        );
                        return (
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${colors?.bg ?? ""} ${colors?.text ?? ""}`}
                          >
                            {queueType.name}
                          </span>
                        );
                      })()}
                    </div>
                  ) : null}
                </>
              ) : null}

              {type === "draft" && queueType ? (
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Queue Type
                  </h3>
                  {(() => {
                    const colors = getQueueColor(
                      queueType.name,
                      queueType.color
                    );
                    return (
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${colors?.bg ?? ""} ${colors?.text ?? ""}`}
                      >
                        {queueType.name}
                      </span>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            {post.tags && post.tags.length > 0 && !post.repost ? (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {showStats && stats ? (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Engagement Stats
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.likes}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Likes
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.replies}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Replies
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.mentions}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Mentions
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.reposts}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Reposts
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.zaps}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Zaps
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.satszapped}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Sats Zapped
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {showSignedEvent && post.signedEvent ? (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Signed Event Data
                </h3>
                <pre className="max-h-96 overflow-auto rounded-md bg-gray-100 p-3 text-xs break-words whitespace-pre-wrap text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  {JSON.stringify(post.signedEvent, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
          <div className="flex justify-end gap-3">
            {type === "posted" &&
            post.signedEvent &&
            typeof post.signedEvent === "object" &&
            "id" in post.signedEvent &&
            typeof post.signedEvent.id === "string" ? (
              <Link
                to={`https://primal.net/e/${post.signedEvent.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                View Note
              </Link>
            ) : null}

            <deleteFetcher.Form
              method="post"
              onClick={(e) => e.stopPropagation()}
            >
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="_action" value="delete" />
              <button
                type="submit"
                disabled={deleteFetcher.state !== "idle"}
                className="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                {deleteFetcher.state !== "idle" &&
                deleteFetcher.formData?.get("postId") === post.id
                  ? "Deleting..."
                  : getDeleteButtonText()}
              </button>
            </deleteFetcher.Form>
          </div>
        </div>
      </div>

      {/* Media full-screen modal */}
      <MediaModal
        src={activeMediaSrc ?? ""}
        isOpen={Boolean(isMediaOpen && activeMediaSrc)}
        onClose={() => setIsMediaOpen(false)}
      />
    </div>
  );
}
