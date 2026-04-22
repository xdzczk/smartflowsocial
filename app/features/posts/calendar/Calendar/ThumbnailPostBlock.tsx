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
interface ThumbnailPostBlockProps extends PostBlockBaseProps {
  queueColorStyle: QueueColorStyle | null;
  userTimezone: string;
}

export function ThumbnailPostBlock({
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
}: ThumbnailPostBlockProps) {
  const { formatDate } = useFormattedDate();
  const firstImage = getFirstImage(post, isLongform ?? false);
  const postPreview = getPostPreview(post, isLongform ?? false);
  const displayTime = getDisplayTime(
    post,
    isLongform ?? false,
    isPast ?? false
  );
  const formattedTime = formatDate(displayTime);
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
      aria-label={`${isPast ? "View" : "Edit"} ${isLongform ? "article" : "post"}: ${postPreview}, ${isPast ? "published" : isLongform ? "published" : "scheduled"} for ${formattedTime}`}
      className={`focus-ring relative overflow-hidden rounded-[var(--calendar-radius-sm)] p-1 text-xs transition-opacity ${
        isPast ? "cursor-default" : "cursor-pointer hover:opacity-80"
      } ${
        isDragging ? "opacity-50" : ""
      } ${queueColorStyle ? "" : getStatusColor(post, isLongform ?? false, isPast ?? false)} ${unassignedBgClass}`}
      style={queueColorStyle ? queueStyle : undefined}
      title={`${postPreview}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${formattedTime}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
    >
      {firstImage ? (
        <div className="relative">
          <MediaThumbnail
            src={firstImage}
            alt="Post thumbnail"
            className="h-4 w-4 flex-shrink-0 rounded-[var(--calendar-radius-sm)]"
            forceType={isVideoFile(firstImage) ? "video" : "image"}
            hidePlayButton={true}
            fallback={
              <div className="bg-surface-hover h-4 w-4 flex-shrink-0 rounded-[var(--calendar-radius-sm)]" />
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
    </div>
  );
}
