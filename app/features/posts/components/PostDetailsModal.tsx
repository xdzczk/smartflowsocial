import type { Post } from "@prisma/client";
import { useFetcher, Link } from "@remix-run/react";
import { useState } from "react";

import MediaModal from "~/components/ui/MediaModal";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { formatDate, getImageUrls } from "~/lib/helpers";
import { formatForDisplay, fromDate } from "~/lib/temporal";

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

  const formatScheduledDate = (scheduledAtUtc: Date | null | undefined) => {
    if (!scheduledAtUtc) return "Not scheduled";

    try {
      // Use Temporal for consistent formatting
      const timezone = userTimezone ?? "UTC";
      const zoned = fromDate(scheduledAtUtc, "UTC");
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
      return scheduledAtUtc.toLocaleDateString("en-US", {
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
      "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium";

    switch (type) {
      case "draft":
        return (
          <span
            className={`${badgeClasses} border-orange-300 bg-transparent text-orange-700 dark:border-transparent dark:bg-orange-500/20 dark:text-orange-400`}
          >
            Draft
          </span>
        );
      case "scheduled":
        return (
          <span
            className={`${badgeClasses} dark:bg-muted dark:text-muted-foreground border-border text-muted-foreground bg-transparent dark:border-transparent`}
          >
            Scheduled
          </span>
        );
      default:
        return (
          <span
            className={`${badgeClasses} border-green-300 bg-transparent text-green-700 dark:border-transparent dark:bg-green-500/20 dark:text-green-400`}
          >
            Posted
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dark:bg-card mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="dark:border-border dark:bg-card/95 border-border sticky top-0 z-10 border-b bg-white/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-foreground text-xl font-semibold dark:text-white">
                {getModalTitle()}
              </h2>
              {getStatusBadge()}
            </div>
            <button
              onClick={onClose}
              className="text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full transition-colors"
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
            <div className="dark:bg-card/50 bg-muted rounded-lg p-4">
              <h3 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
                Caption
              </h3>
              <p className="text-foreground leading-relaxed dark:text-white">
                {post.caption}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {type === "draft" ? (
                <div className="border-border dark:border-border rounded-lg border p-4">
                  <h3 className="text-muted-foreground dark:text-foreground mb-1 text-sm font-medium">
                    Created
                  </h3>
                  <p className="text-foreground dark:text-white">
                    {formatDate(post.createdAt)}
                  </p>
                </div>
              ) : null}

              {type === "scheduled" ? (
                <>
                  {"scheduledAtUtc" in post && post.scheduledAtUtc ? (
                    <div className="border-border dark:border-border rounded-lg border p-4">
                      <h3 className="text-muted-foreground dark:text-foreground mb-1 text-sm font-medium">
                        Scheduled For
                      </h3>
                      <p className="text-foreground dark:text-white">
                        {formatScheduledDate(post.scheduledAtUtc)}
                      </p>
                    </div>
                  ) : null}

                  {queueType ? (
                    <div className="border-border dark:border-border rounded-lg border p-4">
                      <h3 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
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
                    <div className="border-border dark:border-border rounded-lg border p-4">
                      <h3 className="text-muted-foreground dark:text-foreground mb-1 text-sm font-medium">
                        Posted At
                      </h3>
                      <p className="text-foreground dark:text-white">
                        {formatDate(post.postedAt)}
                      </p>
                    </div>
                  ) : null}

                  {queueType ? (
                    <div className="border-border dark:border-border rounded-lg border p-4">
                      <h3 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
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
                <div className="border-border dark:border-border rounded-lg border p-4">
                  <h3 className="text-muted-foreground dark:text-foreground mb-2 text-sm font-medium">
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
              <div className="border-border dark:border-border rounded-lg border p-4">
                <h3 className="text-muted-foreground dark:text-foreground mb-3 text-sm font-medium">
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
              <div className="border-border dark:border-border rounded-lg border p-4">
                <h3 className="text-muted-foreground dark:text-foreground mb-3 text-sm font-medium">
                  Engagement Stats
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="text-center">
                    <p className="text-foreground text-2xl font-bold dark:text-white">
                      {stats.likes}
                    </p>
                    <p className="text-foreground dark:text-foreground text-sm">
                      Likes
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-foreground text-2xl font-bold dark:text-white">
                      {stats.replies}
                    </p>
                    <p className="text-foreground dark:text-foreground text-sm">
                      Replies
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-foreground text-2xl font-bold dark:text-white">
                      {stats.mentions}
                    </p>
                    <p className="text-foreground dark:text-foreground text-sm">
                      Mentions
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-foreground text-2xl font-bold dark:text-white">
                      {stats.reposts}
                    </p>
                    <p className="text-foreground dark:text-foreground text-sm">
                      Reposts
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-foreground text-2xl font-bold dark:text-white">
                      {stats.zaps}
                    </p>
                    <p className="text-foreground dark:text-foreground text-sm">
                      Zaps
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-foreground text-2xl font-bold dark:text-white">
                      {stats.satszapped}
                    </p>
                    <p className="text-foreground dark:text-foreground text-sm">
                      Sats Zapped
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {showSignedEvent && post.signedEvent ? (
              <div className="border-border dark:border-border rounded-lg border p-4">
                <h3 className="text-muted-foreground dark:text-foreground mb-3 text-sm font-medium">
                  Signed Event Data
                </h3>
                <pre className="dark:bg-card bg-muted text-foreground dark:text-foreground max-h-96 overflow-auto rounded-md p-3 text-xs break-words whitespace-pre-wrap">
                  {JSON.stringify(post.signedEvent, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>

        <div className="dark:border-border dark:bg-card/95 border-border sticky bottom-0 border-t bg-white/95 px-6 py-4 backdrop-blur-sm">
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
                className="dark:bg-muted dark:hover:bg-muted bg-muted hover:bg-muted inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
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
                className="dark:bg-card inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950/50"
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
