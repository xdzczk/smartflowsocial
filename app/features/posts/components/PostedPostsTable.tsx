import { Link } from "@remix-run/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState, type Key } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getImageUrls } from "~/lib/helpers";
import { useIsMobile } from "~/lib/hooks/useIsMobile";

import { postToCombinedContent } from "../combined";
import { getQueueColor } from "../queue-colors";
import type { PostStats } from "../stats.server";
import type { PostData, PostFetcher } from "../types";
import { formatDate } from "../utils/content-helpers";

import { CONTENT_MOBILE_BREAKPOINT_PX } from "./constants";
import { ContentListCard } from "./ContentListCard";

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
    className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left font-semibold"
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
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
  onScrollContainerReady?: (el: HTMLDivElement | null) => void;
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
  userTimezone,
  userTimeFormat = "12h",
  onScheduleRepost,
  onScheduleQuote,
  onSortChange,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
  onScrollContainerReady,
}: PostedPostsTableProps) {
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
    estimateSize: () => 98,
    overscan: 3,
    getItemKey: (index) => combinedContent[index]?.id ?? String(index),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const [openMenuRowKey, setOpenMenuRowKey] = useState<Key | null>(null);

  return (
    <>
      <div className="hidden md:block">
        <div className="border-border bg-card min-w-full overflow-x-auto rounded border">
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
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
                    className="border-border accent-checkbox focus:ring-ring h-4 w-4 rounded"
                  />
                </th>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
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
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
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
                    className="border-border dark:hover:bg-muted hover:bg-muted cursor-pointer border-b"
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
                        className="border-border accent-checkbox focus:ring-ring h-4 w-4 rounded"
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
                            <div className="bg-primary absolute -top-1 -right-1 rounded-full p-1">
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
                            <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
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
                            <div className="bg-primary absolute -top-1 -right-1 rounded-full p-1">
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
                            <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
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
                      {post.postedAt
                        ? formatDate(
                            post.postedAt,
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
                      <span className="bg-success/20 text-success dark:bg-success/20 dark:text-success inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
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
                          className="font-montserrat bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-full px-4 py-1 text-sm transition-colors duration-200"
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
                                className="border-border bg-card text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
                                className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-ring/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
                            </fetcher.Form>
                          );
                        })()}
                        {onScheduleRepost ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onScheduleRepost(post);
                            }}
                            className="border-border bg-card text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
                          >
                            Schedule repost
                          </button>
                        ) : null}
                        {onScheduleQuote ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onScheduleQuote(post);
                            }}
                            className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-ring/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
                          >
                            Schedule quote
                          </button>
                        ) : null}
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
                            className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-ring/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
      </div>

      {isMobile ? (
        <div className="block md:hidden">
          {onSortChange ? (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Sort:</span>
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
                    onSortChange(key === "date" ? "postedAt" : "caption", dir);
                  }
                }}
              >
                <SelectTrigger className="w-[11rem]">
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
              className="overflow-auto"
              style={{ height: "calc(100vh - 14rem)" }}
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
                          className="pb-0.5"
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
                            type="posted"
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
                    <div className="text-muted-foreground py-4 text-center text-sm">
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
                    className="pb-0.5"
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
                      type="posted"
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
