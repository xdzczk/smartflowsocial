import { Link } from "@remix-run/react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { getQueueColor } from "~/features/posts/queue-colors";
import { formatDate, getImageUrls } from "~/lib/helpers";

interface Post {
  id: string;
  caption?: string | null;
  postedAt: Date | null;
  fileUrl: string[];
  signedEvent?: { id: string } | null;
  queueType?: { name: string; color?: string | null } | null;
  repost?: boolean;
  isQuotedPost?: boolean;
  totalEngagement: number;
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  [key: string]: unknown; // Allow additional fields
}

interface GiveawayTableProps {
  posts: Post[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
  onPostClick: (post: Post) => void;
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
 * Table component for displaying giveaway posts
 */
export function GiveawayTable({
  posts,
  sortConfig,
  onRequestSort,
  onPostClick,
}: GiveawayTableProps) {
  return (
    <>
      {/* Results count */}
      <div className="text-muted-foreground mb-2 text-sm">
        Showing {posts.length} posts with engagement
      </div>

      <div className="border-border bg-card min-w-full overflow-x-auto rounded border">
        <table className="min-w-full align-middle text-sm whitespace-nowrap">
          <thead>
            <tr>
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
                sortKey="totalEngagement"
                label="Total Engagement"
                sortConfig={sortConfig}
                onRequestSort={onRequestSort}
              />
              <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
                Likes
              </th>
              <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
                Replies
              </th>
              <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
                Mentions
              </th>
              <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
                Reposts
              </th>
              <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
                Zaps
              </th>
              <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
                Zapped
              </th>
              <SortableHeader
                sortKey="queueType"
                label="Queue"
                sortConfig={sortConfig}
                onRequestSort={onRequestSort}
              />
              <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className="border-border hover:bg-muted cursor-pointer border-b"
                onClick={() => onPostClick(post)}
              >
                <td className="p-3">
                  {post.fileUrl.length > 0 ? (
                    <div className="relative">
                      <MediaThumbnail
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Post preview"
                        className="h-12 w-12 rounded object-cover"
                        fallback={
                          <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                            TEXT
                          </div>
                        }
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
                      <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
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
                    {post.caption && post.caption.length > 10
                      ? post.caption.substring(0, 10) + "..."
                      : post.caption}
                  </p>
                </td>
                <td className="p-3">
                  {post.postedAt ? formatDate(post.postedAt) : "—"}
                </td>
                <td className="p-3 font-bold">{post.totalEngagement}</td>
                <td className="p-3">{post.stats?.likes ?? 0}</td>
                <td className="p-3">{post.stats?.replies ?? 0}</td>
                <td className="p-3">{post.stats?.mentions ?? 0}</td>
                <td className="p-3">{post.stats?.reposts ?? 0}</td>
                <td className="p-3">{post.stats?.zaps ?? 0}</td>
                <td className="p-3">{post.stats?.satszapped ?? 0}</td>
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
                  <Link
                    to={`https://primal.net/e/${post.signedEvent?.id ?? ""}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-montserrat inline-block rounded-full bg-black/50 px-6 py-2 text-white transition-colors duration-200 hover:bg-black/70"
                  >
                    View Note
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
