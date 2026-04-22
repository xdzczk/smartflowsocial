import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { QueueType, UserData } from "~/features/posts/types";
import { isVideoFile } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatForDisplay, fromDate } from "~/lib/temporal";

import type { CalendarPost } from "./PostBlock.types";
import { getDisplayTime, getPostPreview } from "./PostBlock.utils";

const LG_BREAKPOINT_PX = 1024;

function getMediaUrls(post: CalendarPost, postIsLongform: boolean): string[] {
  if (postIsLongform) {
    return post.image ? [post.image] : [];
  }

  const fileUrls = Array.isArray(post.fileUrl) ? post.fileUrl : [];
  return fileUrls
    .flatMap((entry) => {
      if (typeof entry !== "string") return [];
      try {
        const parsed = JSON.parse(entry) as string[] | string;
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        // Fallback to direct URL format.
      }
      return entry ? [entry] : [];
    })
    .filter((url) => typeof url === "string" && url.length > 0);
}

function getPostTypeLabel(
  post: CalendarPost,
  postIsLongform: boolean,
  mediaUrl: string | null
): string {
  if (postIsLongform) return "Article";
  if (post.postKind === "REPOST" || post.repost) return "Repost";
  if (post.postType === "CAROUSEL") return "Carousel";
  if (post.postType === "VIDEO" || (mediaUrl && isVideoFile(mediaUrl)))
    return "Video";
  if (mediaUrl) return "Image";
  return "Text";
}

function getStatusLabel(post: CalendarPost): string {
  if (post.isPast) return "Past";
  if (post.isPosted) return "Posted";
  if (post.isScheduled || post.signedEvent) return "Scheduled";
  return "Draft";
}

interface DayViewSidebarProps {
  selectedPost: CalendarPost | null;
  onEditPost: (post: CalendarPost) => void;
  onReschedulePost: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
  userTimezone: string;
  userTimeFormat: "12h" | "24h";
  children: React.ReactNode;
}

