import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

import { PostBadges } from "./PostBadges";
import type { PostBlockBaseProps, QueueColorStyle } from "./PostBlock.types";
import {
  getPostPreview,
  getFirstImage,
  getStatusColor,
  getDisplayTime,
  getQueueColorStyleProps,
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
  userTimezone: _userTimezone,
  timeString,
  hideVideoPlayButton = false,
}: FullPostBlockProps) {
  const { formatDate } = useFormattedDate();
  const firstImage = getFirstImage(post, isLongform ?? false);
  const postPreview = getPostPreview(post, isLongform ?? false);
  const displayTime = getDisplayTime(
    post,
    isLongform ?? false,
    isPast ?? false
  );
  const formattedDateTime = formatDate(displayTime);
  const formattedDate = formatDate(displayTime, {
    dateFormatOptions: {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  });

  const { style: queueStyle, unassignedBgClass } =
    getQueueColorStyleProps(queueColorStyle);

  return (
    <div
      draggable={!isPast}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${isPast ? "View" : "Edit"} post: ${postPreview}, ${isPast ? "published" : "scheduled"} for ${formattedDateTime}`}
      className={`focus-visible:ring-focus-ring relative overflow-hidden rounded-[var(--calendar-radius-md)] border p-3 transition-[transform,opacity,box-shadow] focus-visible:ring-2 focus-visible:outline-none ${
        queueColorStyle ? "border-0" : "border-opacity-20 border border-current"
      } ${isPast ? "cursor-default" : "cursor-pointer"} ${
        isDragging
          ? "rotate-2 opacity-50"
          : isPast
            ? ""
            : "hover:shadow-[var(--calendar-surface-4-shadow)]"
      } ${queueColorStyle ? "" : getStatusColor(post, isLongform ?? false, isPast ?? false)} ${unassignedBgClass}`}
      style={queueColorStyle ? queueStyle : undefined}
    >
      <div className="relative mb-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {firstImage ? (
            <div className="relative">
              <MediaThumbnail
                src={firstImage}
                alt="Post thumbnail"
                className="h-5 w-5 flex-shrink-0 rounded-[var(--calendar-radius-sm)]"
                forceType={isVideoFile(firstImage) ? "video" : "image"}
                hidePlayButton={hideVideoPlayButton}
                fallback={
                  <div className="bg-surface-hover h-5 w-5 flex-shrink-0 rounded-[var(--calendar-radius-sm)]" />
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
            {formattedDate} at {timeString}
          </span>
        </div>

        <PostStatusBadges post={post} isLongform={isLongform ?? false} />
      </div>

      {/* Show large image thumbnail if available */}
      {firstImage ? (
        <div className="mb-3">
          <div className="post-thumbnail relative h-24 w-full overflow-hidden rounded-[var(--calendar-radius-md)]">
            <MediaThumbnail
              src={firstImage}
              alt="Post preview"
              className="h-full w-full rounded-[var(--calendar-radius-md)]"
              forceType={isVideoFile(firstImage) ? "video" : "image"}
              hidePlayButton={hideVideoPlayButton}
              fallback={
                <div className="bg-surface-hover text-text-secondary flex h-full w-full items-center justify-center text-xs font-medium">
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

      <p className="text-text-secondary text-sm">
        {isLongform ? (post.summary ?? postPreview) : postPreview}
      </p>

      {!isLongform && post.fileUrl.length > 0 ? (
        <div className="mt-2">
          <div className="text-text-secondary text-xs">
            {post.fileUrl.length} file{post.fileUrl.length > 1 ? "s" : ""}
            {post.fileUrl.length > 1 ? " (carousel)" : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
