import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";
import { PostIcon } from "./PostIcon";
import { PostBadges } from "./PostBadges";
import type { PostBlockBaseProps, QueueColorStyle } from "./PostBlock.types";
import { getPostPreview, getFirstImage, getStatusColor, getDisplayTime } from "./PostBlock.utils";

interface ThumbnailPostBlockProps extends PostBlockBaseProps {
  queueColorStyle: QueueColorStyle | null;
  userTimezone: string;
}

export function ThumbnailPostBlock({
  post,
  user,
  isLongform,
  isPast,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onKeyDown,
  queueColorStyle,
  userTimezone,
}: ThumbnailPostBlockProps) {
  const firstImage = getFirstImage(post, isLongform ?? false);
  const postPreview = getPostPreview(post, isLongform ?? false);
  const displayTime = getDisplayTime(post, isLongform ?? false, isPast ?? false);

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
      className={`rounded p-1 text-xs transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isPast ? "cursor-default" : "cursor-pointer hover:opacity-80"
      } ${
        isDragging ? "opacity-50" : ""
      } ${queueColorStyle ? "" : getStatusColor(post, isLongform ?? false, isPast ?? false)}`}
      style={queueColorStyle || {}}
      title={`${postPreview}\n${isPast ? "Posted" : isLongform ? "Published" : "Scheduled"} for ${displayTime.toLocaleString("en-US", { timeZone: userTimezone })}\n${isPast ? "Past post (view only)" : "Click to edit"}`}
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



