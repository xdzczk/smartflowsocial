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
interface MinimalPostBlockProps extends PostBlockBaseProps {
  queueColorStyle: QueueColorStyle | null;
  userTimezone: string;
  multipleInCell?: boolean;
  hideVideoPlayButton?: boolean;
  /** Rendered inside block (e.g. time in month view) with same background */
  timeLabel?: string;
  /** When >= 2, preview text may use 2–3 lines instead of one. */
  slotExpandRows?: number;
}

// ============================================================================
// Helper Functions and Components
// ============================================================================

function getAriaLabel(
  postPreview: string,
  isLongform: boolean,
  isPast: boolean,
  formattedTime: string
): string {
  const action = isPast ? "View" : "Edit";
  const postType = isLongform ? "article" : "post";
  const status = isPast ? "published" : isLongform ? "published" : "scheduled";
  return `${action} ${postType}: ${postPreview}, ${status} for ${formattedTime}`;
}

function getTitleText(
  postPreview: string,
  isLongform: boolean,
  isPast: boolean,
  formattedTime: string
): string {
  const status = isPast ? "Posted" : isLongform ? "Published" : "Scheduled";
  const action = isPast ? "Past post (view only)" : "Click to edit";
  return `${postPreview}\n${status} for ${formattedTime}\n${action}`;
}

function getClassName(
  isPast: boolean,
  isDragging: boolean,
  queueColorStyle: React.CSSProperties | null | undefined,
  post: CalendarPost,
  isLongform: boolean
): string {
  const baseClasses =
    "rounded-[var(--calendar-radius-sm)] text-xs transition-opacity focus:outline-none";
  const cursorClass = isPast
    ? "cursor-default"
    : "cursor-pointer hover:opacity-80";
  const draggingClass = isDragging ? "opacity-50" : "";
  const statusColor = queueColorStyle
    ? ""
    : getStatusColor(post, isLongform, isPast);
  return `${baseClasses} ${cursorClass} ${draggingClass} ${statusColor}`.trim();
}

interface PostThumbnailProps {
  firstImage: string | null;
  post: CalendarPost;
  isLongform: boolean;
  size: "xs" | "sm";
  hideVideoPlayButton?: boolean;
}

function PostThumbnail({
  firstImage,
  post,
  isLongform,
  size,
  hideVideoPlayButton = false,
}: PostThumbnailProps) {
  const sizeClasses = size === "xs" ? "h-3 w-3" : "h-4 w-4";
  const badgeSize = size === "xs" ? "xs" : "sm";

  if (firstImage) {
    return (
      <div className="relative">
        <MediaThumbnail
          src={firstImage}
          alt="Post thumbnail"
          className={`${sizeClasses} flex-shrink-0 rounded-[var(--calendar-radius-sm)]`}
          forceType={isVideoFile(firstImage) ? "video" : "image"}
          hidePlayButton={size === "xs" ? true : hideVideoPlayButton}
          fallback={
            <div
              className={`${sizeClasses} bg-muted flex-shrink-0 rounded-[var(--calendar-radius-sm)]`}
            />
          }
        />
        <PostBadges post={post} size={badgeSize} />
      </div>
    );
  }

  return (
    <div className="relative">
      {size === "xs" ? (
        <div className={sizeClasses}>
          <PostIcon
            post={post}
            isLongform={isLongform}
            className={sizeClasses}
          />
        </div>
      ) : (
        <PostIcon post={post} isLongform={isLongform} />
      )}
      <PostBadges post={post} size={badgeSize} />
    </div>
  );
}

interface UltraCompactLayoutProps {
  post: CalendarPost;
  firstImage: string | null;
  postPreview: string;
  isLongform: boolean;
  isPast: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  queueColorStyle: React.CSSProperties | null | undefined;
  displayTime: Date;
  userTimezone: string;
}

