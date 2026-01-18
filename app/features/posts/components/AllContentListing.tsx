import { useFetcher } from "@remix-run/react";
import { useState } from "react";

import { fromISOString } from "~/lib/temporal";

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
  PostFetcher,
} from "../types";

import { ContentBulkActions } from "./ContentBulkActions";
import { ContentSearchBar } from "./ContentSearchBar";
import { ContentTableHeader } from "./ContentTableHeader";
import { ContentTableRow } from "./ContentTableRow";

interface AllContentListingProps {
  content: CombinedContent[];
  type: "scheduled" | "draft" | "posted";
  searchTerm: string;
  onSearchChange: (term: string) => void;
  userTimezone?: string;
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
  // Edit and reschedule actions
  onEditPost,
  onReschedulePost,
}: AllContentListingProps) {
  const deleteFetcher = useFetcher<{
    success?: boolean;
    error?: string;
    needsSigning?: boolean;
    post?: PostData | LongFormPostData;
  }>();
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
    direction: "desc",
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

      {/* Content Table */}
      <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
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
              />
            ))}
          </tbody>
        </table>
      </div>

      {filteredContent.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No content found.</p>
        </div>
      ) : null}
    </div>
  );
}
