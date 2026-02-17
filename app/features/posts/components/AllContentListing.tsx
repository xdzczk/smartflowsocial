import { useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type Key } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { dashboardKeys } from "~/features/posts/hooks/useDashboardQuery";
import { draftsKeys } from "~/features/posts/hooks/useDraftsQuery";
import { scheduledPostsKeys } from "~/features/posts/hooks/useScheduledPostsQuery";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { fromISOString } from "~/lib/temporal";

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
  PostFetcher,
} from "../types";

import {
  CONTENT_LIST_CARD_GAP_PX,
  CONTENT_LIST_CARD_HEIGHT_PX,
  CONTENT_MOBILE_BREAKPOINT_PX,
  MOBILE_FILTER_LABEL_CLASS,
  MOBILE_FILTER_SELECT_TRIGGER_CLASS,
} from "./constants";
import { ContentBulkActions } from "./ContentBulkActions";
import { ContentListCard } from "./ContentListCard";
import { ContentTableHeader } from "./ContentTableHeader";
import { ContentTableRow } from "./ContentTableRow";

function getInitialContentSortConfig(
  type: "scheduled" | "draft" | "published"
): {
  key: string;
  direction: "asc" | "desc";
} {
  const key =
    type === "published"
      ? "publishedAt"
      : type === "scheduled"
        ? "scheduledAtUtc"
        : "createdAt";
  const direction = type === "scheduled" ? "asc" : "desc";
  return { key, direction };
}

function getContentScrollElement(
  useDedicatedScroll: boolean,
  scrollRef: { current: HTMLDivElement | null }
): Element | null {
  if (useDedicatedScroll && scrollRef.current) return scrollRef.current;
  return typeof document !== "undefined" ? document.documentElement : null;
}

interface AllContentListingProps {
  content: CombinedContent[];
  type: "scheduled" | "draft" | "published";
  searchTerm: string;
  onSearchChange: (term: string) => void;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onPostSelect?: (content: CombinedContent) => void;
  selectedItems?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleSelectAll?: () => void;
  showBulkActions?: boolean;
  onBulkDelete?: () => void;
  bulkDeleteState?: string;
  // Advanced actions for posted content
  individualRepostFetcher?: PostFetcher;
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  onBulkRepost?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  onBulkEditReschedule?: () => void;
  repostFetcher?: PostFetcher;
  // Single-post schedule repost/quote (no redirect to bulk)
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
  // Edit and reschedule actions for scheduled content
  onEditPost?: (post: PostData | LongFormPostData) => void;
  onReschedulePost?: (post: PostData | LongFormPostData) => void;
  // Infinite scroll: when provided, mobile uses a dedicated scroll container so virtualizer offset is correct
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
  onScrollContainerReady?: (el: HTMLDivElement | null) => void;
}

