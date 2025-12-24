import { useFetcher, Link } from "@remix-run/react";
import { useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { handleErrorSafely } from "~/lib/error-handler.client";
import type { CombinedContent } from "~/features/posts/combined.server";
import { getQueueColor } from "~/features/posts/queueColors";

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
  individualRepostFetcher?: any;
  longformRepostFetcher?: any;
  longformQuoteFetcher?: any;
  onBulkRepost?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  repostFetcher?: any;
  // Edit and reschedule actions for scheduled content
  onEditPost?: (post: any) => void;
  onReschedulePost?: (post: any) => void;
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

  const formatDate = (
    date: Date | string | undefined,
    isUnixTimestamp = false,
  ) => {
    if (!date) return "-";

    let dateObj: Date;
    if (isUnixTimestamp && typeof date === "string") {
      dateObj = new Date(parseInt(date) * 1000);
    } else {
      dateObj = new Date(date);
    }

    return dateObj.toLocaleString("en-US", {
      timeZone: userTimezone || "UTC",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getImageUrls = (fileUrl: string[] | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]);
      } catch (e) {
        handleErrorSafely(e, {
          component: "AllContentListing",
          action: "parseFileUrl",
        });
        return [];
      }
    }

    return fileUrl;
  };

  const getContentTitle = (item: CombinedContent) => {
    if (item.type === "longform") {
      return item.title || "Untitled Article";
    }
    return item.caption?.length && item.caption.length > 50
      ? item.caption.substring(0, 50) + "..."
      : item.caption || "No caption";
  };

  const getContentPreview = (item: CombinedContent) => {
    if (item.type === "longform") {
      return (
        item.summary ||
        (item.content?.length && item.content.length > 100
          ? item.content.substring(0, 100) + "..."
          : item.content) ||
        "No content"
      );
    }
    return null; // Posts show caption in title column
  };

  const getStatusColor = (item: CombinedContent) => {
    if (item.draft) {
      return "bg-orange-100 text-orange-900 dark:border-orange-900/75 dark:bg-orange-700/10 dark:text-orange-200";
    }
    if (item.isPosted || item.isPublished) {
      return "bg-green-100 text-green-900 dark:border-green-900/75 dark:bg-green-700/10 dark:text-green-200";
    }
    if (item.isScheduled) {
      return "bg-blue-100 text-blue-900 dark:border-blue-900/75 dark:bg-blue-700/10 dark:text-blue-200";
    }
    return "bg-gray-100 text-gray-900 dark:border-gray-900/75 dark:bg-gray-700/10 dark:text-gray-200";
  };

  const getStatusText = (item: CombinedContent) => {
    if (item.draft) return "Draft";
    if (item.isPosted || item.isPublished) return "Posted";
    if (item.isScheduled) return "Scheduled";
    return "Unknown";
  };

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-4 flex items-center gap-2">
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
            id="search"
            name="search"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
            placeholder="Search content..."
          />
        </div>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && selectedItems.size > 0 ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/50">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex gap-2">
            {type === "posted" ? (
              <>
                <button
                  onClick={onBulkRepost}
                  disabled={
                    repostFetcher ? repostFetcher.state !== "idle" : null
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                >
                  {repostFetcher && repostFetcher.state !== "idle"
                    ? "Processing..."
                    : `Recycle ${selectedItems.size} Item${selectedItems.size !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={onBulkScheduledRepost}
                  disabled={
                    repostFetcher ? repostFetcher.state !== "idle" : null
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                >
                  {repostFetcher && repostFetcher.state !== "idle"
                    ? "Processing..."
                    : `Repost ${selectedItems.size} Item${selectedItems.size !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={onBulkQuote}
                  disabled={
                    repostFetcher ? repostFetcher.state !== "idle" : null
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                >
                  {repostFetcher && repostFetcher.state !== "idle"
                    ? "Processing..."
                    : `Quote ${selectedItems.size} Item${selectedItems.size !== 1 ? "s" : ""}`}
                </button>
              </>
            ) : null}
            <button
              onClick={onBulkDelete}
              disabled={bulkDeleteState !== "idle"}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
            >
              {bulkDeleteState !== "idle"
                ? "Deleting..."
                : `Delete ${selectedItems.size} item${selectedItems.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* Content Table */}
      <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full whitespace-nowrap align-middle text-sm">
          <thead>
            <tr>
              {showBulkActions ? (
                <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                  <input
                    type="checkbox"
                    checked={
                      filteredContent.length > 0
                        ? selectedItems.size === filteredContent.length
                        : null
                    }
                    onChange={onToggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </th>
              ) : null}
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Type
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Media
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("caption")}
              >
                Title/Caption{" "}
                {sortConfig.key === "caption"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Preview
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() =>
                  requestSort(
                    type === "posted"
                      ? "postedAt"
                      : type === "scheduled"
                        ? "scheduledFor"
                        : "createdAt",
                  )
                }
              >
                {type === "posted"
                  ? "Posted At"
                  : type === "scheduled"
                    ? "Scheduled For"
                    : "Created At"}{" "}
                {sortConfig.key ===
                (type === "posted"
                  ? "postedAt"
                  : type === "scheduled"
                    ? "scheduledFor"
                    : "createdAt")
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Queue
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Status
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredContent.map((item) => (
              <tr
                key={`${item.type}-${item.id}`}
                className="cursor-pointer even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
                onClick={() => onPostSelect?.(item)}
              >
                {showBulkActions ? (
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => onToggleSelection?.(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </td>
                ) : null}
                <td className="p-3">
                  {(() => {
                    // Check for kind property in signedEvent or originalData.signedEvent
                    const kind =
                      item.signedEvent?.kind ||
                      item.originalData?.signedEvent?.kind;

                    if (kind === 6) {
                      return (
                        <span className="inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          REPOST
                        </span>
                      );
                    } else if (kind === 30023) {
                      return (
                        <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          LONG-FORM
                        </span>
                      );
                    } else {
                      // Default behavior for other types
                      return (
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            item.type === "post"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          }`}
                        >
                          {item.type === "post" ? "Post" : "Article"}
                        </span>
                      );
                    }
                  })()}
                </td>
                <td className="p-3">
                  {(() => {
                    // For posts, get the first valid image URL
                    if (
                      item.type === "post" &&
                      item.fileUrl &&
                      item.fileUrl.length > 0
                    ) {
                      const imageUrls = getImageUrls(item.fileUrl);
                      const firstImageUrl =
                        imageUrls.length > 0 ? imageUrls[0] : null;

                      if (firstImageUrl) {
                        return (
                          <MediaThumbnail
                            src={firstImageUrl}
                            alt="Post preview"
                            className="h-12 w-12 rounded object-cover"
                            fallback={
                              <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                                TEXT
                              </div>
                            }
                          />
                        );
                      }
                    }

                    // For longform posts with images
                    if (item.type === "longform" && item.image) {
                      return (
                        <MediaThumbnail
                          src={item.image}
                          alt="Article cover"
                          className="h-12 w-12 rounded object-cover"
                          fallback={
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                              ART
                            </div>
                          }
                        />
                      );
                    }

                    // Default fallback based on content type
                    return (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        {item.type === "post" ? "TEXT" : "ART"}
                      </div>
                    );
                  })()}
                </td>
                <td className="p-3">
                  <p className="font-medium">{getContentTitle(item)}</p>
                </td>
                <td className="p-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {getContentPreview(item)?.slice(0, 20)}
                    {getContentPreview(item)?.length > 20 ? "…" : ""}
                  </p>
                </td>
                <td className="p-3">
                  {type === "scheduled"
                    ? formatDate(item.scheduledFor, true)
                    : type === "posted"
                      ? formatDate(item.postedAt)
                      : formatDate(item.createdAt)}
                </td>
                <td className="p-3 text-center">
                  {item.queueType?.color ? (
                    <div
                      className="inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 shadow-sm"
                      style={{
                        backgroundColor: `${item.queueType.color}20`,
                        color: item.queueType.color,
                        borderColor: item.queueType.color,
                      }}
                    >
                      {item.queueType?.name || "unassigned"}
                    </div>
                  ) : (
                    <div
                      className={`inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 ${getQueueColor(item.queueType?.name || "unassigned").bg} ${getQueueColor(item.queueType?.name || "unassigned").text} ${getQueueColor(item.queueType?.name || "unassigned").border} shadow-sm`}
                    >
                      {item.queueType?.name || "unassigned"}
                    </div>
                  )}
                </td>
                <td className="p-3 text-center">
                  <div
                    className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs font-semibold leading-4 ${getStatusColor(item)}`}
                  >
                    {getStatusText(item)}
                  </div>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {type === "posted" ? (
                      <>
                        {/* View Link - different for posts vs longform */}
                        {item.type === "post" &&
                        item.originalData?.signedEvent?.id ? (
                          <Link
                            to={`https://primal.net/e/${item.originalData.signedEvent.id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
                          >
                            View Note
                          </Link>
                        ) : null}
                        {item.type === "longform" &&
                        (item.originalData?.nostrEventId ||
                          item.originalData?.signedEvent?.id) ? (
                          <Link
                            to={`https://primal.net/a/${item.originalData.nostrEventId || item.originalData.signedEvent?.id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
                          >
                            View Article
                          </Link>
                        ) : null}

                        {/* Post Actions - Regular posts */}
                        {item.type === "post" && individualRepostFetcher ? (
                          <>
                            <individualRepostFetcher.Form
                              method="post"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="hidden"
                                name="postId"
                                value={item.id}
                              />
                              <input
                                type="hidden"
                                name="_action"
                                value="repost"
                              />
                              <button
                                type="submit"
                                disabled={
                                  individualRepostFetcher.state !== "idle" ||
                                  individualRepostFetcher.formData?.get(
                                    "postId",
                                  ) === item.id
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                              >
                                {individualRepostFetcher.state !== "idle" &&
                                individualRepostFetcher.formData?.get(
                                  "postId",
                                ) === item.id
                                  ? "Reposting..."
                                  : "Repost"}
                              </button>
                            </individualRepostFetcher.Form>
                            <individualRepostFetcher.Form
                              method="post"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="hidden"
                                name="postId"
                                value={item.id}
                              />
                              <input
                                type="hidden"
                                name="_action"
                                value="quote"
                              />
                              <button
                                type="submit"
                                disabled={
                                  individualRepostFetcher.state !== "idle" ||
                                  individualRepostFetcher.formData?.get(
                                    "postId",
                                  ) === item.id
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                              >
                                {individualRepostFetcher.state !== "idle" &&
                                individualRepostFetcher.formData?.get(
                                  "postId",
                                ) === item.id
                                  ? "Quoting..."
                                  : "Quote Post"}
                              </button>
                            </individualRepostFetcher.Form>
                          </>
                        ) : null}

                        {/* Longform Actions */}
                        {item.type === "longform" && longformRepostFetcher ? (
                          <longformRepostFetcher.Form
                            method="post"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="hidden"
                              name="postId"
                              value={item.id}
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
                                ) === item.id
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                            >
                              {longformRepostFetcher.state !== "idle" &&
                              longformRepostFetcher.formData?.get("postId") ===
                                item.id
                                ? "Reposting..."
                                : "Repost"}
                            </button>
                          </longformRepostFetcher.Form>
                        ) : null}
                        {item.type === "longform" && longformQuoteFetcher ? (
                          <longformQuoteFetcher.Form
                            method="post"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="hidden"
                              name="postId"
                              value={item.id}
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
                                  item.id
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                            >
                              {longformQuoteFetcher.state !== "idle" &&
                              longformQuoteFetcher.formData?.get("postId") ===
                                item.id
                                ? "Quoting..."
                                : "Quote Post"}
                            </button>
                          </longformQuoteFetcher.Form>
                        ) : null}
                      </>
                    ) : null}
                    {/* Edit and Reschedule actions - only for scheduled content */}
                    {type === "scheduled" ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPost?.(item.originalData);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReschedulePost?.(item.originalData);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                        >
                          Reschedule
                        </button>
                      </>
                    ) : null}

                    {/* Delete action - always available */}
                    <deleteFetcher.Form
                      method="post"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="postId" value={item.id} />
                      <input
                        type="hidden"
                        name="_action"
                        value={
                          item.type === "post" ? "delete" : "deleteLongForm"
                        }
                      />
                      <button
                        type="submit"
                        disabled={deleteFetcher.state !== "idle"}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
                      >
                        {deleteFetcher.state !== "idle" &&
                        deleteFetcher.formData?.get("postId") === item.id
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

      {filteredContent.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No content found.</p>
        </div>
      ) : null}
    </div>
  );
}
