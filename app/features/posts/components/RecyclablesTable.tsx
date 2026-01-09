import { Link } from "@remix-run/react";
import type { useFetcher } from "@remix-run/react";

import { formatDate, getImageUrls } from "~/lib/helpers";

import { getQueueColor } from "../queue-colors";

interface Post {
  id: string;
  caption?: string | null;
  postedAt: Date | null;
  fileUrl: string[];
  signedEvent: { id: string };
  queueType?: { name: string; color?: string | null } | null;
  status?: string;
}

type Stats = Record<
  string,
  {
    likes?: number;
    replies?: number;
    mentions?: number;
    reposts?: number;
    zaps?: number;
    satszapped?: number;
  }
>;

interface RecyclablesTableProps {
  posts: Post[];
  stats: Stats;
  sortConfig: { key: string; direction: "asc" | "desc" };
  selectedPosts: Set<string>;
  onRequestSort: (key: string) => void;
  onPostClick: (post: Post) => void;
  onToggleSelect: (postId: string) => void;
  onToggleSelectAll: () => void;
  deleteFetcher: ReturnType<typeof useFetcher>;
  individualRepostFetcher: ReturnType<typeof useFetcher>;
  bulkDeleteFetcher: ReturnType<typeof useFetcher>;
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

/**
 * Table component for displaying recyclables posts
 */
export function RecyclablesTable({
  posts,
  stats,
  sortConfig,
  selectedPosts,
  onRequestSort,
  onPostClick,
  onToggleSelect,
  onToggleSelectAll,
  deleteFetcher,
  individualRepostFetcher,
  bulkDeleteFetcher,
}: RecyclablesTableProps) {
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
              sortKey="postedAt"
              label="Posted At"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="likes"
              label="Likes"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="replies"
              label="Replies"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="mentions"
              label="Mentions"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="reposts"
              label="Reposts"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="zaps"
              label="Zaps"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="satszapped"
              label="Zapped"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="queueType"
              label="Queue"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="status"
              label="Status"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const postStats = stats[post.signedEvent.id] ?? {
              likes: 0,
              replies: 0,
              mentions: 0,
              reposts: 0,
              zaps: 0,
              satszapped: 0,
            };
            return (
              <tr
                key={post.id}
                className="cursor-pointer even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
                onClick={() => onPostClick(post)}
              >
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => onToggleSelect(post.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </td>
                <td className="p-3">
                  {post.fileUrl.length > 0 ? (
                    <img
                      src={getImageUrls(post.fileUrl)[0]}
                      alt="Post preview"
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      TEXT
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium">
                    {post.caption && post.caption.length > 21
                      ? post.caption.substring(0, 21) + "..."
                      : post.caption}
                  </p>
                </td>
                <td className="p-3">
                  {post.postedAt ? formatDate(post.postedAt) : "—"}
                </td>
                <td className="p-3">{postStats.likes}</td>
                <td className="p-3">{postStats.replies}</td>
                <td className="p-3">{postStats.mentions}</td>
                <td className="p-3">{postStats.reposts}</td>
                <td className="p-3">{postStats.zaps}</td>
                <td className="p-3">{postStats.satszapped}</td>
                <td className="p-3">
                  {post.queueType?.color ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize"
                      style={{
                        backgroundColor: `${post.queueType.color}20`,
                        color: post.queueType.color,
                      }}
                    >
                      {post.queueType.name}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${(() => {
                        const colors = getQueueColor(
                          post.queueType?.name ?? "unassigned"
                        );
                        return colors ? `${colors.bg} ${colors.text}` : "";
                      })()}`}
                    >
                      {post.queueType?.name ?? "unassigned"}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Recyclable
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      to={`https://primal.net/e/${post.signedEvent.id}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
                    >
                      View Note
                    </Link>
                    <individualRepostFetcher.Form
                      method="post"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="_action" value="repost" />
                      <button
                        type="submit"
                        disabled={individualRepostFetcher.state !== "idle"}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                      >
                        {individualRepostFetcher.state !== "idle"
                          ? "Reposting..."
                          : "Repost"}
                      </button>
                    </individualRepostFetcher.Form>
                    <individualRepostFetcher.Form
                      method="post"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="_action" value="quote" />
                      <button
                        type="submit"
                        disabled={individualRepostFetcher.state !== "idle"}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                      >
                        {individualRepostFetcher.state !== "idle"
                          ? "Quoting..."
                          : "Quote Post"}
                      </button>
                    </individualRepostFetcher.Form>
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
                          bulkDeleteFetcher.state !== "idle"
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
                      >
                        {deleteFetcher.state !== "idle"
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </deleteFetcher.Form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
