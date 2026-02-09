import { Link } from "@remix-run/react";
import { MoreHorizontal, Quote, Share2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { getQueueColor } from "~/features/posts/queue-colors";
import { getImageUrls } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";

interface Post {
  id: string;
  caption?: string | null;
  publishedAt: Date | null;
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
  const { formatDate } = useFormattedDate();

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
                sortKey="publishedAt"
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
                        <div className="bg-primary absolute -top-1 -right-1 rounded-full p-1">
                          <Share2
                            className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                            strokeWidth={INLINE_ICON_STROKE}
                            aria-hidden
                          />
                        </div>
                      ) : null}
                      {post.isQuotedPost ? (
                        <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
                          <Quote
                            className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                            strokeWidth={INLINE_ICON_STROKE}
                            aria-hidden
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                        TEXT
                      </div>
                      {post.repost ? (
                        <div className="bg-primary absolute -top-1 -right-1 rounded-full p-1">
                          <Share2
                            className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                            strokeWidth={INLINE_ICON_STROKE}
                            aria-hidden
                          />
                        </div>
                      ) : null}
                      {post.isQuotedPost ? (
                        <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
                          <Quote
                            className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                            strokeWidth={INLINE_ICON_STROKE}
                            aria-hidden
                          />
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
                  {post.publishedAt ? formatDate(post.publishedAt) : "—"}
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="border-border bg-card text-foreground hover:bg-muted focus:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border focus:ring-2 focus:outline-none"
                        aria-label="Actions"
                      >
                        <MoreHorizontal className={INLINE_ICON_SIZE_CLASS} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem asChild>
                        <Link
                          to={`https://primal.net/e/${post.signedEvent?.id ?? ""}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Note
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