export default function AllContentListing({
  content,
  type,
  searchTerm,
  onSearchChange: _onSearchChange,
  userTimezone,
  userTimeFormat = "12h",
  onPostSelect,
  selectedItems = new Set(),
  onToggleSelection,
  onToggleSelectAll,
  showBulkActions = false,
  onBulkDelete,
  bulkDeleteState = "idle",
  // Advanced actions
  individualRepostFetcher,
  longformRepostFetcher,
  longformQuoteFetcher,
  onBulkRepost,
  onBulkScheduledRepost,
  onBulkQuote,
  onBulkEditReschedule,
  repostFetcher,
  onScheduleRepost,
  onScheduleQuote,
  // Edit and reschedule actions
  onEditPost,
  onReschedulePost,
  // Infinite scroll
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
  onScrollContainerReady,
}: AllContentListingProps) {
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);
  const deleteFetcher = useFetcher<{
    success?: boolean;
    moved?: boolean;
    error?: string;
    needsSigning?: boolean;
    post?: PostData | LongFormPostData;
  }>();
  const queryClient = useQueryClient();

  // Invalidate queries when individual delete or move-to-draft succeeds
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      const data = deleteFetcher.data;
      if (typeof data === "object" && "success" in data && data.success) {
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        void queryClient.invalidateQueries({
          queryKey: scheduledPostsKeys.all,
        });
        if (type === "draft" || ("moved" in data && data.moved)) {
          void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
        }
      }
    }
  }, [deleteFetcher.state, deleteFetcher.data, queryClient, type]);

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>(() => getInitialContentSortConfig(type));

  const requestSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  function getScheduledAtUtcSortValue(scheduledAtUtc: unknown): number {
    if (!scheduledAtUtc) return 0;
    try {
      const dateObj =
        scheduledAtUtc instanceof Date
          ? scheduledAtUtc
          : new Date(String(scheduledAtUtc));
      return isNaN(dateObj.getTime())
        ? 0
        : Number(fromISOString(dateObj.toISOString(), "UTC").epochMilliseconds);
    } catch {
      return 0;
    }
  }

  /**
   * Get sort value for publishedAt field
   */
  function getPostedAtSortValue(
    publishedAt: Date | string | undefined | null
  ): number {
    if (!publishedAt) return 0;
    try {
      const isoString =
        publishedAt instanceof Date
          ? publishedAt.toISOString()
          : String(publishedAt);
      return Number(fromISOString(isoString, "UTC").epochMilliseconds);
    } catch {
      return 0;
    }
  }

  /**
   * Get sort value for date fields (createdAt, updatedAt)
   */
  function getDateFieldSortValue(dateValue: Date | string): number {
    try {
      return Number(fromISOString(String(dateValue), "UTC").epochMilliseconds);
    } catch {
      return 0;
    }
  }

  /**
   * Get sort value for a content item based on sort key
   */
  function getSortValueForItem(
    item: CombinedContent,
    sortKey: string
  ): number | string {
    if (sortKey === "scheduledAtUtc" || sortKey === "scheduledFor") {
      return getScheduledAtUtcSortValue(item.scheduledAtUtc);
    }
    if (sortKey === "publishedAt") {
      return getPostedAtSortValue(item.publishedAt);
    }
    if (sortKey === "createdAt" || sortKey === "updatedAt") {
      return getDateFieldSortValue(item[sortKey]);
    }
    const keyValue = item[sortKey as keyof CombinedContent];
    return keyValue
      ? typeof keyValue === "string"
        ? keyValue
        : String(keyValue)
      : "";
  }

  const sortedContent = [...content].sort((a, b) => {
    const aValue = getSortValueForItem(a, sortConfig.key);
    const bValue = getSortValueForItem(b, sortConfig.key);

    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  const filteredContent = sortedContent.filter(
    (item) =>
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
      item.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
      item.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dateSortKey =
    type === "published"
      ? "publishedAt"
      : type === "scheduled"
        ? "scheduledAtUtc"
        : "createdAt";

  // TanStack Virtual returns unstable refs by design; virtualization is intentional (plan: mobile card lists)
  const rowVirtualizer = useVirtualizer({
    count: filteredContent.length,
    getScrollElement: () =>
      getContentScrollElement(useDedicatedScroll, mobileScrollContainerRef),
    estimateSize: () => CONTENT_LIST_CARD_HEIGHT_PX + CONTENT_LIST_CARD_GAP_PX,
    overscan: 3,
    getItemKey: (index) => {
      const item = filteredContent[index];
      return item ? `${item.type}-${item.id}` : String(index);
    },
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const [openMenuRowKey, setOpenMenuRowKey] = useState<Key | null>(null);

  const setMobileSort = (value: string) => {
    if (
      value === "date-asc" ||
      value === "date-desc" ||
      value === "caption-asc" ||
      value === "caption-desc"
    ) {
      const [key, dir] = value.split("-") as [string, "asc" | "desc"];
      setSortConfig({
        key: key === "date" ? dateSortKey : "caption",
        direction: dir,
      });
    }
  };

  return (
    <div>
      {showBulkActions ? (
        <ContentBulkActions
          type={type}
          selectedCount={selectedItems.size}
          onBulkDelete={onBulkDelete ?? (() => {})}
          onBulkRepost={onBulkRepost}
          onBulkScheduledRepost={onBulkScheduledRepost}
          onBulkQuote={onBulkQuote}
          onBulkEditReschedule={onBulkEditReschedule}
          bulkDeleteState={bulkDeleteState}
          repostFetcher={repostFetcher}
        />
      ) : null}

      {/* Desktop: Content Table (hidden on mobile) */}
      <div className="hidden md:block">
        <div className="border-border bg-card min-w-full overflow-x-auto rounded border">
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            <ContentTableHeader
              type={type}
              showBulkActions={showBulkActions}
              sortConfig={sortConfig}
              filteredContentLength={filteredContent.length}
              selectedItemsSize={selectedItems.size}
              onToggleSelectAll={onToggleSelectAll}
              onRequestSort={requestSort}
            />
            <tbody>
              {filteredContent.map((item) => (
                <ContentTableRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  type={type}
                  userTimezone={userTimezone}
                  userTimeFormat={userTimeFormat}
                  showBulkActions={showBulkActions}
                  selectedItems={selectedItems}
                  onToggleSelection={onToggleSelection}
                  onPostSelect={onPostSelect}
                  onEditPost={onEditPost}
                  onReschedulePost={onReschedulePost}
                  deleteFetcher={deleteFetcher as unknown as PostFetcher}
                  individualRepostFetcher={individualRepostFetcher}
                  longformRepostFetcher={longformRepostFetcher}
                  longformQuoteFetcher={longformQuoteFetcher}
                  onScheduleRepost={onScheduleRepost}
                  onScheduleQuote={onScheduleQuote}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: Sort + virtualized card list (visible only on mobile) */}
      {isMobile ? (
        <div className="block flex min-h-0 flex-1 flex-col md:hidden">
          <div className="mt-3 flex items-center gap-2">
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
              onValueChange={setMobileSort}
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
          {useDedicatedScroll ? (
            <div
              ref={(el) => {
                mobileScrollContainerRef.current = el;
                onScrollContainerReady?.(el ?? null);
              }}
              className="mt-2 min-h-0 flex-1 overflow-auto"
            >
              {filteredContent.length > 0 ? (
                <>
                  <div
                    style={{
                      height: rowVirtualizer.getTotalSize(),
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualItems.map((virtualRow) => {
                      const item = filteredContent[virtualRow.index];
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
                            type={type}
                            userTimezone={userTimezone}
                            userTimeFormat={userTimeFormat}
                            showBulkActions={showBulkActions}
                            selectedItems={selectedItems}
                            onToggleSelection={onToggleSelection}
                            onPostSelect={onPostSelect}
                            onEditPost={onEditPost}
                            onReschedulePost={onReschedulePost}
                            deleteFetcher={
                              deleteFetcher as unknown as PostFetcher
                            }
                            individualRepostFetcher={individualRepostFetcher}
                            longformRepostFetcher={longformRepostFetcher}
                            longformQuoteFetcher={longformQuoteFetcher}
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
          ) : filteredContent.length > 0 ? (
            <div
              className="mt-2"
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
                width: "100%",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const item = filteredContent[virtualRow.index];
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
                      type={type}
                      userTimezone={userTimezone}
                      userTimeFormat={userTimeFormat}
                      showBulkActions={showBulkActions}
                      selectedItems={selectedItems}
                      onToggleSelection={onToggleSelection}
                      onPostSelect={onPostSelect}
                      onEditPost={onEditPost}
                      onReschedulePost={onReschedulePost}
                      deleteFetcher={deleteFetcher as unknown as PostFetcher}
                      individualRepostFetcher={individualRepostFetcher}
                      longformRepostFetcher={longformRepostFetcher}
                      longformQuoteFetcher={longformQuoteFetcher}
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

      {filteredContent.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-muted-foreground">No content found.</p>
        </div>
      ) : null}
    </div>
  );
}
