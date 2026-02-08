import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

import { PostBadges } from "./PostBadges";
import type {
  PostBlockBaseProps,
  QueueColorStyle,
  CalendarPost,
} from "./PostBlock.types";
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

// ============================================================================
// Helper Functions
// ============================================================================

function getAriaLabel(
  isPast: boolean | undefined,
  isLongform: boolean | undefined,
  postPreview: string,
  formattedTime: string
): string {
  const action = isPast ? "View" : "Edit";
  const postType = isLongform ? "longform post" : "post";
  const status = isPast ? "published" : isLongform ? "published" : "scheduled";
  return `${action} ${postType}: ${postPreview}, ${status} for ${formattedTime}`;
}

function getClassName(
  isPast: boolean | undefined,
  isDragging: boolean | undefined,
  queueColorStyle: QueueColorStyle | null | undefined,
  post: CalendarPost,
  isLongform: boolean | undefined
): string {
  const baseClasses =
    "rounded-md border border-border p-2 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-ring";
  const cursorClass = isPast ? "cursor-default" : "cursor-pointer";
  const dragClass = isDragging
    ? "rotate-2 opacity-50"
    : isPast
      ? ""
      : "hover:shadow-md";
  const statusClass = queueColorStyle
    ? ""
    : getStatusColor(post, isLongform ?? false, isPast ?? false);
  const borderClass = queueColorStyle ? "" : "border-current border-opacity-20";
  return `${baseClasses} ${cursorClass} ${dragClass} ${statusClass} ${borderClass}`;
}

function getTitle(
  postPreview: string,
  isPast: boolean | undefined,
  isLongform: boolean | undefined,
  formattedTime: string
): string {
  const status = isPast ? "Posted" : isLongform ? "Published" : "Scheduled";
  const action = isPast ? "Past post (view only)" : "Click to edit";
  return `${postPreview}\n${status} for ${formattedTime}\n${action}`;
}

function ThumbnailSection({
  firstImage,
  post,
  isLongform: _isLongform,
}: {
  firstImage: string | null;
  post: CalendarPost;
  isLongform: boolean | undefined;
}) {
  if (!firstImage) {
    return null;
  }

  return (
    <div className="relative">
      <MediaThumbnail
        src={firstImage}
        alt="Post thumbnail"
        className="h-4 w-4 flex-shrink-0 rounded"
        forceType={isVideoFile(firstImage) ? "video" : "image"}
        hidePlayButton={true}
        fallback={<div className="bg-muted h-4 w-4 flex-shrink-0 rounded" />}
      />
      <PostBadges post={post} size="sm" />
    </div>
  );
}

function IconSection({
  post,
  isLongform,
}: {
  post: CalendarPost;
  isLongform: boolean | undefined;
}) {
  return (
    <div className="relative">
      <PostIcon post={post} isLongform={isLongform ?? false} />
      <PostBadges post={post} size="sm" />
    </div>
  );
}

function MediaPreview({
  firstImage,
  post,
  isLongform,
  postPreview,
}: {
  firstImage: string | null;
  post: CalendarPost;
  isLongform: boolean | undefined;
  postPreview: string;
}) {
  if (!firstImage) {
    return (
      <p className="truncate-2-lines overflow-hidden text-xs leading-relaxed">
        {isLongform ? (post.summary ?? postPreview) : postPreview}
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col space-y-1">
      <div className="post-thumbnail relative min-h-0 w-full flex-1 overflow-hidden rounded-md">
        <MediaThumbnail
          src={firstImage}
          alt="Post preview"
          className="h-full w-full rounded-md object-cover"
          forceType={isVideoFile(firstImage) ? "video" : "image"}
          hidePlayButton={false}
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
      {(post.caption ?? (isLongform && post.summary)) ? (
        <p className="truncate-2-lines text-muted-foreground flex-shrink-0 text-xs leading-relaxed">
          {isLongform ? (post.summary ?? postPreview) : postPreview}
        </p>
      ) : null}
    </div>
  );
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
  userTimezone: _userTimezone,
  timeString,
}: CompactPostBlockProps) {
  const { formatDate } = useFormattedDate();
  const firstImage = getFirstImage(post, isLongform ?? false);
  const postPreview = getPostPreview(post, isLongform ?? false);
  const displayTime = getDisplayTime(
    post,
    isLongform ?? false,
    isPast ?? false
  );
  const formattedTime = formatDate(displayTime);

  return (
    <div
      draggable={!isPast}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={getAriaLabel(isPast, isLongform, postPreview, formattedTime)}
      className={`${getClassName(
        isPast,
        isDragging,
        queueColorStyle,
        post,
        isLongform
      )} flex h-full flex-col overflow-hidden`}
      style={
        queueColorStyle
          ? (queueColorStyle as unknown as React.CSSProperties)
          : undefined
      }
      title={getTitle(postPreview, isPast, isLongform, formattedTime)}
    >
      <div className="mb-1 flex flex-shrink-0 items-start justify-between">
        <div className="flex items-center space-x-1">
          {firstImage ? (
            <ThumbnailSection
              firstImage={firstImage}
              post={post}
              isLongform={isLongform}
            />
          ) : (
            <IconSection post={post} isLongform={isLongform} />
          )}
          <span className="font-medium">{timeString}</span>
        </div>

        <PostStatusIcons post={post} isLongform={isLongform ?? false} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <MediaPreview
          firstImage={firstImage}
          post={post}
          isLongform={isLongform}
          postPreview={postPreview}
        />
      </div>
    </div>
  );
}
