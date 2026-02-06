import { useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { dashboardKeys } from "~/features/posts/hooks/useDashboardQuery";
import { scheduledPostsKeys } from "~/features/posts/hooks/useScheduledPostsQuery";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { fromISOString } from "~/lib/temporal";

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
  PostFetcher,
} from "../types";

import { CONTENT_MOBILE_BREAKPOINT_PX } from "./constants";
import { ContentBulkActions } from "./ContentBulkActions";
import { ContentListCard } from "./ContentListCard";
import { ContentSearchBar } from "./ContentSearchBar";
import { ContentTableHeader } from "./ContentTableHeader";
import { ContentTableRow } from "./ContentTableRow";

const CONTENT_LIST_CARD_HEIGHT_PX = 98;

interface AllContentListingProps {
  content: CombinedContent[];
  type: "scheduled" | "draft" | "posted";
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
  repostFetcher?: PostFetcher;
  // Single-post schedule repost/quote (no redirect to bulk)
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
  // Edit and reschedule actions for scheduled content
  onEditPost?: (post: PostData | LongFormPostData) => void;
  onReschedulePost?: (post: PostData | LongFormPostData) => void;
}

export default function AllContentListing({
  content,
  type,
  searchTerm,
  onSearchChange,
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
  repostFetcher,
  onScheduleRepost,
  onScheduleQuote,
  // Edit and reschedule actions
  onEditPost,
  onReschedulePost,
}: AllContentListingProps) {
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const deleteFetcher = useFetcher<{
    success?: boolean;
    error?: string;
    needsSigning?: boolean;
    post?: PostData | LongFormPostData;
  }>();
  const queryClient = useQueryClient();

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

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key:
      type === "posted"
        ? "postedAt"
        : type === "scheduled"
          ? "scheduledAtUtc"
          : "createdAt",
    // For scheduled posts, show earliest (upcoming) first (asc)
    // For posted posts, show newest first (desc)
    direction: type === "scheduled" ? "asc" : "desc",
  });

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
   * Get sort value for postedAt field
   */
  function getPostedAtSortValue(postedAt: Date | string | undefined): number {
    if (!postedAt) return 0;
    try {
      const isoString =
        postedAt instanceof Date ? postedAt.toISOString() : String(postedAt);
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
    if (sortKey === "postedAt") {
      return getPostedAtSortValue(item.postedAt);
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
    type === "posted"
      ? "postedAt"
      : type === "scheduled"
        ? "scheduledAtUtc"
        : "createdAt";

  // TanStack Virtual returns unstable refs by design; virtualization is intentional (plan: mobile card lists)

  const rowVirtualizer = useVirtualizer({
    count: filteredContent.length,
    getScrollElement: () =>
      typeof document !== "undefined" ? document.documentElement : null,
    estimateSize: () => CONTENT_LIST_CARD_HEIGHT_PX,
    overscan: 3,
    getItemKey: (index) => {
      const item = filteredContent[index];
      return item ? `${item.type}-${item.id}` : String(index);
    },
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

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
      <ContentSearchBar
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
      />

      {showBulkActions ? (
        <ContentBulkActions
          type={type}
          selectedCount={selectedItems.size}
          onBulkDelete={onBulkDelete ?? (() => {})}
          onBulkRepost={onBulkRepost}
          onBulkScheduledRepost={onBulkScheduledRepost}
          onBulkQuote={onBulkQuote}
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
        <div className="block md:hidden">
          {filteredContent.length > 0 ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-muted-foreground text-sm">Sort:</span>
                <Select
                  value={
                    sortConfig.key === "caption"
                      ? `caption-${sortConfig.direction}`
                      : `date-${sortConfig.direction}`
                  }
                  onValueChange={setMobileSort}
                >
                  <SelectTrigger className="w-[11rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">
                      Date (newest first)
                    </SelectItem>
                    <SelectItem value="date-asc">
                      Date (oldest first)
                    </SelectItem>
                    <SelectItem value="caption-asc">Title (A–Z)</SelectItem>
                    <SelectItem value="caption-desc">Title (Z–A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                      className="pb-0.5"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
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
                      />
                    </div>
                  );
                })}
              </div>
            </>
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
