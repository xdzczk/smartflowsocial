import { useFetcher, Link } from "@remix-run/react";
import type { FetcherWithComponents } from "@remix-run/react";
import { useState, useEffect } from "react";

import type { PostFetcher } from "~/features/posts/types";
import type { EditorJSBlock } from "~/features/posts/types/editorjs.types";
import type { LongFormPost } from "~/models/longformpost.server";

interface LongFormListingProps {
  posts: LongFormPost[];
  type: "draft" | "scheduled" | "posted";
  onPostSelect?: (post: LongFormPost) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  userTimezone?: string;
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  onEditPost?: (post: LongFormPost) => void;
  onReschedulePost?: (post: LongFormPost) => void;
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
    key:
      type === "posted"
        ? "publishedAt"
        : type === "scheduled"
          ? "scheduledFor"
          : "createdAt",
    direction:
      type === "posted" ? "desc" : type === "scheduled" ? "asc" : "desc",
  });
  const [selectedPosts, setSelectedPosts] = useState(new Set<string>());
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();

  const sortedPosts = [...posts].sort((a, b) => {
    let aValue, bValue;

    if (sortConfig.key === "publishedAt") {
      aValue = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      bValue = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    } else if (sortConfig.key === "scheduledFor") {
      // Handle scheduledFor as Unix timestamp string
      aValue = a.scheduledFor ? parseInt(a.scheduledFor) * 1000 : 0;
      bValue = b.scheduledFor ? parseInt(b.scheduledFor) * 1000 : 0;
    } else if (sortConfig.key === "createdAt") {
      aValue = new Date(a.createdAt).getTime();
      bValue = new Date(b.createdAt).getTime();
    } else {
      aValue = a[sortConfig.key as keyof LongFormPost] || "";
      bValue = b[sortConfig.key as keyof LongFormPost] || "";

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
    }

    return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
  });

  const filteredPosts = sortedPosts.filter(
    (post) =>
      post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.summary?.toLowerCase().includes(searchTerm.toLowerCase()),
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

    let date: Date;

    // Handle different input formats
    if (typeof dateInput === "string") {
      // Check if it's a Unix timestamp string
      const unixTimestamp = parseInt(dateInput);
      if (!isNaN(unixTimestamp) && dateInput.length <= 13) {
        // Unix timestamp (seconds or milliseconds)
        date = new Date(unixTimestamp * (dateInput.length <= 10 ? 1000 : 1));
      } else {
        // ISO string
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === "number") {
      // Unix timestamp (seconds or milliseconds)
      date = new Date(
        dateInput * (dateInput.toString().length <= 10 ? 1000 : 1),
      );
    } else {
      // Date object
      date = new Date(dateInput);
    }

    return date.toLocaleString("en-US", {
      timeZone: userTimezone,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getReadingTime = (content?: string) => {
    if (!content) return "0 min read";

    try {
      let wordCount = 0;

      // If it's JSON (EditorJS format), extract text from blocks
      if (content.startsWith("{")) {
        const editorData = JSON.parse(content);
        editorData.blocks?.forEach((block: EditorJSBlock) => {
          if (block.type === "paragraph" || block.type === "header") {
            const text = block.data.text?.replace(/<[^>]*>/g, "") || "";
            wordCount += text
              .split(/\s+/)
              .filter((word) => word.length > 0).length;
          } else if (block.type === "list") {
            block.data.items?.forEach((item: string) => {
              const text = item.replace(/<[^>]*>/g, "");
              wordCount += text
                .split(/\s+/)
                .filter((word) => word.length > 0).length;
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

  // Countdown functionality for scheduled posts
  useEffect(() => {
    if (type !== "scheduled") return;

    const updateCountdowns = () => {
      // Get current time in user's timezone
      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: userTimezone }),
      ).getTime();
      const newCountdowns: Record<string, string> = {};

      posts.forEach((post) => {
        if (!post.scheduledFor) return;

        // Handle scheduledFor as Unix timestamp string (similar to regular posts)
        const utcTime = parseInt(post.scheduledFor) * 1000;
        const userTime = new Date(utcTime).toLocaleString("en-US", {
          timeZone: userTimezone,
        });
        const scheduledTime = new Date(userTime).getTime();

        const distance = scheduledTime - now;

        if (distance > 0) {
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          );
          const minutes = Math.floor(
            (distance % (1000 * 60 * 60)) / (1000 * 60),
          );

          newCountdowns[post.id] = `${days}d ${hours}h ${minutes}m`;
        } else {
          newCountdowns[post.id] = "Due now";
        }
      });

      setCountdowns(newCountdowns);
    };

    // Update immediately on mount
    updateCountdowns();

    const timer = setInterval(updateCountdowns, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [posts, userTimezone, type]);

  useEffect(() => {
    if (bulkDeleteFetcher.data?.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data]);

  const getStatusBadge = (post: LongFormPost) => {
    if (type === "draft") {
      return (
        <div className="inline-flex rounded-full border border-transparent bg-orange-100 px-2 py-1 text-xs font-semibold leading-4 text-orange-900 dark:border-orange-900/75 dark:bg-orange-700/10 dark:text-orange-200">
          Draft
        </div>
      );
    } else if (type === "scheduled") {
      return (
        <div className="inline-flex rounded-full border border-transparent bg-blue-100 px-2 py-1 text-xs font-semibold leading-4 text-blue-900 dark:border-blue-900/75 dark:bg-blue-700/10 dark:text-blue-200">
          Scheduled
        </div>
      );
    } else {
      return (
        <div className="inline-flex rounded-full border border-transparent bg-green-100 px-2 py-1 text-xs font-semibold leading-4 text-green-900 dark:border-green-900/75 dark:bg-green-700/10 dark:text-green-200">
          Published
        </div>
      );
    }
  };

  return (
    <div>
      {/* Search Bar */}
      {onSearchChange ? (
        <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
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
                className="block w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
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
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
              >
                Create New
              </Link>
            ) : null}
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteFetcher.state !== "idle"}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
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
        <table className="min-w-full whitespace-nowrap align-middle text-sm">
          <thead>
            <tr>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                <input
                  type="checkbox"
                  checked={
                    filteredPosts.length > 0
                      ? selectedPosts.size === filteredPosts.length
                      : null
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
                        : "createdAt",
                  )
                }
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
                    {post.title?.length > 40
                      ? post.title.substring(0, 40) + "..."
                      : post.title || "Untitled"}
                  </p>
                </td>
                <td className="max-w-xs p-3">
                  <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                    {post.summary?.length > 60
                      ? post.summary.substring(0, 60) + "..."
                      : post.summary || "No summary"}
                  </p>
                </td>
                <td className="p-3">
                  {formatDate(
                    type === "posted"
                      ? post.publishedAt
                      : type === "scheduled"
                        ? post.scheduledFor
                        : post.createdAt,
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {getReadingTime(post.content)}
                  </span>
                </td>
                {type === "scheduled" ? (
                  <td className="p-3 text-center">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {countdowns[post.id] || "—"}
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
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
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
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReschedulePost(post);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                        >
                          Reschedule
                        </button>
                      </>
                    ) : null}
                    {type === "posted" &&
                    (post.nostrEventId || post.signedEvent?.id) ? (
                      <>
                        <Link
                          to={`https://primal.net/a/${post.nostrEventId || post.signedEvent?.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
                        >
                          View Article
                        </Link>
                        {longformRepostFetcher ? (
                          <longformRepostFetcher.Form
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
                                longformRepostFetcher.state !== "idle" ||
                                longformRepostFetcher.formData?.get(
                                  "postId",
                                ) === post.id
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                            >
                              {longformRepostFetcher.state !== "idle" &&
                              longformRepostFetcher.formData?.get("postId") ===
                                post.id
                                ? "Reposting..."
                                : "Repost"}
                            </button>
                          </longformRepostFetcher.Form>
                        ) : null}
                        {longformQuoteFetcher ? (
                          <longformQuoteFetcher.Form
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
                                longformQuoteFetcher.state !== "idle" ||
                                longformQuoteFetcher.formData?.get("postId") ===
                                  post.id
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                            >
                              {longformQuoteFetcher.state !== "idle" &&
                              longformQuoteFetcher.formData?.get("postId") ===
                                post.id
                                ? "Quoting..."
                                : "Quote Post"}
                            </button>
                          </longformQuoteFetcher.Form>
                        ) : null}
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
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
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