export function DayViewSidebar({
  selectedPost,
  onEditPost,
  onReschedulePost,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
  userTimezone,
  userTimeFormat,
  children,
}: DayViewSidebarProps) {
  return (
    <aside className="border-border/60 flex w-[22rem] flex-shrink-0 flex-col border-l bg-[hsl(var(--calendar-surface-2-bg))]">
      <div className="border-border/40 border-b p-3">{children}</div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {selectedPost ? (
          <DayViewPostDetailCard
            post={selectedPost}
            onEdit={() => onEditPost(selectedPost)}
            onReschedule={() => onReschedulePost(selectedPost)}
            user={user}
            queueTypes={queueTypes}
            isLongform={isLongform}
            isAll={isAll}
            userTimezone={userTimezone}
            userTimeFormat={userTimeFormat}
          />
        ) : (
          <div className="border-border/40 bg-canvas/40 text-text-secondary flex flex-1 flex-col items-center justify-center rounded-[var(--calendar-radius-md)] border p-4 text-center">
            <p className="text-sm font-medium">No post selected</p>
            <p className="mt-1 text-xs">
              Select a post in the timeline to inspect details and edit.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

interface DayViewPostDetailCardProps {
  post: CalendarPost;
  onEdit: () => void;
  onReschedule: () => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform: boolean;
  isAll: boolean;
  userTimezone: string;
  userTimeFormat: "12h" | "24h";
}

function DayViewPostDetailCard({
  post,
  onEdit,
  onReschedule,
  isLongform,
  isAll,
  userTimezone,
  userTimeFormat,
}: DayViewPostDetailCardProps) {
  const { dateLocale } = useFormattedDate();
  const postIsLongform = isAll
    ? Boolean(post.title && post.publishedAt)
    : isLongform;
  const isPast = !!post.isPast;
  const displayTime = getDisplayTime(post, postIsLongform, isPast);
  const timeString = formatForDisplay(
    fromDate(displayTime, userTimezone),
    userTimezone,
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    userTimeFormat,
    dateLocale
  );
  const mediaUrls = getMediaUrls(post, postIsLongform);
  const mediaUrl = mediaUrls[0] ?? null;
  const mediaCount = mediaUrls.length;
  const postTypeLabel = getPostTypeLabel(post, postIsLongform, mediaUrl);
  const statusLabel = getStatusLabel(post);
  const schedulingMode = post.manual_override
    ? "Manual time"
    : "Queue scheduled";
  const preview = getPostPreview(post, postIsLongform);
  const captionOrTitle = postIsLongform
    ? (post.title ?? post.summary ?? preview)
    : (post.caption ?? preview);
  const summaryText = postIsLongform ? post.summary : null;

  return (
    <div className="border-border/40 bg-canvas flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--calendar-radius-md)] border">
      <div className="border-border/40 flex items-start justify-between border-b p-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[hsl(var(--calendar-accent-purple))] uppercase">
            Selected post
          </p>
          <p className="text-text mt-1 line-clamp-2 text-sm font-semibold">
            {captionOrTitle && captionOrTitle.length > 0
              ? captionOrTitle
              : preview}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="bg-surface-hover text-text-secondary rounded-full px-2 py-0.5 text-[11px] font-medium">
            {postTypeLabel}
          </span>
          <span className="bg-surface-hover text-text-secondary rounded-full px-2 py-0.5 text-[11px] font-medium">
            {statusLabel}
          </span>
          {mediaCount > 1 ? (
            <span className="bg-surface-hover text-text-secondary rounded-full px-2 py-0.5 text-[11px] font-medium">
              {mediaCount} attachments
            </span>
          ) : null}
        </div>

        {mediaUrl ? (
          <div className="bg-surface-hover relative aspect-video w-full overflow-hidden rounded-[var(--calendar-radius-md)]">
            <MediaThumbnail
              src={mediaUrl}
              alt=""
              className="h-full w-full object-cover"
              forceType={isVideoFile(mediaUrl) ? "video" : "image"}
              hidePlayButton={false}
              fallback={
                <div className="bg-surface-hover text-text-secondary flex h-full w-full items-center justify-center text-xs">
                  {post.postType === "VIDEO" || isVideoFile(mediaUrl)
                    ? "VIDEO"
                    : "IMAGE"}
                </div>
              }
            />
          </div>
        ) : (
          <div className="bg-surface-hover text-text-secondary flex aspect-video w-full items-center justify-center rounded-[var(--calendar-radius-md)] text-xs">
            No media preview
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          <div className="rounded-[var(--calendar-radius-sm)] border border-[hsl(var(--border)/0.5)] p-2">
            <p className="text-text-secondary text-[11px] uppercase">
              Scheduled
            </p>
            <p className="text-text mt-0.5 text-sm font-medium">{timeString}</p>
          </div>
          <div className="rounded-[var(--calendar-radius-sm)] border border-[hsl(var(--border)/0.5)] p-2">
            <p className="text-text-secondary text-[11px] uppercase">Queue</p>
            <p className="text-text mt-0.5 text-sm font-medium">
              {post.queueType?.name ?? "Unassigned"}
            </p>
          </div>
          <div className="rounded-[var(--calendar-radius-sm)] border border-[hsl(var(--border)/0.5)] p-2">
            <p className="text-text-secondary text-[11px] uppercase">
              Scheduling mode
            </p>
            <p className="text-text mt-0.5 text-sm font-medium">
              {schedulingMode}
            </p>
          </div>
          {post.postKind ? (
            <div className="rounded-[var(--calendar-radius-sm)] border border-[hsl(var(--border)/0.5)] p-2">
              <p className="text-text-secondary text-[11px] uppercase">Kind</p>
              <p className="text-text mt-0.5 text-sm font-medium">
                {post.postKind}
              </p>
            </div>
          ) : null}
        </div>

        {summaryText ? (
          <div>
            <p className="text-text-secondary text-[11px] font-medium uppercase">
              Summary
            </p>
            <p className="text-text mt-1 line-clamp-3 text-sm">{summaryText}</p>
          </div>
        ) : null}

        <div>
          <p className="text-text-secondary text-[11px] font-medium uppercase">
            Content
          </p>
          <p className="text-text mt-1 line-clamp-5 text-sm">
            {captionOrTitle && captionOrTitle.length > 0
              ? captionOrTitle
              : preview}
          </p>
        </div>

        <div className="mt-auto flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={onReschedule}
            className="border-border bg-canvas text-text hover:bg-surface-hover/50 inline-flex w-full items-center justify-center rounded-[var(--calendar-radius-sm)] border px-3 py-2 text-sm font-medium"
          >
            Reschedule
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="border-border bg-canvas text-text hover:bg-surface-hover/50 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--calendar-radius-sm)] border px-3 py-2 text-sm font-medium"
          >
            <Pencil className="h-4 w-4" strokeWidth={INLINE_ICON_STROKE} />
            Edit post
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Returns true when viewport width is at least lg (1024px).
 * Used to show Day view sidebar and change post click behavior.
 */
export function useIsLg(): boolean {
  const [isLg, setIsLg] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(min-width: ${LG_BREAKPOINT_PX}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${LG_BREAKPOINT_PX}px)`);
    const handler = () => setIsLg(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isLg;
}
