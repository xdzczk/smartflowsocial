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

// Helper to get post stats
function getPostStats(
  post: PostData,
  stats: Record<string, PostStats>
): PostStats {
  const eventId = post.nostrEventId ?? post.id;
  return (
    stats[eventId] ?? {
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    }
  );
}

interface SortableHeaderProps {
  sortKey: string;
  label: string;
  sortConfig: { key: string; direction: string };
  requestSort: (key: string) => void;
}

const SortableHeader = ({
  sortKey,
  label,
  sortConfig,
  requestSort,
}: SortableHeaderProps) => (
  <th
    className="bg-secondary/30 text-foreground cursor-pointer px-3 py-4 text-left font-semibold"
    onClick={() => requestSort(sortKey)}
  >
    {label}{" "}
    {sortConfig.key === sortKey
      ? sortConfig.direction === "asc"
        ? "↑"
        : "↓"
      : ""}
  </th>
);

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
    <div className="border-border bg-card min-w-full overflow-x-auto rounded border">
      <table className="min-w-full align-middle text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-center font-semibold">
              <input
                id="posted-select-all"
                name="posted-select-all"
                type="checkbox"
                checked={
                  filteredPosts.length > 0
                    ? selectedPosts.size === filteredPosts.length
                    : false
                }
                onChange={toggleSelectAll}
                className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
              />
            </th>
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-left font-semibold">
              Media
            </th>
            <SortableHeader
              label="Caption"
              sortKey="caption"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Posted At"
              sortKey="postedAt"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Likes"
              sortKey="likes"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Replies"
              sortKey="replies"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Mentions"
              sortKey="mentions"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Reposts"
              sortKey="reposts"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Zaps"
              sortKey="zaps"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Zapped"
              sortKey="satszapped"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Queue"
              sortKey="queueType"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <SortableHeader
              label="Status"
              sortKey="status"
              sortConfig={sortConfig}
              requestSort={requestSort}
            />
            <th className="bg-secondary/30 text-foreground px-3 py-4 text-center font-semibold">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {filteredPosts.map((post) => {
            const postStats = getPostStats(post, stats);
            return (
              <tr
                key={post.id}
                className="even:bg-secondary/20 hover:bg-accent/10 cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                <td className="p-3 text-center">
                  <input
                    id={`posted-select-${post.id}`}
                    name={`posted-select-${post.id}`}
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => togglePostSelection(post.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
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
                      <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
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
                            className="border-accent/30 bg-card text-accent-foreground hover:border-accent/50 hover:bg-accent/10 focus:ring-accent/25 active:border-accent/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
                            className="bg-card inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/30 px-2 py-1 text-sm leading-5 font-semibold text-green-600 hover:border-green-500/50 hover:bg-green-500/10 focus:ring focus:ring-green-500/25 active:border-green-500/30 active:shadow-none disabled:opacity-50 dark:text-green-400"
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
