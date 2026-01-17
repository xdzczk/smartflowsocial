/**
 * Drafts table component
 */

import { Link, useFetcher } from "@remix-run/react";

import { formatForDisplay, fromISOString } from "~/lib/temporal";

import { getQueueColor } from "../queue-colors";
interface Post {
  id: string;
  caption?: string | null;
  createdAt: string;
  fileUrl?: string[] | null;
  queueType?: { name: string; color?: string | null } | null;
}

interface DraftsTableProps {
  posts: Post[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
  selectedPosts: Set<string>;
  onToggleSelection: (postId: string) => void;
  onToggleSelectAll: () => void;
  onPostClick: (post: Post) => void;
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

export function DraftsTable({
  posts,
  sortConfig,
  onRequestSort,
  selectedPosts,
  onToggleSelection,
  onToggleSelectAll,
  onPostClick,
  bulkDeleteState,
}: DraftsTableProps) {
  const deleteFetcher = useFetcher();

  const formatDate = (isoString: string) => {
    try {
      const zoned = fromISOString(isoString, "UTC");
      return formatForDisplay(zoned, "UTC", {
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
        const zoned = fromISOString(isoString, "UTC");
        return formatForDisplay(zoned, "UTC", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch {
        // Final fallback
        const date = new Date(isoString);
        return date.toLocaleString("en-US", {
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
              sortKey="createdAt"
              label="Created"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
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
                {post.fileUrl && post.fileUrl.length > 0 ? (
                  <img
                    src={getImageUrls(post.fileUrl)[0]}
                    alt="Post preview"
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    TEXT
                  </div>
                )}
              </td>
              <td className="p-3">
                <p className="font-medium">{post.caption ?? "—"}</p>
              </td>
              <td className="p-3">{formatDate(post.createdAt)}</td>
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
                    {post.queueType.name || "unassigned"}
                  </div>
                ) : (
                  <div
                    className={`inline-flex rounded-full border-2 px-3 py-1 text-xs leading-4 font-semibold ${(() => {
                      const colors = getQueueColor(
                        post.queueType?.name ?? "unassigned"
                      );
                      return colors
                        ? `${colors.bg} ${colors.text} ${colors.border}`
                        : "";
                    })()} shadow-sm`}
                  >
                    {post.queueType?.name ?? "unassigned"}
                  </div>
                )}
              </td>
              <td className="p-3 text-center">
                <div className="inline-flex rounded-full border border-transparent bg-orange-100 px-2 py-1 text-xs leading-4 font-semibold text-orange-900 dark:border-orange-900/75 dark:bg-orange-700/10 dark:text-orange-200">
                  Draft
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex justify-center gap-2">
                  <Link
                    to={`/dashboard/drafts/edit/${post.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                  >
                    Edit
                  </Link>
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
