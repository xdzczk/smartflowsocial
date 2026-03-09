import { useFetcher, Link, useRouteLoaderData } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal } from "lucide-react";
import { useState, useEffect, useMemo, useRef, type Key } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { longFormPostToCombinedContent } from "~/features/posts/combined";
import {
  CONTENT_LIST_CARD_GAP_PX,
  CONTENT_MOBILE_BREAKPOINT_PX,
  MOBILE_FILTER_LABEL_CLASS,
  MOBILE_FILTER_SELECT_TRIGGER_CLASS,
} from "~/features/posts/components/constants";
import { ContentListCard } from "~/features/posts/components/ContentListCard";
import { dashboardKeys } from "~/features/posts/hooks/useDashboardQuery";
import { draftsKeys } from "~/features/posts/hooks/useDraftsQuery";
import { scheduledPostsKeys } from "~/features/posts/scheduling/hooks/useScheduledPostsQuery";
import type { LongFormPostType } from "~/features/posts/server";
import type { PostFetcher, LongFormPostData } from "~/features/posts/types";
import { handleErrorSafely } from "~/lib/error-handler.client";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { stripMarkdownToPlainText } from "~/lib/markdown-utils";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";
import {
  difference,
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  nowInTimezone,
} from "~/lib/temporal";

// Helper to safely access formData from a fetcher
function getFetcherFormData(
  fetcher: PostFetcher | undefined
): FormData | null | undefined {
  return fetcher
    ? (fetcher as { formData?: FormData | null }).formData
    : undefined;
}

interface LongFormListingProps {
  posts: Array<LongFormPostType | LongFormPostData>;
  type: "draft" | "scheduled" | "published";
  onPostSelect?: (post: LongFormPostType | LongFormPostData) => void;
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

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultSortKey(type: "draft" | "scheduled" | "published"): string {
  if (type === "published") {
    return "publishedAt";
  }
  if (type === "scheduled") {
    return "scheduledAtUtc";
  }
  return "createdAt";
}

function getDefaultSortDirection(
  type: "draft" | "scheduled" | "published"
): "asc" | "desc" {
  if (type === "published") {
    return "desc";
  }
  if (type === "scheduled") {
    return "asc";
  }
  return "desc";
}

function getSortValue(post: LongFormPostType, key: string): number {
  try {
    if (key === "publishedAt") {
      if (!post.publishedAt) return 0;
      const zoned = fromISOString(
        post.publishedAt instanceof Date
          ? post.publishedAt.toISOString()
          : String(post.publishedAt),
        "UTC"
      );
      return Number(zoned.epochMilliseconds);
    }
    if (key === "scheduledAtUtc" || key === "scheduledFor") {
      const scheduledAt =
        "scheduledAtUtc" in post && post.scheduledAtUtc instanceof Date
          ? post.scheduledAtUtc
          : null;
      if (!scheduledAt) return 0;
      const zoned = fromDate(scheduledAt, "UTC");
      return Number(zoned.epochMilliseconds);
    }
    if (key === "createdAt") {
      const zoned = fromISOString(
        post.createdAt instanceof Date
          ? post.createdAt.toISOString()
          : String(post.createdAt),
        "UTC"
      );
      return Number(zoned.epochMilliseconds);
    }
    const val = post[key as keyof LongFormPostType];
    return typeof val === "number" ? val : 0;
  } catch {
    return 0;
  }
}

function compareStringValues(
  a: string,
  b: string,
  direction: "asc" | "desc"
): number {
  return direction === "asc" ? a.localeCompare(b) : b.localeCompare(a);
}

function longFormMatchesSearch(
  post: LongFormPostType | LongFormPostData,
  searchTerm: string
): boolean {
  const term = searchTerm.toLowerCase();
  return (
    (post.title?.toLowerCase().includes(term) ?? false) ||
    (post.summary?.toLowerCase().includes(term) ?? false)
  );
}

function sortLongFormPosts(
  posts: Array<LongFormPostType | LongFormPostData>,
  sortConfig: { key: string; direction: "asc" | "desc" }
): Array<LongFormPostType | LongFormPostData> {
  return [...posts].sort((a, b) => {
    const aVal =
      a[sortConfig.key as keyof (LongFormPostType | LongFormPostData)];
    const bVal =
      b[sortConfig.key as keyof (LongFormPostType | LongFormPostData)];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return compareStringValues(aVal, bVal, sortConfig.direction);
    }

    const aValue = getSortValue(a as LongFormPostType, sortConfig.key);
    const bValue = getSortValue(b as LongFormPostType, sortConfig.key);
    return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
  });
}

