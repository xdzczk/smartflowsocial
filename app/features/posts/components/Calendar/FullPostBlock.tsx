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

  return (
    <div
      draggable={!isPast}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${isPast ? "View" : "Edit"} post: ${postPreview}, ${isPast ? "posted" : "scheduled"} for ${formattedDateTime}`}
      className={`border-border focus:ring-primary rounded-lg border p-3 transition-all focus:ring-2 focus:outline-none ${
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
                  <div className="bg-muted h-5 w-5 flex-shrink-0 rounded" />
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
          <div className="post-thumbnail relative h-24 w-full overflow-hidden rounded-md">
            <MediaThumbnail
              src={firstImage}
              alt="Post preview"
              className="h-full w-full rounded-md"
              forceType={isVideoFile(firstImage) ? "video" : "image"}
              hidePlayButton={hideVideoPlayButton}
              fallback={
                <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs font-medium">
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

      <p className="text-muted-foreground text-sm">
        {isLongform ? (post.summary ?? postPreview) : postPreview}
      </p>

      {!isLongform && post.fileUrl.length > 0 ? (
        <div className="mt-2">
          <div className="text-muted-foreground text-xs">
            {post.fileUrl.length} file{post.fileUrl.length > 1 ? "s" : ""}
            {post.fileUrl.length > 1 ? " (carousel)" : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
