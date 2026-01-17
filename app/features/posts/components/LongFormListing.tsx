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
    return "scheduledFor";
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
    if (key === "scheduledFor") {
      if (!post.scheduledFor) return 0;
      const timestamp = parseInt(post.scheduledFor, 10);
      if (isNaN(timestamp)) return 0;
      const zoned = fromUnixTimestamp(timestamp, "UTC");
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

  const formatDate = (dateInput?: string | Date | number) => {
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
      return formatForDisplay(userZoned, userTimezone, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
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
          hour12: true,
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
        if (!post.scheduledFor) return;

        try {
          // Handle scheduledFor as Unix timestamp string
          const timestamp = parseInt(post.scheduledFor, 10);
          if (isNaN(timestamp)) return;

          const scheduledZoned = fromUnixTimestamp(timestamp, "UTC");
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
        <div className="inline-flex rounded-full border border-transparent bg-orange-100 px-2 py-1 text-xs leading-4 font-semibold text-orange-900 dark:border-orange-900/75 dark:bg-orange-700/10 dark:text-orange-200">
          Draft
        </div>
      );
    } else if (type === "scheduled") {
      return (
        <div className="inline-flex rounded-full border border-transparent bg-blue-100 px-2 py-1 text-xs leading-4 font-semibold text-blue-900 dark:border-blue-900/75 dark:bg-blue-700/10 dark:text-blue-200">
          Scheduled
        </div>
      );
    } else {
      return (
        <div className="inline-flex rounded-full border border-transparent bg-green-100 px-2 py-1 text-xs leading-4 font-semibold text-green-900 dark:border-green-900/75 dark:bg-green-700/10 dark:text-green-200">
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
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              You have{" "}
              <span className="text-blue-600 dark:text-blue-400">
                {filteredPosts.length} longform {type} posts
              </span>
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 my-px ml-px flex w-10 items-center justify-center rounded-l text-gray-500">
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
                className="block w-full rounded-lg border border-gray-200 py-2 pr-3 pl-10 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                placeholder="Search longform posts..."
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Bulk Actions */}
      {selectedPosts.size > 0 ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/50">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {selectedPosts.size} post{selectedPosts.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex gap-2">
            {type === "draft" ? (
              <Link
                to="/dashboard/newlongformpost"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
              >
                Create New
              </Link>
            ) : null}
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteFetcher.state !== "idle"}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
            >
              {bulkDeleteFetcher.state !== "idle"
                ? "Deleting..."
                : `Delete ${selectedPosts.size} post${selectedPosts.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* Posts Table */}
      <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full align-middle text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                <input
                  type="checkbox"
                  checked={
                    filteredPosts.length > 0
                      ? selectedPosts.size === filteredPosts.length
                      : false
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Cover
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
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
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Summary
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() =>
                  requestSort(
                    type === "posted"
                      ? "publishedAt"
                      : type === "scheduled"
                        ? "scheduledFor"
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
                          ? "scheduledFor"
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
                    ? "scheduledFor"
                    : "createdAt")
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Reading Time
              </th>
              {type === "scheduled" ? (
                <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                  Time Remaining
                </th>
              ) : null}
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Status
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredPosts.map((post) => (
              <tr
                key={post.id}
                className="cursor-pointer even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
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
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => togglePostSelection(post.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
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
                    <div className="flex h-12 w-16 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
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
                  <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
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
                        ? (post.scheduledFor ?? undefined)
                        : post.createdAt
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {getReadingTime(post.content ?? undefined)}
                  </span>
                </td>
                {type === "scheduled" ? (
                  <td className="p-3 text-center">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
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
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
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
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
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
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
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
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
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
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
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
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm leading-5 font-semibold text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
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