// Desktop table + mobile virtualized cards; complexity from sort/filter/selection and dual layouts
// eslint-disable-next-line sonarjs/cognitive-complexity -- slightly over 30 due to table + card branches
export default function LongFormListing({
  posts,
  type,
  onPostSelect,
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

  const [sortConfig, setSortConfig] = useState({
    key: getDefaultSortKey(type),
    direction: getDefaultSortDirection(type),
  });
  const [selectedPosts, setSelectedPosts] = useState(new Set<string>());
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
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

  const sortedPosts = sortLongFormPosts(posts, sortConfig);
  const filteredPosts = sortedPosts.filter((post) =>
    longFormMatchesSearch(post, searchTerm)
  );

  const requestSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const combinedContent = useMemo(
    () =>
      filteredPosts.map((post) =>
        longFormPostToCombinedContent(post as LongFormPostData)
      ),
    [filteredPosts]
  );

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

  const formatDate = (
    dateInput?: string | Date | number,
    _isUnixTimestamp = false
  ) => {
    if (!dateInput) return "—";

    // Handle different input formats
    try {
      let zonedDateTime;
      if (typeof dateInput === "string") {
        // Check if it's a Unix timestamp string
        const unixTimestamp = parseInt(dateInput, 10);
        if (!isNaN(unixTimestamp) && dateInput.length <= 13) {
          // Unix timestamp (seconds or milliseconds)
          const timestamp =
            dateInput.length <= 10 ? unixTimestamp : unixTimestamp;
          zonedDateTime = fromUnixTimestamp(
            dateInput.length <= 10 ? timestamp : Math.floor(timestamp / 1000),
            "UTC"
          );
        } else {
          // ISO string
          zonedDateTime = fromISOString(String(dateInput), "UTC");
        }
      } else if (typeof dateInput === "number") {
        // Unix timestamp (seconds or milliseconds)
        const timestamp =
          dateInput.toString().length <= 10
            ? dateInput
            : Math.floor(dateInput / 1000);
        zonedDateTime = fromUnixTimestamp(timestamp, "UTC");
      } else {
        // Date object
        zonedDateTime = fromDate(new Date(dateInput), "UTC");
      }

      // Convert to user's timezone for display
      const userZoned = zonedDateTime.withTimeZone(userTimezone);
      return formatForDisplay(
        userZoned,
        userTimezone,
        {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: userTimeFormat === "12h",
        },
        userTimeFormat,
        dateLocale
      );
    } catch (error) {
      handleErrorSafely(error, {
        component: "LongFormListing",
        action: "formatDate",
      });
      // Fallback to simple date formatting
      try {
        const dateObj =
          typeof dateInput === "string"
            ? new Date(dateInput)
            : typeof dateInput === "number"
              ? new Date(dateInput * 1000)
              : dateInput;
        return dateObj.toLocaleDateString(dateLocale, {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: userTimeFormat === "12h",
        });
      } catch {
        return "—";
      }
    }
  };

  const getReadingTime = (content?: string) => {
    if (!content) return "0 min read";
    try {
      const plain = stripMarkdownToPlainText(content);
      const wordCount = plain.trim().split(/\s+/).filter(Boolean).length;
      const readingTime = Math.ceil(wordCount / 200);
      return `${readingTime} min read`;
    } catch {
      return "— min read";
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map((post) => post.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkDeleteLongForm");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkDeleteFetcher.submit(formData, { method: "post" });
  };

  // Memoize post IDs to avoid infinite loops when posts array reference changes
  const postIds = useMemo(
    () => posts.map((post) => post.id).join(","),
    [posts]
  );

  // Countdown functionality for scheduled posts
  useEffect(() => {
    if (type !== "scheduled") return;

    const updateCountdowns = () => {
      // Get current time in user's timezone using Temporal
      const now = nowInTimezone(userTimezone);
      const newCountdowns: Record<string, string> = {};

      posts.forEach((post) => {
        const scheduledAtUtcRaw = (post as { scheduledAtUtc?: unknown })
          .scheduledAtUtc;
        const scheduledAtUtc =
          scheduledAtUtcRaw instanceof Date
            ? scheduledAtUtcRaw
            : typeof scheduledAtUtcRaw === "string"
              ? new Date(scheduledAtUtcRaw)
              : null;
        if (!scheduledAtUtc || isNaN(scheduledAtUtc.getTime())) return;

        try {
          const scheduledZoned = fromDate(scheduledAtUtc, "UTC");
          const scheduledInUserTz = scheduledZoned.withTimeZone(userTimezone);

          // Calculate difference
          const duration = difference(scheduledInUserTz, now);

          if (duration.sign === 1) {
            // Future time
            const days = Math.floor(duration.total({ unit: "days" }));
            const hours = Math.floor(duration.total({ unit: "hours" }) % 24);
            const minutes = Math.floor(
              duration.total({ unit: "minutes" }) % 60
            );
            newCountdowns[post.id] = `${days}d ${hours}h ${minutes}m`;
          } else {
            newCountdowns[post.id] = "Due now";
          }
        } catch {
          // If conversion fails, skip this post
          newCountdowns[post.id] = "Due now";
        }
      });

      setCountdowns((prev) => {
        // Only update if countdowns actually changed to prevent unnecessary re-renders
        const hasChanged =
          Object.keys(newCountdowns).some(
            (id) => prev[id] !== newCountdowns[id]
          ) || Object.keys(prev).length !== Object.keys(newCountdowns).length;

        return hasChanged ? newCountdowns : prev;
      });
    };

    // Update immediately on mount
    updateCountdowns();

    const timer = setInterval(updateCountdowns, 60000); // Update every minute

    return () => clearInterval(timer);
    // Use postIds instead of posts to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies are intentionally limited to avoid infinite loops
  }, [postIds, userTimezone, type]);

  useEffect(() => {
    if (bulkDeleteFetcher.data?.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data]);

  const getStatusBadge = (_post: LongFormPostType | LongFormPostData) => {
    if (type === "draft") {
      return (
        <div className="bg-muted text-foreground inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold">
          Draft
        </div>
      );
    } else if (type === "scheduled") {
      return (
        <div className="bg-muted text-foreground dark:border-border/75 dark:bg-primary/90/10 dark:text-foreground inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold">
          Scheduled
        </div>
      );
    } else {
      return (
        <div className="bg-success/20 text-success dark:border-success/75 dark:bg-success/10 dark:text-success inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold">
          Published
        </div>
      );
    }
  };

  return (
    <div>
      {/* Bulk Actions */}
      {selectedPosts.size > 0 ? (
        <div className="border-border bg-muted dark:border-border dark:bg-muted/50 mb-4 flex items-center justify-between rounded-lg border p-4">
          <span className="text-foreground dark:text-foreground text-sm font-medium">
            {selectedPosts.size} post{selectedPosts.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex gap-2">
            {type === "draft" ? (
              <Link
                to="/dashboard/newlongformpost"
                className="dark:bg-card border-border text-foreground hover:border-border hover:text-foreground focus:ring-ring/25 active:border-border dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-ring/40 dark:active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
              >
                Create New
              </Link>
            ) : null}
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteFetcher.state !== "idle"}
              className="dark:bg-card border-destructive text-destructive hover:border-destructive hover:text-destructive focus:ring-ring/25 active:border-destructive dark:border-destructive dark:text-destructive dark:hover:border-destructive dark:hover:text-destructive dark:focus:ring-ring/40 dark:active:border-destructive inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
            >
              {bulkDeleteFetcher.state !== "idle"
                ? "Deleting..."
                : `Delete ${selectedPosts.size} post${selectedPosts.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* Desktop: Posts Table (hidden on mobile) */}
      <div className="hidden md:block">
        <div className="dark:border-border bg-card border-border min-w-full overflow-x-auto rounded border bg-white">
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
                  <Checkbox
                    id="longform-select-all"
                    checked={
                      filteredPosts.length > 0
                        ? selectedPosts.size === filteredPosts.length
                        : false
                    }
                    onCheckedChange={() => toggleSelectAll()}
                  />
                </th>
                <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
                  Cover
                </th>
                <th
                  className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground cursor-pointer px-3 py-4 text-left font-semibold"
                  onClick={() => requestSort("title")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      requestSort("title");
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Sort by title"
                >
                  Title{" "}
                  {sortConfig.key === "title"
                    ? sortConfig.direction === "asc"
                      ? "↑"
                      : "↓"
                    : null}
                </th>
                <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
                  Summary
                </th>
                <th
                  className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground cursor-pointer px-3 py-4 text-left font-semibold"
                  onClick={() =>
                    requestSort(
                      type === "published"
                        ? "publishedAt"
                        : type === "scheduled"
                          ? "scheduledAtUtc"
                          : "createdAt"
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      requestSort(
                        type === "published"
                          ? "publishedAt"
                          : type === "scheduled"
                            ? "scheduledAtUtc"
                            : "createdAt"
                      );
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Sort by ${type === "published" ? "published date" : type === "scheduled" ? "scheduled date" : "created date"}`}
                >
                  {type === "published"
                    ? "Published"
                    : type === "scheduled"
                      ? "Scheduled For"
                      : "Created"}{" "}
                  {sortConfig.key ===
                  (type === "published"
                    ? "publishedAt"
                    : type === "scheduled"
                      ? "scheduledAtUtc"
                      : "createdAt")
                    ? sortConfig.direction === "asc"
                      ? "↑"
                      : "↓"
                    : null}
                </th>
                <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
                  Reading Time
                </th>
                {type === "scheduled" ? (
                  <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
                    Time Remaining
                  </th>
                ) : null}
                <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
                  Status
                </th>
                <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPosts.map((post) => (
                <tr
                  key={post.id}
                  className="dark:even:bg-muted/35 dark:hover:bg-muted even:bg-muted/50 hover:bg-muted cursor-pointer"
                  onClick={() => onPostSelect?.(post)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && onPostSelect) {
                      e.preventDefault();
                      onPostSelect(post);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${post.title ?? "post"}`}
                >
                  <td className="p-3 text-center">
                    <Checkbox
                      id={`longform-select-${post.id}`}
                      checked={selectedPosts.has(post.id)}
                      onCheckedChange={() => togglePostSelection(post.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="p-3">
                    {post.image ? (
                      <img
                        src={post.image}
                        alt="Cover"
                        className="h-12 w-16 rounded object-cover"
                      />
                    ) : (
                      <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-muted-foreground flex h-12 w-16 items-center justify-center rounded text-xs font-medium">
                        ARTICLE
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">
                      {post.title && post.title.length > 40
                        ? post.title.substring(0, 40) + "..."
                        : (post.title ?? "Untitled")}
                    </p>
                  </td>
                  <td className="max-w-xs p-3">
                    <p className="dark:text-muted-foreground text-foreground line-clamp-2 text-sm">
                      {post.summary && post.summary.length > 60
                        ? post.summary.substring(0, 60) + "..."
                        : (post.summary ?? "No summary")}
                    </p>
                  </td>
                  <td className="p-3">
                    {formatDate(
                      type === "published"
                        ? (post.publishedAt ?? undefined)
                        : type === "scheduled"
                          ? ((post as { scheduledAtUtc?: unknown })
                              .scheduledAtUtc as
                              | string
                              | Date
                              | number
                              | undefined)
                          : post.createdAt,
                      false
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className="dark:text-muted-foreground text-muted-foreground text-sm">
                      {getReadingTime(post.content ?? undefined)}
                    </span>
                  </td>
                  {type === "scheduled" ? (
                    <td className="p-3 text-center">
                      <div className="text-muted-foreground text-sm font-medium">
                        {countdowns[post.id] ?? "—"}
                      </div>
                    </td>
                  ) : null}
                  <td className="p-3 text-center">{getStatusBadge(post)}</td>
                  <td className="p-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="border-border bg-card text-foreground hover:bg-muted focus:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border focus:ring-2 focus:outline-none"
                          aria-label="Actions"
                        >
                          <MoreHorizontal className={INLINE_ICON_SIZE_CLASS} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {type === "draft" ? (
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/dashboard/drafts/longform/edit/${post.id}`}
                            >
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        {type === "scheduled" && onEditPost ? (
                          <>
                            <DropdownMenuItem onSelect={() => onEditPost(post)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => onReschedulePost?.(post)}
                            >
                              Reschedule
                            </DropdownMenuItem>
                            <deleteFetcher.Form method="post">
                              <input
                                type="hidden"
                                name="postId"
                                value={post.id}
                              />
                              <input
                                type="hidden"
                                name="_action"
                                value="moveToDraft"
                              />
                              <input
                                type="hidden"
                                name="type"
                                value="longform"
                              />
                              <DropdownMenuItem asChild>
                                <button
                                  type="submit"
                                  disabled={
                                    deleteFetcher.state !== "idle" ||
                                    bulkDeleteFetcher.state !== "idle"
                                  }
                                >
                                  {deleteFetcher.state !== "idle" &&
                                  deleteFetcher.formData?.get("_action") ===
                                    "moveToDraft" &&
                                  /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- formData can be undefined during submit */
                                  deleteFetcher.formData?.get("postId") ===
                                    post.id
                                    ? "Moving..."
                                    : "Move to drafts"}
                                </button>
                              </DropdownMenuItem>
                            </deleteFetcher.Form>
                          </>
                        ) : null}
                        {type === "published" &&
                        (post.nostrEventId ??
                          (post.signedEvent &&
                          typeof post.signedEvent === "object" &&
                          "id" in post.signedEvent
                            ? (post.signedEvent as { id?: string }).id
                            : undefined)) ? (
                          <>
                            <DropdownMenuItem asChild>
                              <Link
                                to={nostrUrls.articleUrl(
                                  String(
                                    post.nostrEventId ??
                                      (post.signedEvent &&
                                      typeof post.signedEvent === "object" &&
                                      "id" in post.signedEvent
                                        ? (post.signedEvent as { id?: string })
                                            .id
                                        : "") ??
                                      ""
                                  )
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View Article
                              </Link>
                            </DropdownMenuItem>
                            {longformRepostFetcher
                              ? (() => {
                                  const fetcher = longformRepostFetcher;
                                  const formData = getFetcherFormData(fetcher);
                                  return (
                                    <fetcher.Form method="post">
                                      <input
                                        type="hidden"
                                        name="postId"
                                        value={post.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="_action"
                                        value="longformRepost"
                                      />
                                      <DropdownMenuItem asChild>
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
                                      </DropdownMenuItem>
                                    </fetcher.Form>
                                  );
                                })()
                              : null}
                            {longformQuoteFetcher
                              ? (() => {
                                  const fetcher = longformQuoteFetcher;
                                  const formData = getFetcherFormData(fetcher);
                                  return (
                                    <fetcher.Form method="post">
                                      <input
                                        type="hidden"
                                        name="postId"
                                        value={post.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="_action"
                                        value="longformQuote"
                                      />
                                      <DropdownMenuItem asChild>
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
                                        >
                                          {fetcher.state !== "idle" &&
                                          (fetcher.formData
                                            ? (fetcher.formData.get(
                                                "postId"
                                              ) as string | null) === post.id
                                            : false)
                                            ? "Quoting..."
                                            : "Quote Post"}
                                        </button>
                                      </DropdownMenuItem>
                                    </fetcher.Form>
                                  );
                                })()
                              : null}
                          </>
                        ) : null}
                        <DropdownMenuSeparator />
                        <deleteFetcher.Form method="post">
                          <input type="hidden" name="postId" value={post.id} />
                          <input
                            type="hidden"
                            name="_action"
                            value="deleteLongForm"
                          />
                          <DropdownMenuItem asChild>
                            <button
                              type="submit"
                              disabled={
                                deleteFetcher.state !== "idle" ||
                                bulkDeleteFetcher.state !== "idle"
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              {deleteFetcher.state !== "idle" &&
                              deleteFetcher.formData?.get("postId") === post.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </DropdownMenuItem>
                        </deleteFetcher.Form>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: virtualized longform card list */}
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
                sortConfig.key === "title"
                  ? `title-${sortConfig.direction}`
                  : `date-${sortConfig.direction}`
              }
              onValueChange={(value) => {
                if (
                  value === "date-asc" ||
                  value === "date-desc" ||
                  value === "title-asc" ||
                  value === "title-desc"
                ) {
                  const [key, dir] = value.split("-") as [
                    string,
                    "asc" | "desc",
                  ];
                  setSortConfig({
                    key: key === "date" ? getDefaultSortKey(type) : "title",
                    direction: dir,
                  });
                }
              }}
            >
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
              ref={(el) => {
                mobileScrollContainerRef.current = el;
                onScrollContainerReady?.(el ?? null);
              }}
              className="mt-2 min-h-0 flex-1 overflow-auto"
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
                            type={type}
                            userTimezone={userTimezone}
                            userTimeFormat={userTimeFormat}
                            showBulkActions={true}
                            selectedItems={selectedPosts}
                            onToggleSelection={togglePostSelection}
                            onPostSelect={(content) =>
                              onPostSelect?.(
                                content.originalData as LongFormPostData
                              )
                            }
                            onEditPost={
                              onEditPost
                                ? (post) =>
                                    onEditPost(
                                      post as
                                        | LongFormPostType
                                        | LongFormPostData
                                    )
                                : undefined
                            }
                            onReschedulePost={
                              onReschedulePost
                                ? (post) =>
                                    onReschedulePost(
                                      post as
                                        | LongFormPostType
                                        | LongFormPostData
                                    )
                                : undefined
                            }
                            deleteFetcher={
                              deleteFetcher as Parameters<
                                typeof ContentListCard
                              >[0]["deleteFetcher"]
                            }
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
              className="mt-2"
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
                      deleteFetcher={
                        deleteFetcher as Parameters<
                          typeof ContentListCard
                        >[0]["deleteFetcher"]
                      }
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
