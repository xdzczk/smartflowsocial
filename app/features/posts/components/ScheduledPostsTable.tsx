/**
 * Scheduled posts table component
 */

import { useFetcher } from "@remix-run/react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { ScheduledPostTablePost } from "~/lib/validation/post-data-conversion.server";

import { getQueueColor } from "../queue-colors";

interface ScheduledPostsTableProps {
  posts: ScheduledPostTablePost[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
  selectedPosts: Set<string>;
  onToggleSelection: (postId: string) => void;
  onToggleSelectAll: () => void;
  countdowns: Record<string, string>;
  userTimezone?: string | null;
  onPostClick: (post: ScheduledPostTablePost) => void;
  onEditPost: (post: ScheduledPostTablePost) => void;
  onReschedulePost: (post: ScheduledPostTablePost) => void;
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
    className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
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

  const formatDate = (unixTimestamp: string) => {
    const tz = userTimezone ?? "UTC";
    const date = new Date(parseInt(unixTimestamp) * 1000);
    return date.toLocaleString("en-US", {
      timeZone: tz,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getImageUrls = (fileUrl: string[] | null | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch (e) {
        console.error("Error parsing fileUrl:", e);
        return [];
      }
    }

    return fileUrl;
  };

  return (
    <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="min-w-full align-middle text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              <input
                type="checkbox"
                checked={
                  posts.length > 0 ? selectedPosts.size === posts.length : false
                }
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
            </th>
            <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              Media
            </th>
            <SortableHeader
              sortKey="caption"
              label="Caption"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="scheduledFor"
              label="Scheduled For"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              Time Remaining
            </th>
            <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              Queue
            </th>
            <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              Status
            </th>
            <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className="cursor-pointer even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
              onClick={() => onPostClick(post)}
            >
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={selectedPosts.has(post.id)}
                  onChange={() => onToggleSelection(post.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </td>
              <td className="p-3">
                <div className="relative">
                  {post.fileUrl && post.fileUrl.length > 0 ? (
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
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          TEXT
                        </div>
                      }
                    />
                  ) : post.repost ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-purple-100 text-xs font-medium text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                      REPOST
                    </div>
                  ) : post.isQuotedPost ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-green-100 text-xs font-medium text-green-800 dark:bg-green-800 dark:text-green-200">
                      QUOTE
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      TEXT
                    </div>
                  )}
                  {post.repost && post.fileUrl && post.fileUrl.length > 0 ? (
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
                  {post.isQuotedPost &&
                  post.fileUrl &&
                  post.fileUrl.length > 0 ? (
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
              <td className="p-3">{formatDate(post.scheduledFor)}</td>
              <td className="p-3 text-center">
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
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
                    post.isPostSigned
                      ? "bg-blue-100 text-blue-900 dark:border-blue-900/75 dark:bg-blue-700/10 dark:text-blue-200"
                      : "bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-700/10 dark:text-emerald-200"
                  }`}
                >
                  {post.isPostSigned ? "Signed" : "Scheduled"}
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPost(post);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReschedulePost(post);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
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
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
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
