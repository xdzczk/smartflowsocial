import type { VirtualItem } from "@tanstack/react-virtual";
import type { Key } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  CONTENT_LIST_CARD_GAP_PX,
  MOBILE_FILTER_LABEL_CLASS,
  MOBILE_FILTER_SELECT_TRIGGER_CLASS,
} from "~/features/posts/components/constants";
import { ContentListCard } from "~/features/posts/components/ContentListCard";
import type { LongFormPostType } from "~/features/posts/server";
import type {
  CombinedContent,
  LongFormPostData,
  PostFetcher,
} from "~/features/posts/types";

export interface LongFormCardListMobileSortConfig {
  key: string;
  direction: "asc" | "desc";
}

export interface LongFormCardListMobileProps {
  useDedicatedScroll: boolean;
  scrollContainerRef: (el: HTMLDivElement | null) => void;
  sortConfig: LongFormCardListMobileSortConfig;
  setSortConfig: (config: LongFormCardListMobileSortConfig) => void;
  type: "draft" | "scheduled" | "published";
  getDefaultSortKey: (type: "draft" | "scheduled" | "published") => string;
  combinedContent: CombinedContent[];
  rowVirtualizer: { getTotalSize: () => number };
  virtualItems: VirtualItem[];
  openMenuRowKey: Key | null;
  setOpenMenuRowKey: (key: Key | null) => void;
  userTimezone: string;
  userTimeFormat: "12h" | "24h";
  selectedPosts: Set<string>;
  togglePostSelection: (id: string) => void;
  onPostSelect?: (post: LongFormPostType | LongFormPostData) => void;
  onEditPost?: (post: LongFormPostType | LongFormPostData) => void;
  onReschedulePost?: (post: LongFormPostType | LongFormPostData) => void;
  deleteFetcher: PostFetcher;
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
}

export function LongFormCardListMobile({
  useDedicatedScroll,
  scrollContainerRef,
  sortConfig,
  setSortConfig,
  type,
  getDefaultSortKey,
  combinedContent,
  rowVirtualizer,
  virtualItems,
  openMenuRowKey,
  setOpenMenuRowKey,
  userTimezone,
  userTimeFormat,
  selectedPosts,
  togglePostSelection,
  onPostSelect,
  onEditPost,
  onReschedulePost,
  deleteFetcher,
  longformRepostFetcher,
  longformQuoteFetcher,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
}: LongFormCardListMobileProps) {
  const sortSelectValue =
    sortConfig.key === "title"
      ? `title-${sortConfig.direction}`
      : `date-${sortConfig.direction}`;

  const handleSortChange = (value: string) => {
    if (
      value === "date-asc" ||
      value === "date-desc" ||
      value === "title-asc" ||
      value === "title-desc"
    ) {
      const [key, dir] = value.split("-") as [string, "asc" | "desc"];
      setSortConfig({
        key: key === "date" ? getDefaultSortKey(type) : "title",
        direction: dir,
      });
    }
  };

  const listContent =
    combinedContent.length > 0 ? (
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
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  zIndex: openMenuRowKey === virtualRow.key ? 50 : undefined,
                  marginBottom: CONTENT_LIST_CARD_GAP_PX,
                }}
              >
                <ContentListCard
                  item={item}
                  type={type}
                  userTimezone={userTimezone}
                  userTimeFormat={userTimeFormat}
                  showBulkActions={true}
                  selectedItems={selectedPosts}
                  onToggleSelection={togglePostSelection}
                  onPostSelect={(content) =>
                    onPostSelect?.(content.originalData as LongFormPostData)
                  }
                  onEditPost={
                    onEditPost
                      ? (post) =>
                          onEditPost(
                            post as LongFormPostType | LongFormPostData
                          )
                      : undefined
                  }
                  onReschedulePost={
                    onReschedulePost
                      ? (post) =>
                          onReschedulePost(
                            post as LongFormPostType | LongFormPostData
                          )
                      : undefined
                  }
                  deleteFetcher={deleteFetcher}
                  longformRepostFetcher={longformRepostFetcher}
                  longformQuoteFetcher={longformQuoteFetcher}
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
        {sentinelRef ? <div ref={sentinelRef} className="h-4 w-full" /> : null}
        {isFetchingNextPage ? (
          <div className="text-muted-foreground py-4 text-center text-sm">
            Loading more...
          </div>
        ) : null}
      </>
    ) : null;

  return (
    <div className="block flex min-h-0 flex-1 flex-col md:hidden">
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`text-muted-foreground text-sm ${MOBILE_FILTER_LABEL_CLASS}`}
        >
          Sort:
        </span>
        <Select value={sortSelectValue} onValueChange={handleSortChange}>
          <SelectTrigger
            className={`w-[11rem] ${MOBILE_FILTER_SELECT_TRIGGER_CLASS}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Date (newest first)</SelectItem>
            <SelectItem value="date-asc">Date (oldest first)</SelectItem>
            <SelectItem value="title-asc">Title (A–Z)</SelectItem>
            <SelectItem value="title-desc">Title (Z–A)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {useDedicatedScroll ? (
        <div
          ref={scrollContainerRef}
          className="mt-2 min-h-0 flex-1 overflow-auto"
        >
          {listContent}
        </div>
      ) : (
        <div className="mt-2">{listContent}</div>
      )}
    </div>
  );
}
