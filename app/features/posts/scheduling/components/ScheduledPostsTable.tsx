/**
 * Scheduled posts table component
 */

import { useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal, Quote, Repeat } from "lucide-react";
import { useEffect, useRef, useState, type Key } from "react";

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
import { dashboardKeys } from "~/features/posts/hooks/useDashboardQuery";
import type { CombinedContent, PostData } from "~/features/posts/types";
import { getPostRowThumbnailBadge } from "~/features/posts/utils/content-helpers";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { formatForDisplay, fromDate } from "~/lib/temporal";
import { cn } from "~/lib/utils";

import { scheduledPostsKeys } from "../hooks/useScheduledPostsQuery";

interface ScheduledPostsTableProps {
  posts: PostData[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
  selectedPosts: Set<string>;
  onToggleSelection: (postId: string) => void;
  onToggleSelectAll: () => void;
  countdowns: Record<string, string>;
  userTimezone?: string | null;
  userTimeFormat?: "12h" | "24h" | null;
  onPostClick: (post: PostData) => void;
  onEditPost: (post: PostData) => void;
  onReschedulePost: (post: PostData) => void;
  onMediaClick: (src: string) => void;
  bulkDeleteState: string;
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
  /** When provided, mobile sort dropdown uses this to set key and direction explicitly */
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  /** Infinite scroll: when provided, mobile uses a dedicated scroll container */
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
  onScrollContainerReady?: (el: HTMLDivElement | null) => void;
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

export function ScheduledPostsTable({
  posts,
  sortConfig,
  onRequestSort,
  selectedPosts,
  onToggleSelection,
  onToggleSelectAll,
  countdowns,
  userTimezone,
  userTimeFormat,
  onPostClick,
  onEditPost,
  onReschedulePost,
  onMediaClick,
  bulkDeleteState,
  onScheduleRepost,
  onScheduleQuote,
  onSortChange,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
  onScrollContainerReady,
}: ScheduledPostsTableProps) {
  const { dateLocale } = useFormattedDate();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);
  const deleteFetcher = useFetcher<{ success?: boolean }>();
  const queryClient = useQueryClient();

  const combinedContent = posts.map((post) => postToCombinedContent(post));
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

  // Invalidate queries when individual delete succeeds
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      const data = deleteFetcher.data;
      if (typeof data === "object" && "success" in data && data.success) {
        // Invalidate both dashboard and scheduled posts queries
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        void queryClient.invalidateQueries({
          queryKey: scheduledPostsKeys.all,
        });
      }
    }
  }, [deleteFetcher.state, deleteFetcher.data, queryClient]);

  const timeFormat = userTimeFormat === "24h" ? "24h" : "12h";

  const formatDate = (scheduledAtUtc: Date | null) => {
    try {
      if (!scheduledAtUtc) return "-";
      const tz = userTimezone ?? "UTC";

      const zoned = fromDate(scheduledAtUtc, "UTC");
      const userZoned = zoned.withTimeZone(tz);

      return formatForDisplay(
        userZoned,
        tz,
        {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: timeFormat === "12h",
        },
        timeFormat,
        dateLocale
      );
    } catch {
      // Fallback - still use Temporal for consistency
      try {
        if (!scheduledAtUtc) return "-";
        const tz = userTimezone ?? "UTC";
        const zoned = fromDate(scheduledAtUtc, "UTC");
        const userZoned = zoned.withTimeZone(tz);
        return formatForDisplay(
          userZoned,
          tz,
          {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: timeFormat === "12h",
          },
          timeFormat,
          dateLocale
        );
      } catch {
        // Final fallback
        if (!scheduledAtUtc) return "-";
        const tz = userTimezone ?? "UTC";
        return scheduledAtUtc.toLocaleString(dateLocale, {
          timeZone: tz,
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: timeFormat === "12h",
        });
      }
    }
  };

  const getImageUrls = (fileUrl: string[] | null | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch (_e) {
        return [];
      }
    }

    return fileUrl;
  };

  return (
    <>
      {/* Desktop: table (hidden on mobile) */}
      <div className="hidden md:block">
        <div className={PUBLISHING_LIST_SURFACE_CLASS}>
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  <Checkbox
                    id="scheduled-select-all"
                    checked={
                      posts.length > 0
                        ? selectedPosts.size === posts.length
                        : false
                    }
                    onCheckedChange={() => onToggleSelectAll()}
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
                  sortKey="scheduledAtUtc"
                  label="Scheduled For"
                  sortConfig={sortConfig}
                  onRequestSort={onRequestSort}
                />
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  Time Remaining
                </th>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  Queue
                </th>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  Status
                </th>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
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
                        "bg-muted/40 hover:bg-muted/50"
                    )}
                    onClick={() => onPostClick(post)}
                  >
                    <td className="p-3 text-center">
                      <Checkbox
                        id={`scheduled-select-${post.id}`}
                        checked={selectedPosts.has(post.id)}
                        onCheckedChange={() => onToggleSelection(post.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-3">
                      <div className="relative">
                        {post.fileUrl.length > 0 ? (
                          <MediaThumbnail
                            src={getImageUrls(post.fileUrl)[0]}
                            alt="Post preview"
                            className="h-12 w-12 rounded object-cover"
                            onClick={() => {
                              const imageUrl = getImageUrls(post.fileUrl)[0];
                              if (imageUrl) {
                                onMediaClick(imageUrl);
                              }
                            }}
                            fallback={
                              <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                                {rowThumbBadge}
                              </div>
                            }
                          />
                        ) : post.repost ? (
                          <div className="bg-accent/15 text-accent-foreground flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded text-[10px] font-medium">
                            <Repeat
                              className={`${SMALL_ICON_SIZE_CLASS} shrink-0`}
                              strokeWidth={INLINE_ICON_STROKE}
                              aria-hidden
                            />
                            REPOST
                          </div>
                        ) : post.isQuotedPost ? (
                          <div className="bg-success/20 text-success dark:text-success flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                            QUOTE
                          </div>
                        ) : (
                          <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                            {rowThumbBadge}
                          </div>
                        )}
                        {post.repost ? (
                          <div className="bg-primary absolute -top-1 -right-1 rounded-full p-1">
                            <Repeat
                              className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                              strokeWidth={INLINE_ICON_STROKE}
                              aria-hidden
                            />
                          </div>
                        ) : null}
                        {post.isQuotedPost && post.fileUrl.length > 0 ? (
                          <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
                            <Quote
                              className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                              strokeWidth={INLINE_ICON_STROKE}
                              aria-hidden
                            />
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-medium">
                        {post.caption && post.caption.length > 21
                          ? post.caption.substring(0, 21) + "..."
                          : post.caption}
                      </p>
                    </td>
                    <td className={cn("p-3", PUBLISHING_DATETIME_CELL_CLASS)}>
                      {formatDate(post.scheduledAtUtc)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="text-primary text-sm font-medium">
                        {countdowns[post.id] ?? "—"}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center">
                        <QueueStatusChip
                          queueType={
                            post.queueType as CombinedContent["queueType"]
                          }
                        />
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-muted-foreground text-xs font-medium">
                        {post.signedEvent ? "Signed" : "Scheduled"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="border-border bg-card text-foreground hover:bg-muted focus:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border focus:ring-2 focus:outline-none"
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
                          <DropdownMenuItem onSelect={() => onEditPost(post)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => onReschedulePost(post)}
                          >
                            Reschedule
                          </DropdownMenuItem>
                          {onScheduleRepost && !blockRepostQuoteChain ? (
                            <DropdownMenuItem
                              onSelect={() => onScheduleRepost(post)}
                            >
                              Schedule repost
                            </DropdownMenuItem>
                          ) : null}
                          {onScheduleQuote && !blockRepostQuoteChain ? (
                            <DropdownMenuItem
                              onSelect={() => onScheduleQuote(post)}
                            >
                              Schedule quote
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={
                              deleteFetcher.state !== "idle" ||
                              bulkDeleteState !== "idle"
                            }
                            onSelect={() => {
                              const fd = new FormData();
                              fd.set("postId", post.id);
                              fd.set("_action", "moveToDraft");
                              fd.set("type", "post");
                              deleteFetcher.submit(fd, { method: "post" });
                            }}
                          >
                            {deleteFetcher.state !== "idle" &&
                            deleteFetcher.formData?.get("_action") ===
                              "moveToDraft" &&
                            /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- formData can be undefined during submit */
                            deleteFetcher.formData?.get("postId") === post.id
                              ? "Moving..."
                              : "Move to drafts"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={
                              deleteFetcher.state !== "idle" ||
                              bulkDeleteState !== "idle"
                            }
                            className="text-destructive focus:text-destructive"
                            onSelect={() => {
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

      {/* Mobile: virtualized card list */}
      {isMobile ? (
        <div className="block flex min-h-0 flex-1 flex-col md:hidden">
          {onSortChange ? (
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`text-muted-foreground text-sm ${MOBILE_FILTER_LABEL_CLASS}`}
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
                      key === "date" ? "scheduledAtUtc" : "caption",
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
                  <SelectItem value="date-asc">
                    Date (upcoming first)
                  </SelectItem>
                  <SelectItem value="date-desc">Date (past first)</SelectItem>
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
                            type="scheduled"
                            userTimezone={userTimezone ?? undefined}
                            userTimeFormat={userTimeFormat ?? undefined}
                            showBulkActions={true}
                            selectedItems={selectedPosts}
                            onToggleSelection={onToggleSelection}
                            onPostSelect={(content) =>
                              onPostClick(content.originalData as PostData)
                            }
                            onEditPost={(post) => onEditPost(post as PostData)}
                            onReschedulePost={(post) =>
                              onReschedulePost(post as PostData)
                            }
                            deleteFetcher={
                              deleteFetcher as Parameters<
                                typeof ContentListCard
                              >[0]["deleteFetcher"]
                            }
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
                      type="scheduled"
                      userTimezone={userTimezone ?? undefined}
                      userTimeFormat={userTimeFormat ?? undefined}
                      showBulkActions={true}
                      selectedItems={selectedPosts}
                      onToggleSelection={onToggleSelection}
                      onPostSelect={(content) =>
                        onPostClick(content.originalData as PostData)
                      }
                      onEditPost={(post) => onEditPost(post as PostData)}
                      onReschedulePost={(post) =>
                        onReschedulePost(post as PostData)
                      }
                      deleteFetcher={
                        deleteFetcher as Parameters<
                          typeof ContentListCard
                        >[0]["deleteFetcher"]
                      }
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
