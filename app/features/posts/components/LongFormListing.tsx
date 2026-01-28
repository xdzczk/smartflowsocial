import { useFetcher, Link } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";

import type { LongFormPostType } from "~/features/posts/server";
import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  difference,
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  nowInTimezone,
} from "~/lib/temporal";

import type { PostFetcher, LongFormPostData } from "../types";
import type { EditorJSBlock } from "../types/editorjs.types";

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
  type: "draft" | "scheduled" | "posted";
  onPostSelect?: (post: LongFormPostType | LongFormPostData) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  onEditPost?: (post: LongFormPostType | LongFormPostData) => void;
  onReschedulePost?: (post: LongFormPostType | LongFormPostData) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultSortKey(type: "draft" | "scheduled" | "posted"): string {
  if (type === "posted") {
    return "publishedAt";
  }
  if (type === "scheduled") {
    return "scheduledAtUtc";
  }
  return "createdAt";
}

function getDefaultSortDirection(
  type: "draft" | "scheduled" | "posted"
): "asc" | "desc" {
  if (type === "posted") {
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

export default function LongFormListing({
  posts,
  type,
  onPostSelect,
  searchTerm = "",
  onSearchChange,
  userTimezone = "UTC",
  userTimeFormat = "12h",
  longformRepostFetcher,
  longformQuoteFetcher,
  onEditPost,
  onReschedulePost,
}: LongFormListingProps) {
  const [sortConfig, setSortConfig] = useState({
    key: getDefaultSortKey(type),
    direction: getDefaultSortDirection(type),
  });
  const [selectedPosts, setSelectedPosts] = useState(new Set<string>());
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const deleteFetcher = useFetcher();
  interface BulkDeleteFetcherData {
    success?: boolean;
  }
  const bulkDeleteFetcher = useFetcher<BulkDeleteFetcherData>();

  const sortedPosts = sortLongFormPosts(posts, sortConfig);

  const filteredPosts = sortedPosts.filter(
    (post) =>
      post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ??
      post.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const requestSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

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
        userTimeFormat
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
        return dateObj.toLocaleDateString("en-US", {
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
      let wordCount = 0;

      // If it's JSON (EditorJS format), extract text from blocks
      if (content.startsWith("{")) {
        const editorData = JSON.parse(content) as { blocks?: EditorJSBlock[] };
        editorData.blocks?.forEach((block: EditorJSBlock) => {
          if (block.type === "paragraph" || block.type === "header") {
            const text =
              typeof block.data["text"] === "string"
                ? block.data["text"].replace(/<[^>]*>/g, "")
                : "";
            wordCount += text
              .split(/\s+/)
              .filter((word: string) => word.length > 0).length;
          } else if (block.type === "list") {
            const items = Array.isArray(block.data["items"])
              ? block.data["items"]
              : [];
            items.forEach((item: unknown) => {
              const text =
                typeof item === "string" ? item.replace(/<[^>]*>/g, "") : "";
              wordCount += text
                .split(/\s+/)
                .filter((word: string) => word.length > 0).length;
            });
          }
        });
      } else {
        // Plain text or markdown
        const text = content.replace(/<[^>]*>/g, "");
        wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
      }

      const readingTime = Math.ceil(wordCount / 200); // Average 200 words per minute
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
      {/* Search Bar */}
      {onSearchChange ? (
        <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <h4 className="text-muted-foreground dark:text-foreground text-sm font-medium">
              You have{" "}
              <span className="text-muted-foreground">
                {filteredPosts.length} longform {type} posts
              </span>
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 my-px ml-px flex w-10 items-center justify-center rounded-l">
                <svg
                  className="hi-mini hi-magnifying-glass inline-block size-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="dark:border-border dark:bg-card dark:focus:border-primary border-border placeholder-muted-foreground focus:border-primary focus:ring-primary/50 block w-full rounded-lg border py-2 pr-3 pl-10 text-sm leading-6 focus:ring"
                placeholder="Search longform posts..."
              />
            </div>
          </div>
        </div>
      ) : null}

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
                className="dark:bg-card border-border text-foreground hover:border-border hover:text-foreground focus:ring-primary/25 active:border-border dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-primary/40 dark:active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
              >
                Create New
              </Link>
            ) : null}
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteFetcher.state !== "idle"}
              className="dark:bg-card border-destructive text-destructive hover:border-destructive hover:text-destructive focus:ring-destructive/25 active:border-destructive dark:border-destructive dark:text-destructive dark:hover:border-destructive dark:hover:text-destructive dark:focus:ring-destructive/40 dark:active:border-destructive inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
            >
              {bulkDeleteFetcher.state !== "idle"
                ? "Deleting..."
                : `Delete ${selectedPosts.size} post${selectedPosts.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* Posts Table */}
      <div className="dark:border-border bg-card border-border min-w-full overflow-x-auto rounded border bg-white">
        <table className="min-w-full align-middle text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
                <input
                  id="longform-select-all"
                  name="longform-select-all"
                  type="checkbox"
                  checked={
                    filteredPosts.length > 0
                      ? selectedPosts.size === filteredPosts.length
                      : false
                  }
                  onChange={toggleSelectAll}
                  className="dark:border-border dark:bg-card border-border accent-checkbox focus:ring-checkbox h-4 w-4 rounded"
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
                    type === "posted"
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
                      type === "posted"
                        ? "publishedAt"
                        : type === "scheduled"
                          ? "scheduledAtUtc"
                          : "createdAt"
                    );
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Sort by ${type === "posted" ? "published date" : type === "scheduled" ? "scheduled date" : "created date"}`}
              >
                {type === "posted"
                  ? "Published"
                  : type === "scheduled"
                    ? "Scheduled For"
                    : "Created"}{" "}
                {sortConfig.key ===
                (type === "posted"
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
                  <input
                    id={`longform-select-${post.id}`}
                    name={`longform-select-${post.id}`}
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => togglePostSelection(post.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="dark:border-border dark:bg-card border-border accent-checkbox focus:ring-checkbox h-4 w-4 rounded"
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
                    type === "posted"
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
                  <div className="flex justify-center gap-2">
                    {type === "draft" ? (
                      <Link
                        to={`/dashboard/drafts/longform/edit/${post.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="dark:bg-card border-border text-foreground hover:border-border hover:text-foreground focus:ring-primary/25 active:border-border dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-primary/40 dark:active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
                      >
                        Edit
                      </Link>
                    ) : null}
                    {type === "scheduled" && onEditPost ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPost(post);
                          }}
                          className="dark:bg-card border-border text-foreground hover:border-border hover:text-foreground focus:ring-primary/25 active:border-border dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-primary/40 dark:active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onReschedulePost) {
                              onReschedulePost(post);
                            }
                          }}
                          className="dark:bg-card border-success text-success hover:border-success hover:text-success focus:ring-success/25 active:border-success dark:border-success dark:text-success dark:hover:border-success dark:hover:text-success dark:focus:ring-success/40 dark:active:border-success inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
                        >
                          Reschedule
                        </button>
                      </>
                    ) : null}
                    {type === "posted" &&
                    (post.nostrEventId ??
                      (post.signedEvent &&
                      typeof post.signedEvent === "object" &&
                      "id" in post.signedEvent
                        ? (post.signedEvent as { id?: string }).id
                        : undefined)) ? (
                      <>
                        <Link
                          to={`https://primal.net/a/${String(post.nostrEventId ?? (post.signedEvent && typeof post.signedEvent === "object" && "id" in post.signedEvent ? (post.signedEvent as { id?: string }).id : "") ?? "")}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
                        >
                          View Article
                        </Link>
                        {longformRepostFetcher
                          ? (() => {
                              const fetcher = longformRepostFetcher;
                              const formData = getFetcherFormData(fetcher);
                              return (
                                <fetcher.Form
                                  method="post"
                                  onClick={(e) => e.stopPropagation()}
                                >
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
                                    className="dark:bg-card border-border text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
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
                                </fetcher.Form>
                              );
                            })()
                          : null}
                        {longformQuoteFetcher
                          ? (() => {
                              const fetcher = longformQuoteFetcher;
                              const formData = getFetcherFormData(fetcher);
                              return (
                                <fetcher.Form
                                  method="post"
                                  onClick={(e) => e.stopPropagation()}
                                >
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
                                    className="dark:bg-card border-success text-success hover:border-success hover:text-success focus:ring-success/25 active:border-success dark:border-success dark:text-success dark:hover:border-success dark:hover:text-success dark:focus:ring-success/40 dark:active:border-success inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
                                  >
                                    {fetcher.state !== "idle" &&
                                    (fetcher.formData
                                      ? (fetcher.formData.get("postId") as
                                          | string
                                          | null) === post.id
                                      : false)
                                      ? "Quoting..."
                                      : "Quote Post"}
                                  </button>
                                </fetcher.Form>
                              );
                            })()
                          : null}
                      </>
                    ) : null}
                    <deleteFetcher.Form
                      method="post"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="postId" value={post.id} />
                      <input
                        type="hidden"
                        name="_action"
                        value="deleteLongForm"
                      />
                      <button
                        type="submit"
                        disabled={
                          deleteFetcher.state !== "idle" ||
                          bulkDeleteFetcher.state !== "idle"
                        }
                        className="dark:bg-card border-destructive text-destructive hover:border-destructive hover:text-destructive focus:ring-destructive/25 active:border-destructive dark:border-destructive dark:text-destructive dark:hover:border-destructive dark:hover:text-destructive dark:focus:ring-destructive/40 dark:active:border-destructive inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
                      >
                        {deleteFetcher.state !== "idle" &&
                        deleteFetcher.formData?.get("postId") === post.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </deleteFetcher.Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
