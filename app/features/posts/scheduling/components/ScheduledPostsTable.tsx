/**
 * Scheduled posts table component
 */

import type { FetcherWithComponents } from "@remix-run/react";
import { useFetcher } from "@remix-run/react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal, Quote, Repeat } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Key,
  type MutableRefObject,
} from "react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { AttachedFollowUpsMenu } from "~/features/posts/components/AttachedFollowUpsMenu";
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
import { ThreadSegmentsMenu } from "~/features/posts/components/ThreadSegmentsMenu";
import { dashboardKeys } from "~/features/posts/hooks/useDashboardQuery";
import { invalidateDependentCaches } from "~/features/posts/hooks/useRefreshPostViews";
import { needsResignAfterQueueResume } from "~/features/posts/queue-status";
import type { CombinedContent, PostData } from "~/features/posts/types";
import {
  attachedPostsByParentId,
  attachedPostsForThreadRow,
  isAttachedFollowUpPost,
} from "~/features/posts/utils/attached-follow-up-rows";
import { getPostRowThumbnailBadge } from "~/features/posts/utils/content-helpers";
import { buildActionUrl } from "~/features/posts/utils/remix-action-url";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import {
  buildPostThreadRows,
  comparePostDataByScheduledSort,
  type PostThreadRow,
} from "~/features/posts/utils/thread-list-grouping";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { skipInfiniteQueries } from "~/lib/query/is-infinite-query-data";
import { formatForDisplay, fromDate } from "~/lib/temporal";
import { cn } from "~/lib/utils";

import { pruneScheduledQueryData } from "../hooks/useScheduledPostsCache";
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
  /** Thread roots only — for “select all” when rows are merged by thread. */
  selectableRootIds: string[];
}

interface SortableHeaderProps {
  sortKey: string;
  label: string;
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
}

function ScheduledTableCaptionColumn({
  post,
  row,
  attachedFollowUps,
  userTimezone,
  userTimeFormat,
  onSelectPost,
}: {
  post: PostData;
  row: PostThreadRow;
  attachedFollowUps: PostData[];
  userTimezone?: string | null;
  userTimeFormat?: "12h" | "24h" | null;
  onSelectPost: (p: PostData) => void;
}) {
  const tf = userTimeFormat === "24h" ? "24h" : "12h";
  const tz = userTimezone ?? undefined;
  return (
    <>
      <p
        className={cn(
          "font-medium",
          post.dependencyMode === "attached" && "pl-3"
        )}
      >
        {post.caption && post.caption.length > 21
          ? post.caption.substring(0, 21) + "..."
          : post.caption}
      </p>
      {post.dependencyMode === "attached" ? (
        <p className="text-text-secondary text-xs">
          Follow-up
          {post.followUpTimingMode === "offset_from_parent"
            ? " · Offset from parent"
            : " · Fixed date/time"}
        </p>
      ) : null}
      {row.threadSegments.length > 0 ? (
        <ThreadSegmentsMenu
          segments={row.threadSegments.map((p) => postToCombinedContent(p))}
          listType="scheduled"
          userTimezone={tz}
          userTimeFormat={tf}
          onSelectSegment={(c) => onSelectPost(c.originalData as PostData)}
          triggerClassName="mt-1"
        />
      ) : null}
      {attachedFollowUps.length > 0 ? (
        <AttachedFollowUpsMenu
          items={attachedFollowUps.map((p) => postToCombinedContent(p))}
          listType="scheduled"
          userTimezone={tz}
          userTimeFormat={tf}
          onSelectFollowUp={(c) => onSelectPost(c.originalData as PostData)}
          triggerClassName={row.threadSegments.length > 0 ? "mt-0.5" : "mt-1"}
        />
      ) : null}
    </>
  );
}

