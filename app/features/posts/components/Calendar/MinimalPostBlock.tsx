import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";

import { PostBadges } from "./PostBadges";
import type { PostBlockBaseProps, QueueColorStyle } from "./PostBlock.types";
import {
  getPostPreview,
  getFirstImage,
  getStatusColor,
  getDisplayTime,
} from "./PostBlock.utils";
import { PostIcon } from "./PostIcon";
interface MinimalPostBlockProps extends PostBlockBaseProps {
  queueColorStyle: QueueColorStyle | null;
  userTimezone: string;
  multipleInCell?: boolean;
  hideVideoPlayButton?: boolean;
}

export function MinimalPostBlock({
  post,
  user: _user,
  isLongform,
  isPast,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onKeyDown,
  queueColorStyle,
  userTimezone,
  multipleInCell = false,
  hideVideoPlayButton = false,
}: MinimalPostBlockProps) {
  const firstImage = getFirstImage(post, isLongform ?? false);
  const postPreview = getPostPreview(post, isLongform ?? false);
  const displayTime = getDisplayTime(
    post,
    isLongform ?? false,
    isPast ?? false,
  );

  // When there are multiple posts in cell, use ultra-compact layout
  if (multipleInCell) {
    return (
      <div
        draggable={!isPast}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${isPast ? "View" : "Edit"} ${isLongform ? "longform post" : "post"}: ${postPreview}, ${isPast ? "posted" : isLongform ? "published" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
        className={`rounded p-0.5 text-xs transition-opacity focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          isPast ? "cursor-default" : "cursor-pointer hover:opacity-80"
        } ${
          isDragging ? "opacity-50" : ""
        } ${queueColorStyle ? "" : getStatusColor(post, isLongform ?? false, isPast ?? false)}`}
        style={queueColorStyle ?? {}}
        title={`${postPreview}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
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
              <PostBadges post={post} size="xs" />
            </div>
          ) : (
            <div className="relative">
              <div className="h-3 w-3">
                <PostIcon
                  post={post}
                  isLongform={isLongform ?? false}
                  className="h-3 w-3"
                />
              </div>
              <PostBadges post={post} size="xs" />
            </div>
          )}
          <span
            className="max-w-full truncate text-center text-xs leading-tight"
            style={{ fontSize: "11px", lineHeight: "20px" }}
          >
            {postPreview.length > 8
              ? postPreview.substring(0, 8) + "..."
              : postPreview}
          </span>
        </div>
      </div>
    );
  }

  // Regular minimal layout for single posts
  return (
    <div
      draggable={!isPast}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${isPast ? "View" : "Edit"} ${isLongform ? "longform post" : "post"}: ${postPreview}, ${isPast ? "posted" : isLongform ? "published" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
      className={`rounded px-2 py-1 text-xs transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isPast ? "cursor-default" : "cursor-pointer hover:opacity-80"
      } ${
        isDragging ? "opacity-50" : ""
      } ${queueColorStyle ? "" : getStatusColor(post, isLongform ?? false, isPast ?? false)}`}
      style={queueColorStyle ?? {}}
      title={`${postPreview}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
    >
      <div className="flex items-center space-x-1">
        {firstImage ? (
          <div className="relative">
            <MediaThumbnail
              src={firstImage}
              alt="Post thumbnail"
              className="h-4 w-4 flex-shrink-0 rounded"
              forceType={isVideoFile(firstImage) ? "video" : "image"}
              hidePlayButton={hideVideoPlayButton}
              fallback={
                <div className="h-4 w-4 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-600" />
              }
            />
            <PostBadges post={post} size="sm" />
          </div>
        ) : (
          <div className="relative">
            <PostIcon post={post} isLongform={isLongform ?? false} />
            <PostBadges post={post} size="sm" />
          </div>
        )}
        <span className="flex-1 truncate">{postPreview}</span>
      </div>
    </div>
  );
}
