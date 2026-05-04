import { Link, useFetcher, useNavigate } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Key,
} from "react";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { TooltipProvider } from "~/components/ui/tooltip";
import {
  PUBLISHING_LIST_SURFACE_CLASS,
  PublishingEmptyState,
} from "~/features/posts/components/publishing-suite";
import { getShortDraftEditRedirectPath } from "~/features/posts/drafts/utils/draft-editor-navigation";
import { dashboardKeys } from "~/features/posts/hooks/useDashboardQuery";
import { draftsKeys } from "~/features/posts/hooks/useDraftsQuery";
import { invalidateDependentCaches } from "~/features/posts/hooks/useRefreshPostViews";
import { pruneScheduledQueryData } from "~/features/posts/scheduling/hooks/useScheduledPostsCache";
import { scheduledPostsKeys } from "~/features/posts/scheduling/hooks/useScheduledPostsQuery";
import { attachedCombinedByParentId } from "~/features/posts/utils/attached-follow-up-rows";
import { buildActionUrl } from "~/features/posts/utils/remix-action-url";
import {
  buildThreadListRows,
  threadListRowMatchesSearch,
  type ThreadListRow,
} from "~/features/posts/utils/thread-list-grouping";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { skipInfiniteQueries } from "~/lib/query/is-infinite-query-data";
import { fromISOString } from "~/lib/temporal";

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
  PostFetcher,
  QueueType,
} from "../types";

import {
  getContentListDateSortKey,
  getInitialContentSortConfig,
} from "./all-content-listing-sort";
import {
  combinedContentMatchesSearch,
  getContentScrollElement,
} from "./all-content-listing-utils";
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
import { DraftsHybridTableHeader } from "./DraftsHybridTableHeader";
import { DraftsHybridTableRow } from "./DraftsHybridTableRow";
import { MixedDraftsBulkActions } from "./MixedDraftsBulkActions";

interface AllContentListingProps {
  content: CombinedContent[];
  type: "scheduled" | "draft" | "published";
  searchTerm: string;
  onSearchChange: (term: string) => void;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onPostSelect?: (content: CombinedContent) => void;
  /** When set (drafts page), row opens composer instead of modal */
  onResumeDraft?: (content: CombinedContent) => void;
  selectedItems?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleSelectAll?: () => void;
  showBulkActions?: boolean;
  /** Clears row selection (batch bar Clear control). Required when `showBulkActions` is true. */
  onClearSelection?: () => void;
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
  /** Drafts All tab: queue types for mixed bulk assign */
  queueTypes?: QueueType[];
  /** Drafts: clear tab/queue filters (e.g. navigate to defaults) */
  onResetDraftFilters?: () => void;
  /** Scheduled / Published "all" tab: clear search, date, queue filters */
  onResetListFilters?: () => void;
  /** Called synchronously before a delete is submitted so the parent can do optimistic cache removal */
  onBeforeDelete?: (postId: string) => void;
}