function UltraCompactLayout({
  post,
  firstImage,
  postPreview,
  isLongform,
  isPast,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onKeyDown,
  queueColorStyle,
  displayTime,
  userTimezone: _userTimezone,
}: UltraCompactLayoutProps) {
  const { formatDate } = useFormattedDate();
  const formattedTime = formatDate(displayTime);
  const className = `${getClassName(isPast, isDragging, queueColorStyle, post, isLongform)} p-0.5 focus:ring-1 focus:ring-ring`;
  const ariaLabel = getAriaLabel(
    postPreview,
    isLongform,
    isPast,
    formattedTime
  );
  const title = getTitleText(postPreview, isLongform, isPast, formattedTime);

  return (
    <div
      draggable={!isPast}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => onClick(e)}
      onKeyDown={(e) => onKeyDown(e)}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      className={`relative overflow-hidden ${className}`}
      style={queueColorStyle ?? {}}
      title={title}
    >
      <div className="relative flex flex-col items-center space-y-0.5">
        <PostThumbnail
          firstImage={firstImage}
          post={post}
          isLongform={isLongform}
          size="xs"
        />
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

interface RegularLayoutProps {
  post: CalendarPost;
  firstImage: string | null;
  postPreview: string;
  isLongform: boolean;
  isPast: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  queueColorStyle: React.CSSProperties | null | undefined;
  displayTime: Date;
  userTimezone: string;
  hideVideoPlayButton: boolean;
  timeLabel?: string;
  slotExpandRows?: number;
}

function RegularLayout({
  post,
  firstImage,
  postPreview,
  isLongform,
  isPast,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onKeyDown,
  queueColorStyle,
  displayTime,
  userTimezone: _userTimezone,
  hideVideoPlayButton,
  timeLabel,
  slotExpandRows,
}: RegularLayoutProps) {
  const { formatDate } = useFormattedDate();
  const formattedTime = formatDate(displayTime);
  const className = `${getClassName(isPast, isDragging, queueColorStyle, post, isLongform)} px-2 py-1 focus:ring-2 focus:ring-ring`;
  const ariaLabel = getAriaLabel(
    postPreview,
    isLongform,
    isPast,
    formattedTime
  );
  const title = getTitleText(postPreview, isLongform, isPast, formattedTime);
  const rows = slotExpandRows ?? 1;
  const allowMultipleLines = rows >= 2;
  const lineClampClass =
    rows >= 4
      ? "line-clamp-4"
      : rows === 3
        ? "line-clamp-3"
        : rows === 2
          ? "line-clamp-2"
          : "truncate";
  const useDynamicLineClamp = rows > 4;
  const lineClampStyle = useDynamicLineClamp
    ? {
        display: "-webkit-box" as const,
        WebkitLineClamp: rows,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      }
    : undefined;

  return (
    <div
      draggable={!isPast}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => onClick(e)}
      onKeyDown={(e) => onKeyDown(e)}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      className={`relative overflow-hidden ${className}`}
      style={queueColorStyle ?? {}}
      title={title}
    >
      <div className="relative flex items-center gap-1.5">
        {timeLabel ? (
          <span className="flex-shrink-0 text-xs tabular-nums opacity-90">
            {timeLabel}
          </span>
        ) : null}
        <PostThumbnail
          firstImage={firstImage}
          post={post}
          isLongform={isLongform}
          size="sm"
          hideVideoPlayButton={hideVideoPlayButton}
        />
        {allowMultipleLines ? (
          <div
            className={`min-w-0 flex-1 text-xs leading-relaxed break-words ${useDynamicLineClamp ? "" : lineClampClass}`}
            style={lineClampStyle}
          >
            {postPreview}
          </div>
        ) : (
          <span className="min-w-0 flex-1 truncate">{postPreview}</span>
        )}
      </div>
    </div>
  );
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
  timeLabel,
  slotExpandRows,
}: MinimalPostBlockProps) {
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

  if (multipleInCell) {
    return (
      <UltraCompactLayout
        post={post}
        firstImage={firstImage}
        postPreview={postPreview}
        isLongform={isLongform ?? false}
        isPast={isPast ?? false}
        isDragging={isDragging ?? false}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onKeyDown={onKeyDown}
        queueColorStyle={queueColorStyle}
        displayTime={displayTime}
        userTimezone={userTimezone}
      />
    );
  }

  return (
    <RegularLayout
      post={post}
      firstImage={firstImage}
      postPreview={postPreview}
      isLongform={isLongform ?? false}
      isPast={isPast ?? false}
      isDragging={isDragging ?? false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => onClick(e)}
      onKeyDown={(e) => onKeyDown(e)}
      queueColorStyle={queueColorStyle}
      displayTime={displayTime}
      userTimezone={userTimezone}
      hideVideoPlayButton={hideVideoPlayButton}
      timeLabel={timeLabel}
      slotExpandRows={slotExpandRows}
    />
  );
}
