import { useFetcher, type FetcherWithComponents } from "@remix-run/react";
import { useState } from "react";
import type { CombinedContent, PostData, LongFormPostData, PostFetcher } from "~/features/posts/types";
import { ContentSearchBar } from "~/features/posts/components/ContentSearchBar";
import { ContentBulkActions } from "~/features/posts/components/ContentBulkActions";
import { ContentTableHeader } from "~/features/posts/components/ContentTableHeader";
import { ContentTableRow } from "~/features/posts/components/ContentTableRow";

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
  const deleteFetcher = useFetcher();
  const [sortConfig, setSortConfig] = useState({
    key:
      type === "posted"
        ? "postedAt"
        : type === "scheduled"
          ? "scheduledFor"
          : "createdAt",
    direction: "desc" as "asc" | "desc",
  });

  const requestSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedContent = [...content].sort((a, b) => {
    let aValue, bValue;

    if (sortConfig.key === "scheduledFor") {
      aValue = a.scheduledFor ? parseInt(a.scheduledFor) * 1000 : 0;
      bValue = b.scheduledFor ? parseInt(b.scheduledFor) * 1000 : 0;
    } else if (sortConfig.key === "postedAt") {
      aValue = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      bValue = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    } else if (
      sortConfig.key === "createdAt" ||
      sortConfig.key === "updatedAt"
    ) {
      aValue = new Date(a[sortConfig.key]).getTime();
      bValue = new Date(b[sortConfig.key]).getTime();
    } else {
      aValue = a[sortConfig.key] || "";
      bValue = b[sortConfig.key] || "";
    }

    if (sortConfig.direction === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const filteredContent = sortedContent.filter(
    (item) =>
      item.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary?.toLowerCase().includes(searchTerm.toLowerCase()),
  );


  return (
    <div>
      <ContentSearchBar searchTerm={searchTerm} onSearchChange={onSearchChange} />

      {showBulkActions ? (
        <ContentBulkActions
          type={type}
          selectedCount={selectedItems.size}
          onBulkDelete={onBulkDelete}
          onBulkRepost={onBulkRepost}
          onBulkScheduledRepost={onBulkScheduledRepost}
          onBulkQuote={onBulkQuote}
          bulkDeleteState={bulkDeleteState}
          repostFetcher={repostFetcher}
        />
      ) : null}

      {/* Content Table */}
      <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full whitespace-nowrap align-middle text-sm">
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
                deleteFetcher={deleteFetcher}
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
