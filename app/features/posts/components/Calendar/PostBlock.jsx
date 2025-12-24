import { useState } from "react";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";
const { handleErrorSafely } = require("~/lib/error-handler.client");

export function PostBlock({
  post,
  compact = false,
  minimal = false,
  thumbnailOnly = false,
  multipleInCell = false,
  user,
  queueTypes,
  onEdit,
  isLongform = false,
  isPast = false,
  hideVideoPlayButton = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);

  const handleDragStart = (e) => {
    // Disable dragging for past posts
    if (isPast) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    setDragStarted(true);
    e.dataTransfer.setData("text/plain", JSON.stringify(post));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Reset drag started after a small delay to prevent click event
    setTimeout(() => setDragStarted(false), 100);
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't trigger click if we just finished dragging
    if (dragStarted) {
      return;
    }

    if (onEdit) {
      onEdit(post);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e);
    }
  };

  const getPostPreview = () => {
    if (isLongform) {
      if (post.title) {
        return post.title.length > 30
          ? post.title.substring(0, 30) + "..."
          : post.title;
      }
      return "Longform post";
    }

    if (post.caption) {
      return post.caption.length > 30
        ? post.caption.substring(0, 30) + "..."
        : post.caption;
    }

    // Check postType to provide accurate labels
    if (post.fileUrl && post.fileUrl.length > 0) {
      if (post.postType === "VIDEO") {
        return "Media post";
      } else if (post.postType === "CAROUSEL") {
        return "Media post";
      } else {
        return "Image post";
      }
    }

    return "Text post";
  };

  const getFirstImage = () => {
    if (isLongform) {
      return post.image || null;
    }

    if (post.fileUrl && post.fileUrl.length > 0) {
      try {
        // Handle both JSON array format and direct URL format
        const firstFileUrl = post.fileUrl[0];
        if (typeof firstFileUrl === "string") {
          // Try to parse as JSON array first
          try {
            const parsed = JSON.parse(firstFileUrl);
            const url = Array.isArray(parsed) ? parsed[0] : firstFileUrl;

            // For video posts, always return the URL so MediaThumbnail can handle it
            // MediaThumbnail will automatically detect video files and show proper thumbnails

            return url;
          } catch {
            // If parsing fails, treat as direct URL
            const url = firstFileUrl;

            // For video posts, always return the URL so MediaThumbnail can handle it

            return url;
          }
        }
        return firstFileUrl;
      } catch (error) {
        handleErrorSafely(error, {
          component: "PostBlock",
          action: "getFirstImage",
        });
        return null;
      }
    }
    return null;
  };

  const getPostIcon = () => {
    if (isLongform) {
      return (
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      );
    }

    if (post.postType === "IMAGE" || post.postType === "CAROUSEL") {
      return (
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    }

    if (post.postType === "VIDEO") {
      return (
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      );
    }

    return (
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    );
  };

  const getStatusColor = () => {
    // Past posts get grayed out styling regardless of other conditions
    if (isPast) {
      return "bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-600 opacity-60";
    }

    if (isLongform) {
      if (post.signedEvent) {
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      }
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }

    // Fallback to original logic for regular posts
    const wasAutoScheduled = !post.manual_override;

    if (post.signedEvent) {
      return wasAutoScheduled
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    }

    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  };

  const getQueueColorStyle = () => {
    // Past posts get grayed styling regardless of queue color
    if (isPast) {
      return {
        backgroundColor: "#f9fafb",
        color: "#9ca3af",
        borderColor: "#e5e7eb",
        opacity: 0.6,
      };
    }

    // Longform posts don't have queue types
    if (isLongform) {
      return null;
    }

    // First try to use queue color if available
    if (post.queueType && queueTypes && Array.isArray(queueTypes)) {
      const queueTypeData = queueTypes.find(
        (qt) =>
          (qt.id && post.queueType.id && qt.id === post.queueType.id) ||
          (qt.name && post.queueType.name && qt.name === post.queueType.name),
      );
      if (queueTypeData?.color) {
        return {
          backgroundColor: `${queueTypeData.color}20`,
          color: queueTypeData.color,
          borderColor: queueTypeData.color,
        };
      }
    }

    // Fallback: try to use the color directly from post.queueType if it exists
    if (post.queueType?.color) {
      return {
        backgroundColor: `${post.queueType.color}20`,
        color: post.queueType.color,
        borderColor: post.queueType.color,
      };
    }

    return null;
  };

  const userTimezone = user?.timezone || "Etc/UTC";

  // Use appropriate date field based on post type and whether it's past
  let displayTime;
  if (isPast) {
    // For past posts, use postedAt or publishedAt
    displayTime = isLongform
      ? new Date(post.postedAt)
      : new Date(post.postedAt);
  } else {
    // For scheduled posts, use scheduledFor or publishedAt
    displayTime = isLongform
      ? new Date(post.publishedAt)
      : new Date(Number(post.scheduledFor) * 1000);
  }

  const timeString = displayTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: userTimezone,
  });

  if (thumbnailOnly) {
    const firstImage = getFirstImage();
    const queueColorStyle = getQueueColorStyle();

    return (
      <div
        draggable={!isPast}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${isPast ? "View" : "Edit"} ${isLongform ? "longform post" : "post"}: ${getPostPreview()}, ${isPast ? "posted" : isLongform ? "published" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
        className={`rounded p-1 text-xs transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isPast ? "cursor-default" : "cursor-pointer hover:opacity-80"
        } ${
          isDragging ? "opacity-50" : ""
        } ${queueColorStyle ? "" : getStatusColor()}`}
        style={queueColorStyle || {}}
        title={`${getPostPreview()}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
      >
        {firstImage ? (
          <div className="relative">
            <MediaThumbnail
              src={firstImage}
              alt="Post thumbnail"
              className="h-4 w-4 flex-shrink-0 rounded"
              forceType={isVideoFile(firstImage) ? "video" : "image"}
              hidePlayButton={true}
              fallback={
                <div className="h-4 w-4 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-600" />
              }
            />
            {post.repost ? (
              <div className="absolute -right-0.5 -top-0.5 rounded-full bg-purple-500 p-0.5">
                <svg
                  className="h-1.5 w-1.5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </div>
            ) : null}
            {post.isQuotedPost ? (
              <div className="absolute -right-0.5 -top-0.5 rounded-full bg-green-500 p-0.5">
                <svg
                  className="h-1.5 w-1.5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="relative">
            {getPostIcon()}
            {post.repost ? (
              <div className="absolute -right-0.5 -top-0.5 rounded-full bg-purple-500 p-0.5">
                <svg
                  className="h-1.5 w-1.5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </div>
            ) : null}
            {post.isQuotedPost ? (
              <div className="absolute -right-0.5 -top-0.5 rounded-full bg-green-500 p-0.5">
                <svg
                  className="h-1.5 w-1.5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (minimal) {
    const firstImage = getFirstImage();
    const queueColorStyle = getQueueColorStyle();

    // When there are multiple posts in cell, use ultra-compact layout
    if (multipleInCell) {
      return (
        <div
          draggable={!isPast}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-label={`${isPast ? "View" : "Edit"} ${isLongform ? "longform post" : "post"}: ${getPostPreview()}, ${isPast ? "posted" : isLongform ? "published" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
          className={`rounded p-0.5 text-xs transition-opacity focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            isPast ? "cursor-default" : "cursor-pointer hover:opacity-80"
          } ${
            isDragging ? "opacity-50" : ""
          } ${queueColorStyle ? "" : getStatusColor()}`}
          style={queueColorStyle || {}}
          title={`${getPostPreview()}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
        >
          <div className="flex flex-col items-center space-y-0.5">
            {firstImage ? (
              <div className="relative">
                <MediaThumbnail
                  src={firstImage}
                  alt="Post thumbnail"
                  className="h-3 w-3 flex-shrink-0 rounded"
                  forceType={isVideoFile(firstImage) ? "video" : "image"}
                  hidePlayButton={true}
                  fallback={
                    <div className="h-3 w-3 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-600" />
                  }
                />
                {post.repost ? (
                  <div className="absolute -right-0.5 -top-0.5 rounded-full bg-purple-500 p-0.5">
                    <svg
                      className="h-1 w-1 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={4}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </div>
                ) : null}
                {post.isQuotedPost ? (
                  <div className="absolute -right-0.5 -top-0.5 rounded-full bg-green-500 p-0.5">
                    <svg
                      className="h-1 w-1 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={4}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="relative">
                <div className="h-3 w-3">{getPostIcon()}</div>
                {post.repost ? (
                  <div className="absolute -right-0.5 -top-0.5 rounded-full bg-purple-500 p-0.5">
                    <svg
                      className="h-1 w-1 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={4}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </div>
                ) : null}
                {post.isQuotedPost ? (
                  <div className="absolute -right-0.5 -top-0.5 rounded-full bg-green-500 p-0.5">
                    <svg
                      className="h-1 w-1 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={4}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                ) : null}
              </div>
            )}
            <span
              className="max-w-full truncate text-center text-xs leading-tight"
              style={{ fontSize: "11px", lineHeight: "20px" }}
            >
              {getPostPreview().length > 8
                ? getPostPreview().substring(0, 8) + "..."
                : getPostPreview()}
            </span>
          </div>
        </div>
      );
    }

    // Regular minimal layout for single posts
    return (
      <div
        draggable={!isPast}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${isPast ? "View" : "Edit"} ${isLongform ? "longform post" : "post"}: ${getPostPreview()}, ${isPast ? "posted" : isLongform ? "published" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
        className={`rounded px-2 py-1 text-xs transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isPast ? "cursor-default" : "cursor-pointer hover:opacity-80"
        } ${
          isDragging ? "opacity-50" : ""
        } ${queueColorStyle ? "" : getStatusColor()}`}
        style={queueColorStyle || {}}
        title={`${getPostPreview()}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
      >
        <div className="flex items-center space-x-1">
          {firstImage ? (
            <div className="relative">
              <MediaThumbnail
                src={firstImage}
                alt="Post thumbnail"
                className="h-4 w-4 flex-shrink-0 rounded"
                forceType={isVideoFile(firstImage) ? "video" : "image"}
                hidePlayButton={minimal || hideVideoPlayButton}
                fallback={
                  <div className="h-4 w-4 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-600" />
                }
              />
              {post.repost ? (
                <div className="absolute -right-0.5 -top-0.5 rounded-full bg-purple-500 p-0.5">
                  <svg
                    className="h-1.5 w-1.5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </div>
              ) : null}
              {post.isQuotedPost ? (
                <div className="absolute -right-0.5 -top-0.5 rounded-full bg-green-500 p-0.5">
                  <svg
                    className="h-1.5 w-1.5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="relative">
              {getPostIcon()}
              {post.repost ? (
                <div className="absolute -right-0.5 -top-0.5 rounded-full bg-purple-500 p-0.5">
                  <svg
                    className="h-1.5 w-1.5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </div>
              ) : null}
              {post.isQuotedPost ? (
                <div className="absolute -right-0.5 -top-0.5 rounded-full bg-green-500 p-0.5">
                  <svg
                    className="h-1.5 w-1.5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                </div>
              ) : null}
            </div>
          )}
          <span className="flex-1 truncate">{getPostPreview()}</span>
        </div>
      </div>
    );
  }

  if (compact) {
    const firstImage = getFirstImage();
    const queueColorStyle = getQueueColorStyle();

    return (
      <div
        draggable={!isPast}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${isPast ? "View" : "Edit"} ${isLongform ? "longform post" : "post"}: ${getPostPreview()}, ${isPast ? "posted" : isLongform ? "published" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
        className={`rounded-md border p-2 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isPast ? "cursor-default" : "cursor-pointer"
        } ${
          isDragging ? "rotate-2 opacity-50" : isPast ? "" : "hover:shadow-md"
        } ${queueColorStyle ? "" : getStatusColor()} ${queueColorStyle ? "" : "border-current border-opacity-20"}`}
        style={queueColorStyle || {}}
        title={`${getPostPreview()}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
      >
        <div className="mb-1 flex items-start justify-between">
          <div className="flex items-center space-x-1">
            {firstImage ? (
              <div className="relative">
                <MediaThumbnail
                  src={firstImage}
                  alt="Post thumbnail"
                  className="h-4 w-4 flex-shrink-0 rounded"
                  forceType={isVideoFile(firstImage) ? "video" : "image"}
                  hidePlayButton={true}
                  fallback={
                    <div className="h-4 w-4 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-600" />
                  }
                />
                {post.repost ? (
                  <div className="absolute -right-0.5 -top-0.5 rounded-full bg-purple-500 p-0.5">
                    <svg
                      className="h-1.5 w-1.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </div>
                ) : null}
                {post.isQuotedPost ? (
                  <div className="absolute -right-0.5 -top-0.5 rounded-full bg-green-500 p-0.5">
                    <svg
                      className="h-1.5 w-1.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="relative">
                {getPostIcon()}
                {post.repost ? (
                  <div className="absolute -right-0.5 -top-0.5 rounded-full bg-purple-500 p-0.5">
                    <svg
                      className="h-1.5 w-1.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </div>
                ) : null}
                {post.isQuotedPost ? (
                  <div className="absolute -right-0.5 -top-0.5 rounded-full bg-green-500 p-0.5">
                    <svg
                      className="h-1.5 w-1.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                ) : null}
              </div>
            )}
            <span className="font-medium">{timeString}</span>
          </div>

          <div className="flex items-center space-x-1">
            {!isLongform &&
            !post.manual_override &&
            Boolean(!post.manual_override) ? (
              <svg
                className="h-3 w-3 text-blue-500"
                fill="currentColor"
                viewBox="0 0 20 20"
                title="Auto-scheduled"
              >
                <path
                  fillRule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
            ) : null}

            {post.signedEvent && Boolean(post.signedEvent) ? (
              <svg
                className="h-3 w-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
                title="Signed"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : null}
          </div>
        </div>

        {/* Show image thumbnail if available, otherwise show text preview */}
        {firstImage ? (
          <div className="space-y-1">
            <div className="post-thumbnail relative h-16 w-full overflow-hidden rounded-md">
              <MediaThumbnail
                src={firstImage}
                alt="Post preview"
                className="h-full w-full rounded-md"
                forceType={isVideoFile(firstImage) ? "video" : "image"}
                hidePlayButton={false}
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {post.postType === "VIDEO" || isVideoFile(firstImage)
                      ? "VIDEO"
                      : "MEDIA"}
                  </div>
                }
              />
              {post.repost ? (
                <div className="absolute right-1 top-1 rounded-full bg-purple-500 p-1">
                  <svg
                    className="h-2 w-2 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </div>
              ) : null}
              {post.isQuotedPost ? (
                <div className="absolute right-1 top-1 rounded-full bg-green-500 p-1">
                  <svg
                    className="h-2 w-2 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                </div>
              ) : null}
            </div>
            {post.caption || (isLongform && post.summary) ? (
              <p className="truncate-2-lines text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                {isLongform
                  ? post.summary || getPostPreview()
                  : getPostPreview()}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="truncate-2-lines text-xs leading-relaxed">
            {isLongform ? post.summary || getPostPreview() : getPostPreview()}
          </p>
        )}
      </div>
    );
  }

  const firstImage = getFirstImage();
  const queueColorStyle = getQueueColorStyle();

  return (
    <div
      draggable={!isPast}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${isPast ? "View" : "Edit"} post: ${getPostPreview()}, ${isPast ? "posted" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
      className={`rounded-lg border p-3 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isPast ? "cursor-default" : "cursor-pointer"
      } ${
        isDragging ? "rotate-2 opacity-50" : isPast ? "" : "hover:shadow-lg"
      } ${queueColorStyle ? "" : getStatusColor()} ${queueColorStyle ? "" : "border-current border-opacity-20"}`}
      style={queueColorStyle || {}}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {firstImage ? (
            <div className="relative">
              <MediaThumbnail
                src={firstImage}
                alt="Post thumbnail"
                className="h-5 w-5 flex-shrink-0 rounded"
                forceType={isVideoFile(firstImage) ? "video" : "image"}
                hidePlayButton={hideVideoPlayButton}
                fallback={
                  <div className="h-5 w-5 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-600" />
                }
              />
              {post.repost ? (
                <div className="absolute -right-1 -top-1 rounded-full bg-purple-500 p-0.5">
                  <svg
                    className="h-2 w-2 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </div>
              ) : null}
              {post.isQuotedPost ? (
                <div className="absolute -right-1 -top-1 rounded-full bg-green-500 p-0.5">
                  <svg
                    className="h-2 w-2 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="relative">
              {getPostIcon()}
              {post.repost ? (
                <div className="absolute -right-1 -top-1 rounded-full bg-purple-500 p-0.5">
                  <svg
                    className="h-2 w-2 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </div>
              ) : null}
              {post.isQuotedPost ? (
                <div className="absolute -right-1 -top-1 rounded-full bg-green-500 p-0.5">
                  <svg
                    className="h-2 w-2 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                </div>
              ) : null}
            </div>
          )}
          <span className="text-sm font-medium">
            {displayTime.toLocaleDateString("en-US", {
              timeZone: userTimezone,
            })}{" "}
            at {timeString}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {!isLongform &&
          !post.manual_override &&
          Boolean(!post.manual_override) ? (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
              Auto
            </span>
          ) : null}

          {post.signedEvent && Boolean(post.signedEvent) ? (
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-400">
              Signed
            </span>
          ) : null}
        </div>
      </div>

      {/* Show large image thumbnail if available */}
      {firstImage ? (
        <div className="mb-3">
          <div className="post-thumbnail relative h-24 w-full overflow-hidden rounded-md">
            <MediaThumbnail
              src={firstImage}
              alt="Post preview"
              className="h-full w-full rounded-md"
              forceType={isVideoFile(firstImage) ? "video" : "image"}
              hidePlayButton={hideVideoPlayButton}
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  {post.postType === "VIDEO" || isVideoFile(firstImage)
                    ? "VIDEO"
                    : "MEDIA"}
                </div>
              }
            />
            {post.repost ? (
              <div className="absolute right-2 top-2 rounded-full bg-purple-500 p-1">
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </div>
            ) : null}
            {post.isQuotedPost ? (
              <div className="absolute right-2 top-2 rounded-full bg-green-500 p-1">
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="text-sm text-gray-600 dark:text-gray-300">
        {isLongform ? post.summary || getPostPreview() : getPostPreview()}
      </p>

      {!isLongform &&
      post.fileUrl &&
      post.fileUrl.length > 0 &&
      Boolean(post.fileUrl.length) ? (
        <div className="mt-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {post.fileUrl.length} file{post.fileUrl.length > 1 ? "s" : ""}
            {post.fileUrl.length > 1 ? " (carousel)" : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
