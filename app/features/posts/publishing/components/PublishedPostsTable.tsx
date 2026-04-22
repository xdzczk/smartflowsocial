import { Link, useRouteLoaderData } from "@remix-run/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal, Quote, Repeat } from "lucide-react";
import { useMemo, useRef, useState, type Key } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { postToCombinedContent } from "~/features/posts/combined";
import {
  CONTENT_LIST_CARD_GAP_PX,
  CONTENT_MOBILE_BREAKPOINT_PX,
  MOBILE_FILTER_LABEL_CLASS,
  MOBILE_FILTER_SELECT_TRIGGER_CLASS,
} from "~/features/posts/components/constants";
import { ContentListCard } from "~/features/posts/components/ContentListCard";
import { QueueStatusChip } from "~/features/posts/components/publishing-suite";
import {
  PUBLISHING_DATETIME_CELL_CLASS,
  PUBLISHING_LIST_SURFACE_CLASS,
  PUBLISHING_TABLE_ROW_CLASS,
} from "~/features/posts/components/publishing-suite/constants";
import type { PostStats } from "~/features/posts/stats.server";
import type {
  CombinedContent,
  PostData,
  PostFetcher,
} from "~/features/posts/types";
import {
  formatDate,
  getPostRowThumbnailBadge,
} from "~/features/posts/utils/content-helpers";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import { getImageUrls } from "~/lib/helpers";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";
import { cn } from "~/lib/utils";

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
    className="bg-surface border-border text-text cursor-pointer border-b px-3 py-4 text-left font-semibold"
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

interface PublishedPostsTableProps {
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
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
  onScrollContainerReady?: (el: HTMLDivElement | null) => void;
  onBeforeDelete?: (postId: string) => void;
}

