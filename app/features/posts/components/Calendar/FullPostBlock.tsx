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
import { PostStatusBadges } from "./PostStatusIcons";

interface FullPostBlockProps extends PostBlockBaseProps {
  queueColorStyle: QueueColorStyle | null;
  userTimezone: string;
  timeString: string;
  hideVideoPlayButton?: boolean;
}

export function FullPostBlock({
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
  timeString,
  hideVideoPlayButton = false,
}: FullPostBlockProps) {
  const firstImage = getFirstImage(post, isLongform ?? false);
  const postPreview = getPostPreview(post, isLongform ?? false);
  const displayTime = getDisplayTime(
    post,
    isLongform ?? false,
    isPast ?? false
  );

  return (
    <div
      draggable={!isPast}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${isPast ? "View" : "Edit"} post: ${postPreview}, ${isPast ? "posted" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
      className={`rounded-lg border p-3 transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${
        isPast ? "cursor-default" : "cursor-pointer"
      } ${
        isDragging ? "rotate-2 opacity-50" : isPast ? "" : "hover:shadow-lg"
      } ${queueColorStyle ? "" : getStatusColor(post, isLongform ?? false, isPast ?? false)} ${queueColorStyle ? "" : "border-opacity-20 border-current"}`}
      style={queueColorStyle ?? {}}
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
              <PostBadges post={post} size="md" />
            </div>
          ) : (
            <div className="relative">
              <PostIcon post={post} isLongform={isLongform ?? false} />
              <PostBadges post={post} size="md" />
            </div>
          )}
          <span className="text-sm font-medium">
            {displayTime.toLocaleDateString("en-US", {
              timeZone: userTimezone,
            })}{" "}
            at {timeString}
          </span>
        </div>

        <PostStatusBadges post={post} isLongform={isLongform ?? false} />
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
            <PostBadges post={post} size="md" position="absolute-large" />
          </div>
        </div>
      ) : null}

      <p className="text-sm text-gray-600 dark:text-gray-300">
        {isLongform ? (post.summary ?? postPreview) : postPreview}
      </p>

      {!isLongform && post.fileUrl.length > 0 ? (
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
