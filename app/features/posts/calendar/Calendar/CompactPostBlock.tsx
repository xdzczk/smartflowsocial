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
  getQueueColorStyleProps,
} from "./PostBlock.utils";
import { PostIcon } from "./PostIcon";
import { PostStatusIcons } from "./PostStatusIcons";

interface CompactPostBlockProps extends PostBlockBaseProps {
  queueColorStyle: QueueColorStyle | null;
  userTimezone: string;
  timeString: string;
  /** When true, do not show thumbnail/icon next to time (Day/Week view). */
  hideTimeRowPreview?: boolean;
  /** When set (e.g. week/day grid), scale text preview length and line-clamp by row count. */
  slotExpandRows?: number;
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
  const postType = isLongform ? "article" : "post";
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
    "rounded-[var(--calendar-radius-md)] p-1.5 text-xs transition-[transform,opacity,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
  const cursorClass = isPast ? "cursor-default" : "cursor-pointer";
  const dragClass = isDragging
    ? "rotate-2 opacity-50"
    : isPast
      ? ""
      : "hover:shadow-[var(--calendar-surface-4-shadow)]";
  const statusClass = queueColorStyle
    ? ""
    : getStatusColor(post, isLongform ?? false, isPast ?? false);
  const borderClass = queueColorStyle
    ? "border-0"
    : "border border-current border-opacity-20";
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
        className="h-4 w-4 flex-shrink-0 rounded-[var(--calendar-radius-sm)]"
        forceType={isVideoFile(firstImage) ? "video" : "image"}
        hidePlayButton={true}
        fallback={
          <div className="bg-surface-hover h-4 w-4 flex-shrink-0 rounded-[var(--calendar-radius-sm)]" />
        }
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
  slotExpandRows,
}: {
  firstImage: string | null;
  post: CalendarPost;
  isLongform: boolean | undefined;
  postPreview: string;
  slotExpandRows?: number;
}) {
  const lineClampLines =
    slotExpandRows && slotExpandRows >= 2
      ? Math.min(12, slotExpandRows * 3)
      : 4;

  if (!firstImage) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p
          className="[display:-webkit-box] min-h-0 flex-1 text-xs leading-relaxed break-words [-webkit-box-orient:vertical]"
          style={{ WebkitLineClamp: lineClampLines }}
        >
          {isLongform ? (post.summary ?? postPreview) : postPreview}
        </p>
      </div>
    );
  }

  const captionLines =
    slotExpandRows && slotExpandRows >= 2
      ? Math.min(4, Math.max(2, slotExpandRows))
      : 2;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-1">
      <div className="post-thumbnail relative min-h-0 w-full flex-1 overflow-hidden rounded-[var(--calendar-radius-md)]">
        <MediaThumbnail
          src={firstImage}
          alt="Post preview"
          className="h-full w-full rounded-[var(--calendar-radius-md)] object-cover"
          forceType={isVideoFile(firstImage) ? "video" : "image"}
          hidePlayButton={false}
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
      {(post.caption ?? (isLongform && post.summary)) ? (
        <p
          className="text-text-secondary [display:-webkit-box] flex-shrink-0 text-xs leading-relaxed break-words [-webkit-box-orient:vertical]"
          style={{ WebkitLineClamp: captionLines }}
        >
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
  hideTimeRowPreview = false,
  slotExpandRows,
}: CompactPostBlockProps) {
  const { formatDate } = useFormattedDate();
  const firstImage = getFirstImage(post, isLongform ?? false);
  const rows = slotExpandRows ?? 1;
  const previewMaxLength = rows >= 2 ? Math.min(2000, 30 + rows * 220) : 30;
  const postPreview = getPostPreview(
    post,
    isLongform ?? false,
    previewMaxLength
  );
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
      aria-label={getAriaLabel(isPast, isLongform, postPreview, formattedTime)}
      className={`${getClassName(
        isPast,
        isDragging,
        queueColorStyle,
        post,
        isLongform
      )} relative flex h-full flex-col overflow-hidden ${unassignedBgClass}`}
      style={queueColorStyle ? queueStyle : undefined}
      title={getTitle(postPreview, isPast, isLongform, formattedTime)}
    >
      <div className="relative mb-1 flex flex-shrink-0 items-start justify-between">
        <div className="flex items-center space-x-1">
          {!hideTimeRowPreview ? (
            firstImage ? (
              <ThumbnailSection
                firstImage={firstImage}
                post={post}
                isLongform={isLongform}
              />
            ) : (
              <IconSection post={post} isLongform={isLongform} />
            )
          ) : null}
          <span className="font-medium">{timeString}</span>
        </div>

        <PostStatusIcons
          post={post}
          isLongform={isLongform ?? false}
          isPast={isPast ?? false}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <MediaPreview
          firstImage={firstImage}
          post={post}
          isLongform={isLongform}
          postPreview={postPreview}
          slotExpandRows={slotExpandRows}
        />
      </div>
    </div>
  );
}