export default function PublishedPostsTable({
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
  userTimezone,
  userTimeFormat = "12h",
  onScheduleRepost,
  onScheduleQuote,
  onSortChange,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
  onScrollContainerReady,
  onBeforeDelete,
}: PublishedPostsTableProps) {
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);

  const combinedContent = filteredPosts.map((post) =>
    postToCombinedContent(post)
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is not memoization-safe by design
  const rowVirtualizer = useVirtualizer({
    count: combinedContent.length,
    getScrollElement: () =>
      useDedicatedScroll && mobileScrollContainerRef.current
        ? mobileScrollContainerRef.current
        : typeof document !== "undefined"
          ? document.documentElement
          : null,
    estimateSize: () => 98 + CONTENT_LIST_CARD_GAP_PX,
    overscan: 3,
    getItemKey: (index) => combinedContent[index]?.id ?? String(index),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const [openMenuRowKey, setOpenMenuRowKey] = useState<Key | null>(null);
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
      <div className="hidden md:block">
        <div className={PUBLISHING_LIST_SURFACE_CLASS}>
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
                  <Checkbox
                    id="published-select-all"
                    checked={
                      filteredPosts.length > 0
                        ? selectedPosts.size === filteredPosts.length
                        : false
                    }
                    onCheckedChange={() => toggleSelectAll()}
                  />
                </th>
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
                  Media
                </th>
                <SortableHeader
                  label="Caption"
                  sortKey="caption"
                  sortConfig={sortConfig}
                  requestSort={requestSort}
                />
                <SortableHeader
                  label="Published At"
                  sortKey="publishedAt"
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
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPosts.map((post) => {
                const postStats = getPostStats(post, stats);
                const blockRepostQuoteChain = isPureRepostSourcePost(post);
                const rowThumbBadge = getPostRowThumbnailBadge({
                  contentKind: "post",
                  postType: post.postType,
                  signedEvent: post.signedEvent ?? null,
                  repost: post.repost === true,
                  postKind: post.postKind,
                });
                return (
                  <tr
                    key={post.id}
                    className={cn(
                      PUBLISHING_TABLE_ROW_CLASS,
                      selectedPosts.has(post.id) &&
                        "bg-surface-hover/40 hover:bg-surface-hover/50"
                    )}
                    onClick={() => setSelectedPost(post)}
                  >
                    <td className="p-3 text-center">
                      <Checkbox
                        id={`published-select-${post.id}`}
                        checked={selectedPosts.has(post.id)}
                        onCheckedChange={() => togglePostSelection(post.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-3">
                      {post.fileUrl.length > 0 ? (
                        <div className="relative">
                          <MediaThumbnail
                            src={getImageUrls(post.fileUrl)[0]}
                            alt="Post preview"
                            className="h-12 w-12 rounded-xs object-cover"
                            fallback={
                              <div className="bg-surface-hover text-text-secondary flex h-12 w-12 items-center justify-center rounded-xs text-xs font-medium">
                                {rowThumbBadge}
                              </div>
                            }
                          />
                          {post.repost ? (
                            <div className="bg-brand absolute -top-1 -right-1 rounded-full p-1">
                              <Repeat
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
                          <div className="bg-surface-hover text-text-secondary flex h-12 w-12 items-center justify-center rounded-xs text-xs font-medium">
                            {rowThumbBadge}
                          </div>
                          {post.repost ? (
                            <div className="bg-brand absolute -top-1 -right-1 rounded-full p-1">
                              <Repeat
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
                        {post.caption && post.caption.length > 21
                          ? post.caption.substring(0, 21) + "..."
                          : (post.caption ?? "")}
                      </p>
                    </td>
                    <td className={cn("p-3", PUBLISHING_DATETIME_CELL_CLASS)}>
                      {post.publishedAt
                        ? formatDate(
                            post.publishedAt,
                            false,
                            userTimezone,
                            userTimeFormat
                          )
                        : "-"}
                    </td>
                    <td className="p-3">{postStats.likes}</td>
                    <td className="p-3">{postStats.replies}</td>
                    <td className="p-3">{postStats.mentions}</td>
                    <td className="p-3">{postStats.reposts}</td>
                    <td className="p-3">{postStats.zaps}</td>
                    <td className="p-3">{postStats.satszapped}</td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        <QueueStatusChip
                          queueType={
                            post.queueType as CombinedContent["queueType"]
                          }
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-success text-xs font-medium">
                        Published
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="border-border bg-surface text-text hover:bg-surface-hover focus-visible:ring-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
                            aria-label="Actions"
                          >
                            <MoreHorizontal
                              className={INLINE_ICON_SIZE_CLASS}
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem asChild>
                            <Link
                              to={nostrUrls.eventUrl(
                                post.signedEvent &&
                                  typeof post.signedEvent === "object" &&
                                  "id" in post.signedEvent &&
                                  typeof post.signedEvent.id === "string"
                                  ? post.signedEvent.id
                                  : ""
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open on Nostr
                            </Link>
                          </DropdownMenuItem>
                          {!blockRepostQuoteChain ? (
                            <>
                              {(() => {
                                const fetcher = individualRepostFetcher;
                                const formData = getFetcherFormData(fetcher);
                                return (
                                  <fetcher.Form method="post">
                                    <input
                                      type="hidden"
                                      name="postId"
                                      value={post.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="_action"
                                      value="repost"
                                    />
                                    <DropdownMenuItem asChild>
                                      <button
                                        type="submit"
                                        disabled={
                                          fetcher.state !== "idle" ||
                                          (formData
                                            ? (formData.get("postId") as
                                                | string
                                                | null) === post.id
                                            : false)
                                        }
                                      >
                                        {fetcher.state !== "idle" &&
                                        (formData
                                          ? (formData.get("postId") as
                                              | string
                                              | null) === post.id
                                          : false)
                                          ? "Reposting..."
                                          : "Repost"}
                                      </button>
                                    </DropdownMenuItem>
                                  </fetcher.Form>
                                );
                              })()}
                              {(() => {
                                const fetcher = individualRepostFetcher;
                                const formData = getFetcherFormData(fetcher);
                                return (
                                  <fetcher.Form method="post">
                                    <input
                                      type="hidden"
                                      name="postId"
                                      value={post.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="_action"
                                      value="quote"
                                    />
                                    <DropdownMenuItem asChild>
                                      <button
                                        type="submit"
                                        disabled={
                                          fetcher.state !== "idle" ||
                                          (formData
                                            ? (formData.get("postId") as
                                                | string
                                                | null) === post.id
                                            : false)
                                        }
                                      >
                                        {fetcher.state !== "idle" &&
                                        (formData
                                          ? (formData.get("postId") as
                                              | string
                                              | null) === post.id
                                          : false)
                                          ? "Quoting..."
                                          : "Quote Post"}
                                      </button>
                                    </DropdownMenuItem>
                                  </fetcher.Form>
                                );
                              })()}
                              {onScheduleRepost ? (
                                <DropdownMenuItem
                                  onSelect={() => onScheduleRepost(post)}
                                >
                                  Schedule repost
                                </DropdownMenuItem>
                              ) : null}
                              {onScheduleQuote ? (
                                <DropdownMenuItem
                                  onSelect={() => onScheduleQuote(post)}
                                >
                                  Schedule quote
                                </DropdownMenuItem>
                              ) : null}
                            </>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={
                              deleteFetcher.state !== "idle" ||
                              bulkDeleteFetcher.state !== "idle"
                            }
                            className="text-danger focus:text-danger"
                            onSelect={() => {
                              onBeforeDelete?.(post.id);
                              const fd = new FormData();
                              fd.set("postId", post.id);
                              fd.set("_action", "delete");
                              deleteFetcher.submit(fd, { method: "post" });
                            }}
                          >
                            {deleteFetcher.state !== "idle" &&
                            deleteFetcher.formData?.get("postId") === post.id
                              ? "Deleting..."
                              : "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isMobile ? (
        <div className="block flex min-h-0 flex-1 flex-col md:hidden">
          {onSortChange ? (
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`text-text-secondary text-sm ${MOBILE_FILTER_LABEL_CLASS}`}
              >
                Sort:
              </span>
              <Select
                value={
                  sortConfig.key === "caption"
                    ? `caption-${sortConfig.direction}`
                    : `date-${sortConfig.direction}`
                }
                onValueChange={(value) => {
                  if (
                    value === "date-asc" ||
                    value === "date-desc" ||
                    value === "caption-asc" ||
                    value === "caption-desc"
                  ) {
                    const [key, dir] = value.split("-") as [
                      string,
                      "asc" | "desc",
                    ];
                    onSortChange(
                      key === "date" ? "publishedAt" : "caption",
                      dir
                    );
                  }
                }}
              >
                <SelectTrigger
                  className={`w-[11rem] ${MOBILE_FILTER_SELECT_TRIGGER_CLASS}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (newest first)</SelectItem>
                  <SelectItem value="date-asc">Date (oldest first)</SelectItem>
                  <SelectItem value="caption-asc">Title (A–Z)</SelectItem>
                  <SelectItem value="caption-desc">Title (Z–A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {useDedicatedScroll ? (
            <div
              ref={(el) => {
                mobileScrollContainerRef.current = el;
                onScrollContainerReady?.(el ?? null);
              }}
              className="min-h-0 flex-1 overflow-auto"
            >
              {combinedContent.length > 0 ? (
                <>
                  <div
                    style={{
                      height: rowVirtualizer.getTotalSize(),
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualItems.map((virtualRow) => {
                      const item = combinedContent[virtualRow.index];
                      if (!item) return null;
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          className="pb-2"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start}px)`,
                            zIndex:
                              openMenuRowKey === virtualRow.key
                                ? 50
                                : undefined,
                          }}
                        >
                          <ContentListCard
                            item={item}
                            type="published"
                            userTimezone={userTimezone}
                            userTimeFormat={userTimeFormat}
                            showBulkActions={true}
                            selectedItems={selectedPosts}
                            onToggleSelection={togglePostSelection}
                            onPostSelect={(content) =>
                              setSelectedPost(content.originalData as PostData)
                            }
                            deleteFetcher={deleteFetcher}
                            individualRepostFetcher={individualRepostFetcher}
                            onScheduleRepost={onScheduleRepost}
                            onScheduleQuote={onScheduleQuote}
                            onBeforeDelete={onBeforeDelete}
                            onMenuOpenChange={(open) =>
                              setOpenMenuRowKey(open ? virtualRow.key : null)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  {prefetchSentinelRef ? (
                    <div ref={prefetchSentinelRef} className="h-4 w-full" />
                  ) : null}
                  {sentinelRef ? (
                    <div ref={sentinelRef} className="h-4 w-full" />
                  ) : null}
                  {isFetchingNextPage ? (
                    <div className="text-text-secondary py-4 text-center text-sm">
                      Loading more...
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : combinedContent.length > 0 ? (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
                width: "100%",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const item = combinedContent[virtualRow.index];
                if (!item) return null;
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    className="pb-2"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      zIndex:
                        openMenuRowKey === virtualRow.key ? 50 : undefined,
                    }}
                  >
                    <ContentListCard
                      item={item}
                      type="published"
                      userTimezone={userTimezone}
                      userTimeFormat={userTimeFormat}
                      showBulkActions={true}
                      selectedItems={selectedPosts}
                      onToggleSelection={togglePostSelection}
                      onPostSelect={(content) =>
                        setSelectedPost(content.originalData as PostData)
                      }
                      deleteFetcher={deleteFetcher}
                      individualRepostFetcher={individualRepostFetcher}
                      onScheduleRepost={onScheduleRepost}
                      onScheduleQuote={onScheduleQuote}
                      onBeforeDelete={onBeforeDelete}
                      onMenuOpenChange={(open) =>
                        setOpenMenuRowKey(open ? virtualRow.key : null)
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
