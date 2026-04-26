import { Link, useRouteLoaderData } from "@remix-run/react";
import type { useFetcher } from "@remix-run/react";
import { useMemo } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  getQueueColor,
  getQueueColorBundle,
  QUEUE_PILL_OPACITY_CLASS,
  QUEUE_PILL_SHAPE_CLASS,
} from "~/features/posts/queue-colors";
import { getPostRowThumbnailBadge } from "~/features/posts/utils/content-helpers";
import { getImageUrls } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";

interface Post {
  id: string;
  caption?: string | null;
  publishedAt: Date | null;
  fileUrl: string[];
  postType?: string;
  repost?: boolean;
  postKind?: string | null;
  signedEvent: { id: string; kind?: number };
  queueType?: {
    name: string;
    color?: string | null;
    colorToken?: string | null;
  } | null;
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
  /** Fetcher used for recycle (single or bulk). Submits _action=bulkRepost with postIds. */
  recycleFetcher: ReturnType<typeof useFetcher>;
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
  recycleFetcher,
}: RecyclablesTableProps) {
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
    <div className="border-border bg-surface min-w-full overflow-x-auto rounded-xs border">
      <table className="min-w-full align-middle text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
              <Checkbox
                id="recyclable-select-all"
                checked={
                  posts.length > 0 ? selectedPosts.size === posts.length : false
                }
                onCheckedChange={() => onToggleSelectAll()}
              />
            </th>
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
            <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const rowThumbBadge = getPostRowThumbnailBadge({
              contentKind: "post",
              postType: post.postType,
              signedEvent: post.signedEvent,
              repost: post.repost === true,
              postKind: post.postKind ?? null,
            });
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
                className="group border-border dark:hover:bg-surface-hover hover:bg-surface-hover cursor-pointer border-b"
                onClick={() => onPostClick(post)}
              >
                <td className="p-3 text-center">
                  <Checkbox
                    id={`recyclable-select-${post.id}`}
                    checked={selectedPosts.has(post.id)}
                    onCheckedChange={() => onToggleSelect(post.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="p-3">
                  {post.fileUrl.length > 0 ? (
                    <img
                      src={getImageUrls(post.fileUrl)[0]}
                      alt="Post preview"
                      className="h-12 w-12 rounded-xs object-cover"
                    />
                  ) : (
                    <div className="bg-surface-hover text-text-secondary flex h-12 w-12 items-center justify-center rounded-xs text-xs font-medium">
                      {rowThumbBadge}
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
                  {post.publishedAt ? formatDate(post.publishedAt) : "—"}
                </td>
                <td className="p-3">{postStats.likes}</td>
                <td className="p-3">{postStats.replies}</td>
                <td className="p-3">{postStats.mentions}</td>
                <td className="p-3">{postStats.reposts}</td>
                <td className="p-3">{postStats.zaps}</td>
                <td className="p-3">{postStats.satszapped}</td>
                <td className="p-3">
                  {post.queueType?.colorToken ? (
                    (() => {
                      const bundle = getQueueColorBundle(
                        post.queueType.colorToken
                      );
                      return (
                        <span
                          className={`${QUEUE_PILL_SHAPE_CLASS} ${QUEUE_PILL_OPACITY_CLASS}`}
                          style={{
                            backgroundColor: bundle.surface,
                            color: bundle.accent,
                            borderColor: bundle.accent,
                          }}
                        >
                          {post.queueType.name}
                        </span>
                      );
                    })()
                  ) : (
                    <span
                      className={`${QUEUE_PILL_SHAPE_CLASS} ${QUEUE_PILL_OPACITY_CLASS} ${(() => {
                        const colors = getQueueColor(
                          post.queueType?.name ?? "unassigned",
                          post.queueType?.colorToken
                        );
                        return `${colors.bg} ${colors.text} ${colors.border}`;
                      })()}`}
                    >
                      {post.queueType?.name ?? "unassigned"}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span className="bg-surface-hover text-text-secondary inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                    Recyclable
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      to={nostrUrls.eventUrl(post.signedEvent.id)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-montserrat bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 motion-base inline-block rounded-full px-4 py-1 text-sm"
                    >
                      Open on Nostr
                    </Link>
                    <recycleFetcher.Form
                      method="post"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="_action" value="bulkRepost" />
                      <input
                        type="hidden"
                        name="postIds"
                        value={JSON.stringify([post.id])}
                      />
                      <button
                        type="submit"
                        disabled={recycleFetcher.state !== "idle"}
                        className="focus-ring border-border bg-surface text-text hover:border-border hover:bg-surface-hover active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold active:shadow-none disabled:opacity-50"
                      >
                        {recycleFetcher.state !== "idle"
                          ? "Recycling..."
                          : "Recycle"}
                      </button>
                    </recycleFetcher.Form>
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