/* eslint-disable sonarjs/cognitive-complexity -- table vs hybrid draft rows, virtualized mobile list, bulk bars, empty states */
export default function AllContentListing({
  content,
  type,
  searchTerm,
  onSearchChange,
  userTimezone,
  userTimeFormat = "12h",
  onPostSelect,
  onResumeDraft,
  selectedItems = new Set(),
  onToggleSelection,
  onToggleSelectAll,
  showBulkActions = false,
  onClearSelection,
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
  queueTypes = [],
  onResetDraftFilters,
  onResetListFilters,
  onBeforeDelete,
}: AllContentListingProps) {
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);
  const draftsListActionFetcher = useFetcher<{
    success?: boolean;
    newPostId?: string;
    error?: string;
  }>();

  const deleteFetcher = useFetcher<{
    success?: boolean;
    moved?: boolean;
    error?: string;
    needsSigning?: boolean;
    post?: PostData | LongFormPostData;
  }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (type !== "draft") return;
    if (
      draftsListActionFetcher.state === "idle" &&
      draftsListActionFetcher.data?.success &&
      draftsListActionFetcher.data.newPostId
    ) {
      void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
      navigate(
        getShortDraftEditRedirectPath(draftsListActionFetcher.data.newPostId)
      );
    }
  }, [
    type,
    draftsListActionFetcher.state,
    draftsListActionFetcher.data,
    navigate,
    queryClient,
  ]);

  // Invalidate queries when individual delete or move-to-draft succeeds
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      const data = deleteFetcher.data;
      if (typeof data === "object" && "success" in data && data.success) {
        void queryClient.invalidateQueries({
          queryKey: dashboardKeys.all,
          predicate: skipInfiniteQueries,
        });
        void queryClient.invalidateQueries({
          queryKey: scheduledPostsKeys.all,
          predicate: skipInfiniteQueries,
        });
        if (type === "draft" || ("moved" in data && data.moved)) {
          void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
        }
      }
    }
  }, [deleteFetcher.state, deleteFetcher.data, queryClient, type]);

  const handleDeleteWithCascade = useCallback(
    (postId: string, postType: "post" | "longform") => {
      onBeforeDelete?.(postId);

      const formData = new FormData();
      formData.set("postId", postId);
      formData.set(
        "_action",
        postType === "post" ? "delete" : "deleteLongForm"
      );

      void (async () => {
        try {
          const url = buildActionUrl(window.location.pathname);
          const resp = await fetch(url, {
            method: "POST",
            body: formData,
            credentials: "same-origin",
          });
          const json = (await resp.json().catch(() => null)) as {
            cascadeDeletedIds?: string[];
          } | null;
          const cascadeIds = json?.cascadeDeletedIds;
          if (cascadeIds && cascadeIds.length > 0) {
            queryClient.setQueriesData(
              { queryKey: scheduledPostsKeys.all },
              (old) => pruneScheduledQueryData(old, new Set(cascadeIds))
            );
          }
        } finally {
          void queryClient.invalidateQueries({
            queryKey: dashboardKeys.all,
            predicate: skipInfiniteQueries,
          });
          invalidateDependentCaches(queryClient);
        }
      })();
    },
    [queryClient, onBeforeDelete]
  );

  const scheduledDeleteHandler =
    type === "scheduled" ? handleDeleteWithCascade : undefined;

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

  const displayRows: ThreadListRow[] =
    type === "draft"
      ? sortedContent.map((root) => ({
          root,
          threadSegments: [] as CombinedContent[],
        }))
      : [...buildThreadListRows(sortedContent, type)].sort((a, b) => {
          const aValue = getSortValueForItem(a.root, sortConfig.key);
          const bValue = getSortValueForItem(b.root, sortConfig.key);
          if (aValue < bValue) {
            return sortConfig.direction === "asc" ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === "asc" ? 1 : -1;
          }
          return 0;
        });

  const filteredRows = displayRows.filter((row) =>
    threadListRowMatchesSearch(row, type, (item, t) =>
      combinedContentMatchesSearch(item, t, searchTerm)
    )
  );

  const attachedByParentId = useMemo(() => {
    if (type !== "scheduled" && type !== "published") {
      return new Map<string, CombinedContent[]>();
    }
    return attachedCombinedByParentId(content);
  }, [content, type]);

  /** Flat list for drafts table; scheduled/published use thread grouping */
  const filteredContent = filteredRows.map((row) => row.root);

  const selectedDraftContent = filteredRows
    .flatMap((row) => [row.root, ...row.threadSegments])
    .filter((item) => selectedItems.has(item.id));

  const dateSortKey = getContentListDateSortKey(type);

  // TanStack Virtual returns unstable refs by design; virtualization is intentional (plan: mobile card lists)
  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () =>
      getContentScrollElement(useDedicatedScroll, mobileScrollContainerRef),
    estimateSize: () => CONTENT_LIST_CARD_HEIGHT_PX + CONTENT_LIST_CARD_GAP_PX,
    overscan: 3,
    getItemKey: (index) => {
      const row = filteredRows[index];
      const item = row?.root;
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
      {showBulkActions && type === "draft" ? (
        <MixedDraftsBulkActions
          selectedDrafts={selectedDraftContent}
          queueTypes={queueTypes}
          onClearSelection={onClearSelection ?? (() => {})}
          onBulkDelete={onBulkDelete ?? (() => {})}
          bulkDeleteState={bulkDeleteState}
        />
      ) : showBulkActions ? (
        <ContentBulkActions
          type={type === "scheduled" ? "scheduled" : "published"}
          selectedCount={selectedItems.size}
          onClearSelection={onClearSelection ?? (() => {})}
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
        <TooltipProvider delayDuration={300}>
          <div className={PUBLISHING_LIST_SURFACE_CLASS}>
            <table
              className={
                type === "draft"
                  ? "min-w-full table-fixed align-middle text-sm"
                  : "min-w-full align-middle text-sm whitespace-nowrap"
              }
            >
              {type === "draft" ? (
                <DraftsHybridTableHeader
                  showBulkActions={showBulkActions}
                  sortConfig={sortConfig}
                  filteredContentLength={filteredRows.length}
                  selectedItemsSize={selectedItems.size}
                  onToggleSelectAll={onToggleSelectAll}
                  onRequestSort={requestSort}
                />
              ) : (
                <ContentTableHeader
                  type={type}
                  showBulkActions={showBulkActions}
                  sortConfig={sortConfig}
                  filteredContentLength={filteredRows.length}
                  selectedItemsSize={selectedItems.size}
                  onToggleSelectAll={onToggleSelectAll}
                  onRequestSort={requestSort}
                />
              )}
              <tbody>
                {type === "draft"
                  ? filteredContent.map((item) => (
                      <DraftsHybridTableRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        userTimezone={userTimezone}
                        userTimeFormat={userTimeFormat}
                        showBulkActions={showBulkActions}
                        selectedItems={selectedItems}
                        onToggleSelection={onToggleSelection}
                        onResumeDraft={
                          onResumeDraft ? () => onResumeDraft(item) : undefined
                        }
                        draftsActionFetcher={draftsListActionFetcher}
                        deleteFetcher={deleteFetcher as unknown as PostFetcher}
                      />
                    ))
                  : filteredRows.map((row) => (
                      <ContentTableRow
                        key={`${row.root.type}-${row.root.id}`}
                        item={row.root}
                        threadSegments={row.threadSegments}
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
                        onBeforeDelete={onBeforeDelete}
                        onDelete={scheduledDeleteHandler}
                        attachedFollowUpItems={
                          attachedByParentId.get(row.root.id) ?? []
                        }
                      />
                    ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </div>

      {/* Mobile: Sort + virtualized card list (visible only on mobile) */}
      {isMobile ? (
        <div className="block flex min-h-0 flex-1 flex-col md:hidden">
          <div className="cluster mt-3">
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
              {filteredRows.length > 0 ? (
                <>
                  <div
                    style={{
                      height: rowVirtualizer.getTotalSize(),
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualItems.map((virtualRow) => {
                      const row = filteredRows[virtualRow.index];
                      const item = row?.root;
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
                            threadSegments={
                              type === "draft" ? undefined : row.threadSegments
                            }
                            type={type}
                            userTimezone={userTimezone}
                            userTimeFormat={userTimeFormat}
                            showBulkActions={showBulkActions}
                            selectedItems={selectedItems}
                            onToggleSelection={onToggleSelection}
                            onPostSelect={onPostSelect}
                            onResumeDraft={
                              type === "draft" && onResumeDraft
                                ? () => onResumeDraft(item)
                                : undefined
                            }
                            draftsActionFetcher={
                              type === "draft"
                                ? draftsListActionFetcher
                                : undefined
                            }
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
                            onBeforeDelete={onBeforeDelete}
                            onDelete={scheduledDeleteHandler}
                            attachedFollowUpItems={
                              attachedByParentId.get(item.id) ?? []
                            }
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
          ) : filteredRows.length > 0 ? (
            <div
              className="mt-2"
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
                width: "100%",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const row = filteredRows[virtualRow.index];
                const item = row?.root;
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
                      threadSegments={
                        type === "draft" ? undefined : row.threadSegments
                      }
                      type={type}
                      userTimezone={userTimezone}
                      userTimeFormat={userTimeFormat}
                      showBulkActions={showBulkActions}
                      selectedItems={selectedItems}
                      onToggleSelection={onToggleSelection}
                      onPostSelect={onPostSelect}
                      onResumeDraft={
                        type === "draft" && onResumeDraft
                          ? () => onResumeDraft(item)
                          : undefined
                      }
                      draftsActionFetcher={
                        type === "draft" ? draftsListActionFetcher : undefined
                      }
                      onEditPost={onEditPost}
                      onReschedulePost={onReschedulePost}
                      deleteFetcher={deleteFetcher as unknown as PostFetcher}
                      individualRepostFetcher={individualRepostFetcher}
                      longformRepostFetcher={longformRepostFetcher}
                      longformQuoteFetcher={longformQuoteFetcher}
                      onScheduleRepost={onScheduleRepost}
                      onScheduleQuote={onScheduleQuote}
                      onBeforeDelete={onBeforeDelete}
                      onDelete={scheduledDeleteHandler}
                      attachedFollowUpItems={
                        attachedByParentId.get(item.id) ?? []
                      }
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

      {filteredRows.length === 0 ? (
        <div className="mt-8">
          {type === "draft" ? (
            content.length === 0 ? (
              <div className="border-border bg-surface rounded-xl border">
                <PublishingEmptyState
                  data-testid="drafts-empty-state"
                  title="No drafts yet"
                  description="Drafts appear here when you save unfinished posts, articles, or other work before publishing."
                >
                  <Button type="button" asChild>
                    <Link to="/dashboard/compose">Create post</Link>
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link to="/dashboard/bulkposts">Open bulk composer</Link>
                  </Button>
                </PublishingEmptyState>
              </div>
            ) : (
              <div className="border-border bg-surface rounded-xl border">
                <PublishingEmptyState
                  data-testid="drafts-filtered-empty"
                  title="No drafts match these filters"
                  description="Try another type tab or queue, or reset filters to see everything."
                >
                  {onResetDraftFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onResetDraftFilters}
                    >
                      Reset filters
                    </Button>
                  ) : null}
                </PublishingEmptyState>
              </div>
            )
          ) : type === "scheduled" ? (
            content.length === 0 ? (
              <div className="border-border bg-surface rounded-xl border">
                <PublishingEmptyState
                  data-testid="scheduled-empty-state"
                  title="Nothing scheduled"
                  description="Upcoming posts and articles will appear here. Create something new or move drafts into the schedule."
                >
                  <Button type="button" asChild>
                    <Link to="/dashboard/compose?type=post">Open Composer</Link>
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link to="/dashboard/bulkposts">Bulk composer</Link>
                  </Button>
                </PublishingEmptyState>
              </div>
            ) : (
              <div className="border-border bg-surface rounded-xl border">
                <PublishingEmptyState
                  data-testid="scheduled-filtered-empty"
                  title="No items match these filters"
                  description="Try another content tab, queue, or date range."
                >
                  {onResetListFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onResetListFilters}
                    >
                      Reset filters
                    </Button>
                  ) : null}
                  {searchTerm.trim() ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onSearchChange("")}
                    >
                      Clear search
                    </Button>
                  ) : null}
                </PublishingEmptyState>
              </div>
            )
          ) : (
            <>
              {content.length === 0 ? (
                <div className="border-border bg-surface rounded-xl border">
                  <PublishingEmptyState
                    data-testid="published-empty-state"
                    title="No published content yet"
                    description="Published posts and articles show up here once they go live."
                  >
                    <Button type="button" asChild>
                      <Link to="/dashboard/compose?type=post">Create post</Link>
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link to="/dashboard/scheduled">View scheduled</Link>
                    </Button>
                  </PublishingEmptyState>
                </div>
              ) : (
                <div className="border-border bg-surface rounded-xl border">
                  <PublishingEmptyState
                    data-testid="published-filtered-empty"
                    title="No items match these filters"
                    description="Try another tab, queue, or date range."
                  >
                    {onResetListFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onResetListFilters}
                      >
                        Reset filters
                      </Button>
                    ) : null}
                    {searchTerm.trim() ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onSearchChange("")}
                      >
                        Clear search
                      </Button>
                    ) : null}
                  </PublishingEmptyState>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
