import { Link } from "@remix-run/react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { formatDate, getImageUrls } from "~/lib/helpers";

import { getQueueColor } from "../queue-colors";
import type { PostStats } from "../stats.server";
import type { PostData, PostFetcher } from "../types";
// Helper to safely access formData from a fetcher
function getFetcherFormData(
  fetcher: PostFetcher | undefined
): FormData | null | undefined {
  return fetcher
    ? (fetcher as { formData?: FormData | null }).formData
    : undefined;
}

interface PostedPostsTableProps {
  filteredPosts: PostData[];
  selectedPosts: Set<string>;
  stats: Record<string, PostStats>;
  sortConfig: { key: string; direction: string };
  toggleSelectAll: () => void;
  togglePostSelection: (postId: string) => void;
  requestSort: (key: string) => void;
  setSelectedPost: (post: PostData) => void;
  individualRepostFetcher: PostFetcher;
  deleteFetcher: PostFetcher;
  bulkDeleteFetcher: PostFetcher;
}

export default function PostedPostsTable({
  filteredPosts,
  selectedPosts,
  stats,
  sortConfig,
  toggleSelectAll,
  togglePostSelection,
  requestSort,
  setSelectedPost,
  individualRepostFetcher,
  deleteFetcher,
  bulkDeleteFetcher,
}: PostedPostsTableProps) {
  return (
    <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="min-w-full align-middle text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              <input
                type="checkbox"
                checked={
                  filteredPosts.length > 0
                    ? selectedPosts.size === filteredPosts.length
                    : false
                }
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
            </th>
            <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              Media
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("caption")}
            >
              Caption{" "}
              {sortConfig.key === "caption"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("postedAt")}
            >
              Posted At{" "}
              {sortConfig.key === "postedAt"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("likes")}
            >
              Likes{" "}
              {sortConfig.key === "likes"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("replies")}
            >
              Replies{" "}
              {sortConfig.key === "replies"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("mentions")}
            >
              Mentions{" "}
              {sortConfig.key === "mentions"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("reposts")}
            >
              Reposts{" "}
              {sortConfig.key === "reposts"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("zaps")}
            >
              Zaps{" "}
              {sortConfig.key === "zaps"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("satszapped")}
            >
              Zapped{" "}
              {sortConfig.key === "satszapped"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("queueType")}
            >
              Queue{" "}
              {sortConfig.key === "queueType"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th
              className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
              onClick={() => requestSort("status")}
            >
              Status{" "}
              {sortConfig.key === "status"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {filteredPosts.map((post) => {
            const postStats = (post.signedEvent &&
            typeof post.signedEvent === "object" &&
            "id" in post.signedEvent &&
            typeof post.signedEvent.id === "string"
              ? stats[post.signedEvent.id]
              : null) ?? {
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
                onClick={() => setSelectedPost(post)}
              >
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => togglePostSelection(post.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </td>
                <td className="p-3">
                  {post.fileUrl.length > 0 ? (
                    <div className="relative">
                      <MediaThumbnail
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Post preview"
                        className="h-12 w-12 rounded object-cover"
                      />
                      {post.repost ? (
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
                      {post.isQuotedPost ? (
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
                  ) : (
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        TEXT
                      </div>
                      {post.repost ? (
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
                      {post.isQuotedPost ? (
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
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium">
                    {post.caption && post.caption.length > 21
                      ? post.caption.substring(0, 21) + "..."
                      : (post.caption ?? "")}
                  </p>
                </td>
                <td className="p-3">
                  {post.postedAt ? formatDate(post.postedAt) : "-"}
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
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                    Posted
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      to={`https://primal.net/e/${post.signedEvent && typeof post.signedEvent === "object" && "id" in post.signedEvent && typeof post.signedEvent.id === "string" ? post.signedEvent.id : ""}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
                    >
                      View Note
                    </Link>
                    {(() => {
                      const fetcher = individualRepostFetcher;
                      const formData = getFetcherFormData(fetcher);
                      return (
                        <fetcher.Form
                          method="post"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input type="hidden" name="postId" value={post.id} />
                          <input type="hidden" name="_action" value="repost" />
                          <button
                            type="submit"
                            disabled={
                              fetcher.state !== "idle" ||
                              (formData
                                ? (formData.get("postId") as string | null) ===
                                  post.id
                                : false)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                          >
                            {fetcher.state !== "idle" &&
                            (formData
                              ? (formData.get("postId") as string | null) ===
                                post.id
                              : false)
                              ? "Reposting..."
                              : "Repost"}
                          </button>
                        </fetcher.Form>
                      );
                    })()}
                    {(() => {
                      const fetcher = individualRepostFetcher;
                      const formData = getFetcherFormData(fetcher);
                      return (
                        <fetcher.Form
                          method="post"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input type="hidden" name="postId" value={post.id} />
                          <input type="hidden" name="_action" value="quote" />
                          <button
                            type="submit"
                            disabled={
                              fetcher.state !== "idle" ||
                              (formData
                                ? (formData.get("postId") as string | null) ===
                                  post.id
                                : false)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                          >
                            {fetcher.state !== "idle" &&
                            (formData
                              ? (formData.get("postId") as string | null) ===
                                post.id
                              : false)
                              ? "Quoting..."
                              : "Quote Post"}
                          </button>
                        </fetcher.Form>
                      );
                    })()}
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
                        {deleteFetcher.state !== "idle" &&
                        deleteFetcher.formData?.get("postId") === post.id
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