const SortableHeader = ({
  sortKey,
  label,
  sortConfig,
  onRequestSort,
}: SortableHeaderProps) => (
  <th
    className="bg-surface border-border text-text cursor-pointer border-b px-3 py-4 text-left font-semibold"
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

interface ScheduledPostTableRowActionsProps {
  post: PostData;
  blockRepostQuoteChain: boolean;
  onEditPost: (post: PostData) => void;
  onReschedulePost: (post: PostData) => void;
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
  moveToDraftFetcher: FetcherWithComponents<{ success?: boolean }>;
  bulkDeleteState: string;
  deletingPostId: string | null;
  handleDeleteWithCascade: (
    postId: string,
    postType: "post" | "longform"
  ) => void;
  queryClient: QueryClient;
  lastMoveSubmissionRef: MutableRefObject<{ postId: string } | null>;
  /** Queue follow-ups attached to this parent; actions live here instead of on their own row. */
  attachedFollowUps?: PostData[];
}

function ScheduledPostTableRowActions({
  post,
  blockRepostQuoteChain,
  onEditPost,
  onReschedulePost,
  onScheduleRepost,
  onScheduleQuote,
  moveToDraftFetcher,
  bulkDeleteState,
  deletingPostId,
  handleDeleteWithCascade,
  queryClient,
  lastMoveSubmissionRef,
  attachedFollowUps = [],
}: ScheduledPostTableRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="focus-ring border-border bg-surface text-text hover:bg-surface-hover inline-flex h-8 w-8 items-center justify-center rounded-lg border"
          aria-label="Actions"
        >
          <MoreHorizontal className={INLINE_ICON_SIZE_CLASS} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onEditPost(post)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onReschedulePost(post)}>
          Reschedule
        </DropdownMenuItem>
        {needsResignAfterQueueResume(post) ? (
          <DropdownMenuItem onSelect={() => onReschedulePost(post)}>
            Re-sign
          </DropdownMenuItem>
        ) : null}
        {onScheduleRepost && !blockRepostQuoteChain ? (
          <DropdownMenuItem onSelect={() => onScheduleRepost(post)}>
            Schedule repost
          </DropdownMenuItem>
        ) : null}
        {onScheduleQuote && !blockRepostQuoteChain ? (
          <DropdownMenuItem onSelect={() => onScheduleQuote(post)}>
            Schedule quote
          </DropdownMenuItem>
        ) : null}
        {attachedFollowUps.map((child) => {
          const blockChild = isPureRepostSourcePost(child);
          const preview = (child.caption ?? "").trim().slice(0, 40);
          return (
            <DropdownMenuSub key={child.id}>
              <DropdownMenuSubTrigger className="max-w-[min(100%,18rem)]">
                <span className="truncate">
                  Follow-up
                  {preview ? (
                    <span className="text-text-secondary font-normal">
                      {" "}
                      · {preview}
                      {(child.caption?.trim().length ?? 0) > 40 ? "…" : ""}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                alignOffset={-4}
                className="min-w-[10rem]"
              >
                <DropdownMenuItem onSelect={() => onEditPost(child)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onReschedulePost(child)}>
                  Reschedule
                </DropdownMenuItem>
                {needsResignAfterQueueResume(child) ? (
                  <DropdownMenuItem onSelect={() => onReschedulePost(child)}>
                    Re-sign
                  </DropdownMenuItem>
                ) : null}
                {onScheduleRepost && !blockChild ? (
                  <DropdownMenuItem onSelect={() => onScheduleRepost(child)}>
                    Schedule repost
                  </DropdownMenuItem>
                ) : null}
                {onScheduleQuote && !blockChild ? (
                  <DropdownMenuItem onSelect={() => onScheduleQuote(child)}>
                    Schedule quote
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={
                    moveToDraftFetcher.state !== "idle" ||
                    deletingPostId != null ||
                    bulkDeleteState !== "idle"
                  }
                  onSelect={() => {
                    queryClient.setQueriesData(
                      { queryKey: scheduledPostsKeys.all },
                      (old) => pruneScheduledQueryData(old, new Set([child.id]))
                    );
                    lastMoveSubmissionRef.current = {
                      postId: child.id,
                    };
                    const fd = new FormData();
                    fd.set("postId", child.id);
                    fd.set("_action", "moveToDraft");
                    fd.set("type", "post");
                    moveToDraftFetcher.submit(fd, { method: "post" });
                  }}
                >
                  {moveToDraftFetcher.state !== "idle" &&
                  moveToDraftFetcher.formData?.get("_action") ===
                    "moveToDraft" &&
                  /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- formData can be undefined during submit */
                  moveToDraftFetcher.formData?.get("postId") === child.id
                    ? "Moving..."
                    : "Move to drafts"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={
                    moveToDraftFetcher.state !== "idle" ||
                    deletingPostId != null ||
                    bulkDeleteState !== "idle"
                  }
                  className="text-danger focus:text-danger"
                  onSelect={() => handleDeleteWithCascade(child.id, "post")}
                >
                  {deletingPostId === child.id ? "Deleting..." : "Delete"}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={
            moveToDraftFetcher.state !== "idle" ||
            deletingPostId != null ||
            bulkDeleteState !== "idle"
          }
          onSelect={() => {
            queryClient.setQueriesData(
              { queryKey: scheduledPostsKeys.all },
              (old) => pruneScheduledQueryData(old, new Set([post.id]))
            );
            lastMoveSubmissionRef.current = {
              postId: post.id,
            };
            const fd = new FormData();
            fd.set("postId", post.id);
            fd.set("_action", "moveToDraft");
            fd.set("type", "post");
            moveToDraftFetcher.submit(fd, { method: "post" });
          }}
        >
          {moveToDraftFetcher.state !== "idle" &&
          moveToDraftFetcher.formData?.get("_action") === "moveToDraft" &&
          /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- formData can be undefined during submit */
          moveToDraftFetcher.formData?.get("postId") === post.id
            ? "Moving..."
            : "Move to drafts"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={
            moveToDraftFetcher.state !== "idle" ||
            deletingPostId != null ||
            bulkDeleteState !== "idle"
          }
          className="text-danger focus:text-danger"
          onSelect={() => handleDeleteWithCascade(post.id, "post")}
        >
          {deletingPostId === post.id ? "Deleting..." : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  selectableRootIds,
}: ScheduledPostsTableProps) {
  const { dateLocale } = useFormattedDate();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);
  const moveToDraftFetcher = useFetcher<{ success?: boolean }>();
  const queryClient = useQueryClient();
  const previousMoveStateRef = useRef(moveToDraftFetcher.state);
  const previousMoveDataRef = useRef(moveToDraftFetcher.data);
  const lastMoveSubmissionRef = useRef<{ postId: string } | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const handleDeleteWithCascade = useCallback(
    (postId: string, postType: "post" | "longform") => {
      setDeletingPostId(postId);
      queryClient.setQueriesData({ queryKey: scheduledPostsKeys.all }, (old) =>
        pruneScheduledQueryData(old, new Set([postId]))
      );

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
          setDeletingPostId(null);
          void queryClient.invalidateQueries({
            queryKey: dashboardKeys.all,
            predicate: skipInfiniteQueries,
          });
          invalidateDependentCaches(queryClient);
        }
      })();
    },
    [queryClient]
  );

  const threadRows = useMemo(() => {
    const built = buildPostThreadRows(posts, "scheduled");
    return [...built].sort((a, b) =>
      comparePostDataByScheduledSort(a.root, b.root, sortConfig)
    );
  }, [posts, sortConfig]);

  const attachedByParentId = useMemo(
    () => attachedPostsByParentId(posts),
    [posts]
  );

  const combinedContent = useMemo(
    () => threadRows.map((r) => postToCombinedContent(r.root)),
    [threadRows]
  );

  const rowVirtualizer = useVirtualizer({
    count: threadRows.length,
    getScrollElement: () =>
      useDedicatedScroll && mobileScrollContainerRef.current
        ? mobileScrollContainerRef.current
        : typeof document !== "undefined"
          ? document.documentElement
          : null,
    estimateSize: () => 98 + CONTENT_LIST_CARD_GAP_PX,
    overscan: 3,
    getItemKey: (index) => threadRows[index]?.root.id ?? String(index),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const [openMenuRowKey, setOpenMenuRowKey] = useState<Key | null>(null);

  useEffect(() => {
    const previousState = previousMoveStateRef.current;
    const currentState = moveToDraftFetcher.state;
    const dataChanged = moveToDraftFetcher.data !== previousMoveDataRef.current;
    const submission = lastMoveSubmissionRef.current;

    if (
      currentState === "idle" &&
      submission &&
      (previousState !== "idle" || dataChanged)
    ) {
      queryClient.setQueriesData({ queryKey: scheduledPostsKeys.all }, (old) =>
        pruneScheduledQueryData(old, new Set([submission.postId]))
      );
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.all,
        predicate: skipInfiniteQueries,
      });
      invalidateDependentCaches(queryClient);
      lastMoveSubmissionRef.current = null;
    } else if (previousState !== "idle" && currentState === "idle") {
      lastMoveSubmissionRef.current = null;
    }
    previousMoveStateRef.current = currentState;
    previousMoveDataRef.current = moveToDraftFetcher.data;
  }, [moveToDraftFetcher.state, moveToDraftFetcher.data, queryClient]);

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
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
                  <Checkbox
                    id="scheduled-select-all"
                    checked={
                      selectableRootIds.length > 0
                        ? selectableRootIds.every((id) =>
                            selectedPosts.has(id)
                          ) && selectedPosts.size === selectableRootIds.length
                        : false
                    }
                    onCheckedChange={() => onToggleSelectAll()}
                  />
                </th>
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-left font-semibold">
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
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
                  Time Remaining
                </th>
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
                  Queue
                </th>
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
                  Status
                </th>
                <th className="bg-surface border-border text-text border-b px-3 py-4 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {threadRows.map((row) => {
                const post = row.root;
                const attachedFollowUps = attachedPostsForThreadRow(
                  attachedByParentId,
                  row
                );
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
                            className="h-12 w-12 rounded-xs object-cover"
                            onClick={() => {
                              const imageUrl = getImageUrls(post.fileUrl)[0];
                              if (imageUrl) {
                                onMediaClick(imageUrl);
                              }
                            }}
                            fallback={
                              <div className="bg-surface-hover text-text-secondary flex h-12 w-12 items-center justify-center rounded-xs text-xs font-medium">
                                {rowThumbBadge}
                              </div>
                            }
                          />
                        ) : post.repost ? (
                          <div className="bg-brand/12 text-text flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-xs text-[10px] font-medium">
                            <Repeat
                              className={`${SMALL_ICON_SIZE_CLASS} shrink-0`}
                              strokeWidth={INLINE_ICON_STROKE}
                              aria-hidden
                            />
                            REPOST
                          </div>
                        ) : post.isQuotedPost ? (
                          <div className="bg-success/20 text-success dark:text-success flex h-12 w-12 items-center justify-center rounded-xs text-xs font-medium">
                            QUOTE
                          </div>
                        ) : (
                          <div className="bg-surface-hover text-text-secondary flex h-12 w-12 items-center justify-center rounded-xs text-xs font-medium">
                            {rowThumbBadge}
                          </div>
                        )}
                        {post.repost ? (
                          <div className="bg-brand absolute -top-1 -right-1 rounded-full p-1">
                            <Repeat
                              className={`${SMALL_ICON_SIZE_CLASS} text-brand-on`}
                              strokeWidth={INLINE_ICON_STROKE}
                              aria-hidden
                            />
                          </div>
                        ) : null}
                        {post.isQuotedPost && post.fileUrl.length > 0 ? (
                          <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
                            <Quote
                              className={`${SMALL_ICON_SIZE_CLASS} text-success-foreground`}
                              strokeWidth={INLINE_ICON_STROKE}
                              aria-hidden
                            />
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3">
                      <ScheduledTableCaptionColumn
                        post={post}
                        row={row}
                        attachedFollowUps={attachedFollowUps}
                        userTimezone={userTimezone}
                        userTimeFormat={userTimeFormat}
                        onSelectPost={onPostClick}
                      />
                    </td>
                    <td className={cn("p-3", PUBLISHING_DATETIME_CELL_CLASS)}>
                      {formatDate(post.scheduledAtUtc)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="text-text text-sm font-medium">
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
                      {post.queueHoldStatus ===
                      "NEEDS_RESIGN_AFTER_QUEUE_RESUME" ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-text-secondary text-xs font-medium">
                            Needs re-sign
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReschedulePost(post);
                            }}
                            className="text-primary hover:text-primary/90 text-xs font-semibold underline"
                          >
                            Re-sign
                          </button>
                        </div>
                      ) : (
                        <span className="text-text-secondary text-xs font-medium">
                          {post.queueHoldStatus === "HELD_BY_QUEUE"
                            ? "Paused"
                            : post.signedEvent
                              ? "Signed"
                              : "Scheduled"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {isAttachedFollowUpPost(post) ? (
                        <span
                          className="text-text-secondary text-xs"
                          aria-hidden
                        >
                          —
                        </span>
                      ) : (
                        <ScheduledPostTableRowActions
                          post={post}
                          blockRepostQuoteChain={blockRepostQuoteChain}
                          onEditPost={onEditPost}
                          onReschedulePost={onReschedulePost}
                          onScheduleRepost={onScheduleRepost}
                          onScheduleQuote={onScheduleQuote}
                          moveToDraftFetcher={moveToDraftFetcher}
                          bulkDeleteState={bulkDeleteState}
                          deletingPostId={deletingPostId}
                          handleDeleteWithCascade={handleDeleteWithCascade}
                          queryClient={queryClient}
                          lastMoveSubmissionRef={lastMoveSubmissionRef}
                          attachedFollowUps={attachedFollowUps}
                        />
                      )}
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
            <div className="cluster mb-3">
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
                      const row = threadRows[virtualRow.index];
                      const item = combinedContent[virtualRow.index];
                      if (!item || !row) return null;
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
                            threadSegments={row.threadSegments.map((p) =>
                              postToCombinedContent(p)
                            )}
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
                              moveToDraftFetcher as Parameters<
                                typeof ContentListCard
                              >[0]["deleteFetcher"]
                            }
                            onScheduleRepost={onScheduleRepost}
                            onScheduleQuote={onScheduleQuote}
                            onDelete={handleDeleteWithCascade}
                            attachedFollowUpItems={attachedPostsForThreadRow(
                              attachedByParentId,
                              row
                            ).map((p) => postToCombinedContent(p))}
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
                const row = threadRows[virtualRow.index];
                const item = combinedContent[virtualRow.index];
                if (!item || !row) return null;
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
                      threadSegments={row.threadSegments.map((p) =>
                        postToCombinedContent(p)
                      )}
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
                        moveToDraftFetcher as Parameters<
                          typeof ContentListCard
                        >[0]["deleteFetcher"]
                      }
                      onScheduleRepost={onScheduleRepost}
                      onScheduleQuote={onScheduleQuote}
                      onDelete={handleDeleteWithCascade}
                      attachedFollowUpItems={attachedPostsForThreadRow(
                        attachedByParentId,
                        row
                      ).map((p) => postToCombinedContent(p))}
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
