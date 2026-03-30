import { useFetcher, useRouteLoaderData } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useState, useEffect, useMemo, useRef, type Key } from "react";

import { longFormPostToCombinedContent } from "~/features/posts/combined";
import {
  CONTENT_LIST_CARD_GAP_PX,
  CONTENT_MOBILE_BREAKPOINT_PX,
} from "~/features/posts/components/constants";
import { dashboardKeys } from "~/features/posts/hooks/useDashboardQuery";
import { draftsKeys } from "~/features/posts/hooks/useDraftsQuery";
import { scheduledPostsKeys } from "~/features/posts/scheduling/hooks/useScheduledPostsQuery";
import type { LongFormPostType } from "~/features/posts/server";
import type { PostFetcher, LongFormPostData } from "~/features/posts/types";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";

import { useLongFormListingState } from "../hooks/useLongFormListingState";
import {
  formatDateCell,
  getReadingTime,
  getStatusBadge,
} from "../utils/longform-listing-format.utils";
import {
  getDefaultSortKey,
  getFetcherFormData,
} from "../utils/longform-listing-utils";

import { LongFormBulkActionsBar } from "./LongFormBulkActionsBar";
import { LongFormCardListMobile } from "./LongFormCardListMobile";
import { LongFormTableDesktop } from "./LongFormTableDesktop";

interface LongFormListingProps {
  posts: Array<LongFormPostType | LongFormPostData>;
  type: "draft" | "scheduled" | "published";
  onPostSelect?: (post: LongFormPostType | LongFormPostData) => void;
  /** Drafts tab: open longform editor instead of details modal */
  onResumeDraft?: (post: LongFormPostType | LongFormPostData) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  onEditPost?: (post: LongFormPostType | LongFormPostData) => void;
  onReschedulePost?: (post: LongFormPostType | LongFormPostData) => void;
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
  onScrollContainerReady?: (el: HTMLDivElement | null) => void;
}

export default function LongFormListing({
  posts,
  type,
  onPostSelect,
  onResumeDraft,
  searchTerm = "",
  onSearchChange: _onSearchChange,
  userTimezone = "UTC",
  userTimeFormat = "12h",
  longformRepostFetcher,
  longformQuoteFetcher,
  onEditPost,
  onReschedulePost,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
  onScrollContainerReady,
}: LongFormListingProps) {
  const { dateLocale } = useFormattedDate();
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);

  const {
    sortConfig,
    setSortConfig,
    requestSort,
    filteredPosts,
    selectedPosts,
    setSelectedPosts,
    togglePostSelection,
    toggleSelectAll,
    countdowns,
  } = useLongFormListingState({
    posts,
    type,
    searchTerm,
    userTimezone,
  });

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
  const deleteFetcher = useFetcher<{
    success?: boolean;
    moved?: boolean;
  }>();
  interface BulkDeleteFetcherData {
    success?: boolean;
  }
  const bulkDeleteFetcher = useFetcher<BulkDeleteFetcherData>();
  const queryClient = useQueryClient();

  // Invalidate when delete or move-to-draft succeeds (scheduled tab) or when deleting a draft (drafts tab)
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      const data = deleteFetcher.data;

      if ("success" in data && data.success) {
        void queryClient.invalidateQueries({
          queryKey: scheduledPostsKeys.all,
        });
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });

        if (type === "draft" || ("moved" in data && data.moved)) {
          void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
        }
      }
    }
  }, [deleteFetcher.state, deleteFetcher.data, queryClient, type]);

  const combinedContent = useMemo(
    () =>
      filteredPosts.map((post) =>
        longFormPostToCombinedContent(post as LongFormPostData)
      ),
    [filteredPosts]
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual useVirtualizer; memoization handled by library
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

  useEffect(() => {
    if (bulkDeleteFetcher.data?.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data, setSelectedPosts]);

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkDeleteLongForm");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkDeleteFetcher.submit(formData, { method: "post" });
  };

  const handleOpenPost = (post: LongFormPostType | LongFormPostData) => {
    if (type === "draft" && onResumeDraft) {
      onResumeDraft(post);
      return;
    }
    onPostSelect?.(post);
  };

  return (
    <div>
      <LongFormBulkActionsBar
        selectedCount={selectedPosts.size}
        onBulkDelete={handleBulkDelete}
        deleteFetcherState={bulkDeleteFetcher.state}
        type={type}
      />

      <div className="hidden md:block">
        <LongFormTableDesktop
          filteredPosts={filteredPosts}
          selectedPosts={selectedPosts}
          togglePostSelection={togglePostSelection}
          toggleSelectAll={toggleSelectAll}
          sortConfig={sortConfig}
          requestSort={requestSort}
          type={type}
          formatDateCell={formatDateCell}
          getReadingTime={getReadingTime}
          getStatusBadge={getStatusBadge}
          countdowns={countdowns}
          onPostSelect={handleOpenPost}
          onEditPost={onEditPost}
          onReschedulePost={onReschedulePost}
          deleteFetcher={deleteFetcher}
          bulkDeleteFetcher={bulkDeleteFetcher}
          nostrUrls={nostrUrls}
          longformRepostFetcher={longformRepostFetcher}
          longformQuoteFetcher={longformQuoteFetcher}
          getFetcherFormData={getFetcherFormData}
          userTimezone={userTimezone}
          userTimeFormat={userTimeFormat}
          dateLocale={dateLocale}
        />
      </div>

      {isMobile ? (
        <LongFormCardListMobile
          useDedicatedScroll={useDedicatedScroll}
          scrollContainerRef={(el) => {
            mobileScrollContainerRef.current = el;
            onScrollContainerReady?.(el ?? null);
          }}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
          type={type}
          getDefaultSortKey={getDefaultSortKey}
          combinedContent={combinedContent}
          rowVirtualizer={rowVirtualizer}
          virtualItems={virtualItems}
          openMenuRowKey={openMenuRowKey}
          setOpenMenuRowKey={setOpenMenuRowKey}
          userTimezone={userTimezone}
          userTimeFormat={userTimeFormat}
          selectedPosts={selectedPosts}
          togglePostSelection={togglePostSelection}
          onPostSelect={handleOpenPost}
          onEditPost={onEditPost}
          onReschedulePost={onReschedulePost}
          deleteFetcher={deleteFetcher}
          longformRepostFetcher={longformRepostFetcher}
          longformQuoteFetcher={longformQuoteFetcher}
          prefetchSentinelRef={prefetchSentinelRef}
          sentinelRef={sentinelRef}
          isFetchingNextPage={isFetchingNextPage}
        />
      ) : null}
    </div>
  );
}
