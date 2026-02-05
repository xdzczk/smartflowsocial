/**
 * Scheduled posts table component
 */

import { useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { dashboardKeys } from "~/features/posts/hooks/useDashboardQuery";
import { scheduledPostsKeys } from "~/features/posts/hooks/useScheduledPostsQuery";
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
  userTimeFormat?: "12h" | "24h" | null;
  onPostClick: (post: PostData) => void;
  onEditPost: (post: PostData) => void;
  onReschedulePost: (post: PostData) => void;
  onMediaClick: (src: string) => void;
  bulkDeleteState: string;
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
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
    className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left font-semibold"
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
  userTimeFormat,
  onPostClick,
  onEditPost,
  onReschedulePost,
  onMediaClick,
  bulkDeleteState,
  onScheduleRepost,
  onScheduleQuote,
}: ScheduledPostsTableProps) {
  const deleteFetcher = useFetcher<{ success?: boolean }>();
  const queryClient = useQueryClient();

  // Invalidate queries when individual delete succeeds
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      const data = deleteFetcher.data;
      if (typeof data === "object" && "success" in data && data.success) {
        // Invalidate both dashboard and scheduled posts queries
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        void queryClient.invalidateQueries({
          queryKey: scheduledPostsKeys.all,
        });
      }
    }
  }, [deleteFetcher.state, deleteFetcher.data, queryClient]);

  const timeFormat = userTimeFormat === "24h" ? "24h" : "12h";

  const formatDate = (scheduledAtUtc: Date | null) => {
    try {
      if (!scheduledAtUtc) return "-";
      const tz = userTimezone ?? "UTC";

      const zoned = fromDate(scheduledAtUtc, "UTC");
      const userZoned = zoned.withTimeZone(tz);

      return formatForDisplay(
        userZoned,
        tz,
        {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: timeFormat === "12h",
        },
        timeFormat
      );
    } catch {
      // Fallback - still use Temporal for consistency
      try {
        if (!scheduledAtUtc) return "-";
        const tz = userTimezone ?? "UTC";
        const zoned = fromDate(scheduledAtUtc, "UTC");
        const userZoned = zoned.withTimeZone(tz);
        return formatForDisplay(
          userZoned,
          tz,
          {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: timeFormat === "12h",
          },
          timeFormat
        );
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
          hour12: timeFormat === "12h",
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
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              <input
                id="scheduled-select-all"
                name="scheduled-select-all"
                type="checkbox"
                checked={
                  posts.length > 0 ? selectedPosts.size === posts.length : false
                }
                onChange={onToggleSelectAll}
                className="border-border accent-checkbox focus:ring-primary h-4 w-4 rounded"
              />
            </th>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
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
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              Time Remaining
            </th>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              Queue
            </th>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              Status
            </th>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className="border-border dark:hover:bg-muted hover:bg-muted cursor-pointer border-b"
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
                  className="border-border accent-checkbox focus:ring-primary h-4 w-4 rounded"
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
                    <div className="bg-accent/15 text-accent-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                      REPOST
                    </div>
                  ) : post.isQuotedPost ? (
                    <div className="bg-success/20 text-success dark:text-success flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                      QUOTE
                    </div>
                  ) : (
                    <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                      TEXT
                    </div>
                  )}
                  {post.repost && post.fileUrl.length > 0 ? (
                    <div className="bg-primary absolute -top-1 -right-1 rounded-full p-1">
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
                    <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
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
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted text-muted-foreground"
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
                    className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-primary/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none"
                  >
                    Reschedule
                  </button>
                  {onScheduleRepost ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScheduleRepost(post);
                      }}
                      className="border-border bg-card text-foreground hover:border-border hover:bg-muted focus:ring-primary active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none"
                    >
                      Schedule repost
                    </button>
                  ) : null}
                  {onScheduleQuote ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScheduleQuote(post);
                      }}
                      className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-primary/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none"
                    >
                      Schedule quote
                    </button>
                  ) : null}
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
                      className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-primary/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
