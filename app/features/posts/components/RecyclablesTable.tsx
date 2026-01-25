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
    <div className="border-border bg-card min-w-full overflow-x-auto rounded border">
      <table className="min-w-full align-middle text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              <input
                id="recyclable-select-all"
                name="recyclable-select-all"
                type="checkbox"
                checked={
                  posts.length > 0 ? selectedPosts.size === posts.length : false
                }
                onChange={onToggleSelectAll}
                className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
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
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
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
                className="border-border dark:hover:bg-muted cursor-pointer border-b hover:bg-gray-50"
                onClick={() => onPostClick(post)}
              >
                <td className="p-3 text-center">
                  <input
                    id={`recyclable-select-${post.id}`}
                    name={`recyclable-select-${post.id}`}
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => onToggleSelect(post.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
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
                    <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
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
                  <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
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
                      className="font-montserrat bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-full px-4 py-1 text-sm transition-colors duration-200"
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
                        className="border-accent/30 bg-card text-accent-foreground hover:border-accent/50 hover:bg-accent/10 focus:ring-accent/25 active:border-accent/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
                        className="bg-card inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/30 px-2 py-1 text-sm leading-5 font-semibold text-green-600 hover:border-green-500/50 hover:bg-green-500/10 focus:ring focus:ring-green-500/25 active:border-green-500/30 active:shadow-none disabled:opacity-50 dark:text-green-400"
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
                        className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-destructive/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
