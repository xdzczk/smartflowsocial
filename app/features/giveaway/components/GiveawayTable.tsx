import { Link, useRouteLoaderData } from "@remix-run/react";
import { MoreHorizontal, Quote, Share2 } from "lucide-react";
import { useMemo } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  getQueueColor,
  getQueueColorBundle,
} from "~/features/posts/queue-colors";
import { getImageUrls } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";

interface Post {
  id: string;
  caption?: string | null;
  publishedAt: Date | null;
  fileUrl: string[];
  signedEvent?: { id: string } | null;
  queueType?: {
    name: string;
    color?: string | null;
    colorToken?: string | null;
  } | null;
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
    className="bg-surface border-border text-text cursor-pointer border-b px-3 py-4 text-left font-semibold"
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
  const rootData = useRouteLoaderData("root") as
    | {
        user?: {
          preferredNostrClient?: string;
          customNostrClientBaseUrl?: string | null;
        } | null;
      }
    | undefined;
  const nostrUrls = useMemo(
    () => getNostrClientUrlsFromUser(rootData?.user),
    [rootData?.user]
  );

  return (
    <>
      {/* Results count */}
      <div className="text-text-secondary mb-2 text-sm">
        Showing {posts.length} posts with engagement
      </div>

      <div className="border-border bg-surface min-w-full overflow-x-auto rounded-xs border">
        <table className="min-w-full align-middle text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
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
              <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
                Likes
              </th>
              <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
                Replies
              </th>
              <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
                Mentions
              </th>
              <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
                Reposts
              </th>
              <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
                Zaps
              </th>
              <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
                Zapped
              </th>
              <SortableHeader
                sortKey="queueType"
                label="Queue"
                sortConfig={sortConfig}
                onRequestSort={onRequestSort}
              />
              <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className="border-border hover:bg-surface-hover cursor-pointer border-b"
                onClick={() => onPostClick(post)}
              >
                <td className="p-3">
                  {post.fileUrl.length > 0 ? (
                    <div className="relative">
                      <MediaThumbnail
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Post preview"
                        className="h-12 w-12 rounded-xs object-cover"
                        fallback={
                          <div className="bg-surface-hover text-text-secondary flex h-12 w-12 items-center justify-center rounded-xs text-xs font-medium">
                            TEXT
                          </div>
                        }
                      />
                      {post.repost ? (
                        <div className="bg-action-primary absolute -top-1 -right-1 rounded-full p-1">
                          <Share2
                            className={`${SMALL_ICON_SIZE_CLASS} text-brand-on`}
                            strokeWidth={INLINE_ICON_STROKE}
                            aria-hidden
                          />
                        </div>
                      ) : null}
                      {post.isQuotedPost ? (
                        <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
                          <Quote
                            className={`${SMALL_ICON_SIZE_CLASS} text-success-foreground`}
                            strokeWidth={INLINE_ICON_STROKE}
                            aria-hidden
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="dark:bg-surface-hover dark:text-text-secondary bg-surface-hover text-text flex h-12 w-12 items-center justify-center rounded-xs text-xs font-medium">
                        TEXT
                      </div>
                      {post.repost ? (
                        <div className="bg-action-primary absolute -top-1 -right-1 rounded-full p-1">
                          <Share2
                            className={`${SMALL_ICON_SIZE_CLASS} text-brand-on`}
                            strokeWidth={INLINE_ICON_STROKE}
                            aria-hidden
                          />
                        </div>
                      ) : null}
                      {post.isQuotedPost ? (
                        <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
                          <Quote
                            className={`${SMALL_ICON_SIZE_CLASS} text-success-foreground`}
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
                  {post.queueType?.colorToken ? (
                    (() => {
                      const bundle = getQueueColorBundle(
                        post.queueType.colorToken
                      );
                      return (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize"
                          style={{
                            backgroundColor: bundle.surface,
                            color: bundle.accent,
                          }}
                        >
                          {post.queueType.name}
                        </span>
                      );
                    })()
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${(() => {
                        const colors = getQueueColor(
                          post.queueType?.name ?? "unassigned",
                          post.queueType?.colorToken
                        );
                        return `${colors.bg} ${colors.text}`;
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
                        className="focus-ring border-border bg-surface text-text hover:bg-surface-hover inline-flex h-8 w-8 items-center justify-center rounded-lg border"
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
                          to={nostrUrls.eventUrl(post.signedEvent?.id ?? "")}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open on Nostr
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
