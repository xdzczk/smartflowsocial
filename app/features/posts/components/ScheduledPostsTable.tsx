/**
 * Scheduled posts table component
 */

import { useFetcher } from "@remix-run/react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { formatForDisplay, fromDate } from "~/lib/temporal";

import { getQueueColor } from "../queue-colors";
import type { PostData } from "../types";

interface ScheduledPostsTableProps {
  posts: PostData[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
  selectedPosts: Set<string>;
  onToggleSelection: (postId: string) => void;
  onToggleSelectAll: () => void;
  countdowns: Record<string, string>;
  userTimezone?: string | null;
  onPostClick: (post: PostData) => void;
  onEditPost: (post: PostData) => void;
  onReschedulePost: (post: PostData) => void;
  onMediaClick: (src: string) => void;
  bulkDeleteState: string;
}

interface SortableHeaderProps {
  sortKey: string;
  label: string;
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
}

const SortableHeader = ({
  sortKey,
  label,
  sortConfig,
  onRequestSort,
}: SortableHeaderProps) => (
  <th
    className="bg-secondary/30 text-foreground cursor-pointer px-3 py-4 text-left font-semibold"
    onClick={() => onRequestSort(sortKey)}
  >
    {label}{" "}
    {sortConfig.key === sortKey
      ? sortConfig.direction === "asc"
        ? "↑"
        : "↓"
      : null}
  </th>
);

export function ScheduledPostsTable({
  posts,
  sortConfig,
  onRequestSort,
  selectedPosts,
  onToggleSelection,
  onToggleSelectAll,
  countdowns,
  userTimezone,
  onPostClick,
  onEditPost,
  onReschedulePost,
  onMediaClick,
  bulkDeleteState,
}: ScheduledPostsTableProps) {
  const deleteFetcher = useFetcher();

  const formatDate = (scheduledAtUtc: Date | null) => {
    try {
      if (!scheduledAtUtc) return "-";
      const tz = userTimezone ?? "UTC";

      const zoned = fromDate(scheduledAtUtc, "UTC");
      const userZoned = zoned.withTimeZone(tz);

      return formatForDisplay(userZoned, tz, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      // Fallback - still use Temporal for consistency
      try {
        if (!scheduledAtUtc) return "-";
        const tz = userTimezone ?? "UTC";
        const zoned = fromDate(scheduledAtUtc, "UTC");
        const userZoned = zoned.withTimeZone(tz);
        return formatForDisplay(userZoned, tz, {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch {
        // Final fallback
        if (!scheduledAtUtc) return "-";
        const tz = userTimezone ?? "UTC";
        return scheduledAtUtc.toLocaleString("en-US", {
          timeZone: tz,
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }
    }
  };

  const getImageUrls = (fileUrl: string[] | null | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch (_e) {
        return [];
      }
    }

    return fileUrl;
  };

  return (
    <div className="border-border bg-card min-w-full overflow-x-auto rounded border">
      <table className="min-w-full align-middle text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-center font-semibold">
              <input
                id="scheduled-select-all"
                name="scheduled-select-all"
                type="checkbox"
                checked={
                  posts.length > 0 ? selectedPosts.size === posts.length : false
                }
                onChange={onToggleSelectAll}
                className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
              />
            </th>
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-left font-semibold">
              Media
            </th>
            <SortableHeader
              sortKey="caption"
              label="Caption"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="scheduledAtUtc"
              label="Scheduled For"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-center font-semibold">
              Time Remaining
            </th>
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-center font-semibold">
              Queue
            </th>
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-center font-semibold">
              Status
            </th>
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-center font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className="even:bg-secondary/20 hover:bg-accent/10 cursor-pointer"
              onClick={() => onPostClick(post)}
            >
              <td className="p-3 text-center">
                <input
                  id={`scheduled-select-${post.id}`}
                  name={`scheduled-select-${post.id}`}
                  type="checkbox"
                  checked={selectedPosts.has(post.id)}
                  onChange={() => onToggleSelection(post.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
                />
              </td>
              <td className="p-3">
                <div className="relative">
                  {post.fileUrl.length > 0 ? (
                    <MediaThumbnail
                      src={getImageUrls(post.fileUrl)[0]}
                      alt="Post preview"
                      className="h-12 w-12 rounded object-cover"
                      onClick={() => {
                        const imageUrl = getImageUrls(post.fileUrl)[0];
                        if (imageUrl) {
                          onMediaClick(imageUrl);
                        }
                      }}
                      fallback={
                        <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                          TEXT
                        </div>
                      }
                    />
                  ) : post.repost ? (
                    <div className="bg-accent/30 text-accent-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                      REPOST
                    </div>
                  ) : post.isQuotedPost ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-green-500/20 text-xs font-medium text-green-600 dark:text-green-400">
                      QUOTE
                    </div>
                  ) : (
                    <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                      TEXT
                    </div>
                  )}
                  {post.repost && post.fileUrl.length > 0 ? (
                    <div className="absolute -top-1 -right-1 rounded-full bg-purple-500 p-1">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                    </div>
                  ) : null}
                  {post.isQuotedPost && post.fileUrl.length > 0 ? (
                    <div className="absolute -top-1 -right-1 rounded-full bg-green-500 p-1">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                        />
                      </svg>
                    </div>
                  ) : null}
                </div>
              </td>
              <td className="p-3">
                <p className="font-medium">
                  {post.caption && post.caption.length > 21
                    ? post.caption.substring(0, 21) + "..."
                    : post.caption}
                </p>
              </td>
              <td className="text-foreground p-3">
                {formatDate(post.scheduledAtUtc)}
              </td>
              <td className="p-3 text-center">
                <div className="text-primary text-sm font-medium">
                  {countdowns[post.id] ?? "—"}
                </div>
              </td>
              <td className="p-3 text-center">
                {post.queueType?.color ? (
                  <div
                    className="inline-flex rounded-full border-2 px-3 py-1 text-xs leading-4 font-semibold shadow-sm"
                    style={{
                      backgroundColor: `${post.queueType.color}20`,
                      color: post.queueType.color,
                      borderColor: post.queueType.color,
                    }}
                  >
                    {post.queueType.name}
                  </div>
                ) : (
                  (() => {
                    const colors = getQueueColor(
                      post.queueType?.name ?? "unassigned"
                    );
                    return (
                      <div
                        className={`inline-flex rounded-full border-2 px-3 py-1 text-xs leading-4 font-semibold ${colors?.bg ?? ""} ${colors?.text ?? ""} ${colors?.border ?? ""} shadow-sm`}
                      >
                        {post.queueType?.name ?? "unassigned"}
                      </div>
                    );
                  })()
                )}
              </td>
              <td className="p-3 text-center">
                <div
                  className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold ${
                    post.signedEvent
                      ? "bg-primary/20 text-primary"
                      : "bg-green-500/20 text-green-600 dark:text-green-400"
                  }`}
                >
                  {post.signedEvent ? "Signed" : "Scheduled"}
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPost(post);
                    }}
                    className="border-primary/30 bg-card text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-primary/25 active:border-primary/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReschedulePost(post);
                    }}
                    className="bg-card inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/30 px-2 py-1 text-sm leading-5 font-semibold text-green-600 hover:border-green-500/50 hover:bg-green-500/10 focus:ring focus:ring-green-500/25 active:border-green-500/30 active:shadow-none dark:text-green-400"
                  >
                    Reschedule
                  </button>
                  <deleteFetcher.Form
                    method="post"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="_action" value="delete" />
                    <button
                      type="submit"
                      disabled={
                        deleteFetcher.state !== "idle" ||
                        bulkDeleteState !== "idle"
                      }
                      className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-destructive/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
                    >
                      {deleteFetcher.state !== "idle" &&
                      deleteFetcher.formData?.get("postId") === post.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </deleteFetcher.Form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
