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
import { PostStatusIcons } from "./PostStatusIcons";

interface CompactPostBlockProps extends PostBlockBaseProps {
  queueColorStyle: QueueColorStyle | null;
  userTimezone: string;
  timeString: string;
}

export function CompactPostBlock({
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
}: CompactPostBlockProps) {
  const firstImage = getFirstImage(post, isLongform ?? false);
  const postPreview = getPostPreview(post, isLongform ?? false);
  const displayTime = getDisplayTime(
    post,
    isLongform ?? false,
    isPast ?? false,
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
      aria-label={`${isPast ? "View" : "Edit"} ${isLongform ? "longform post" : "post"}: ${postPreview}, ${isPast ? "posted" : isLongform ? "published" : "scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}`}
      className={`rounded-md border p-2 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isPast ? "cursor-default" : "cursor-pointer"
      } ${
        isDragging ? "rotate-2 opacity-50" : isPast ? "" : "hover:shadow-md"
      } ${queueColorStyle ? "" : getStatusColor(post, isLongform ?? false, isPast ?? false)} ${queueColorStyle ? "" : "border-current border-opacity-20"}`}
      style={queueColorStyle ?? {}}
      title={`${postPreview}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
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
              <PostBadges post={post} size="sm" />
            </div>
          ) : (
            <div className="relative">
              <PostIcon post={post} isLongform={isLongform ?? false} />
              <PostBadges post={post} size="sm" />
            </div>
          )}
          <span className="font-medium">{timeString}</span>
        </div>

        <PostStatusIcons post={post} isLongform={isLongform ?? false} />
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
            <PostBadges post={post} size="md" position="absolute-large" />
          </div>
          {(post.caption ?? (isLongform && post.summary)) ? (
            <p className="truncate-2-lines text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {isLongform ? (post.summary ?? postPreview) : postPreview}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="truncate-2-lines text-xs leading-relaxed">
          {isLongform ? (post.summary ?? postPreview) : postPreview}
        </p>
      )}
    </div>
  );
}
