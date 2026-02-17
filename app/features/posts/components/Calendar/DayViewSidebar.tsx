import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatForDisplay, fromDate } from "~/lib/temporal";

import type { QueueType, UserData } from "../../types";

import type { CalendarPost } from "./PostBlock.types";
import { getDisplayTime, getPostPreview } from "./PostBlock.utils";

const LG_BREAKPOINT_PX = 1024;

interface DayViewSidebarProps {
  selectedPost: CalendarPost | null;
  onEditPost: (post: CalendarPost) => void;
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
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
  userTimezone,
  userTimeFormat,
  children,
}: DayViewSidebarProps) {
  return (
    <aside className="border-border/60 flex w-80 flex-shrink-0 flex-col border-l bg-[hsl(var(--calendar-surface-2-bg))]">
      <div className="border-border/40 border-b p-3">{children}</div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {selectedPost ? (
          <DayViewPostDetailCard
            post={selectedPost}
            onEdit={() => onEditPost(selectedPost)}
            user={user}
            queueTypes={queueTypes}
            isLongform={isLongform}
            isAll={isAll}
            userTimezone={userTimezone}
            userTimeFormat={userTimeFormat}
          />
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-center text-sm">
            Select a post to view details
          </div>
        )}
      </div>
    </aside>
  );
}

interface DayViewPostDetailCardProps {
  post: CalendarPost;
  onEdit: () => void;
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
  isLongform,
  isAll,
  userTimezone,
  userTimeFormat,
}: DayViewPostDetailCardProps) {
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
    userTimeFormat
  );
  const mediaUrl =
    postIsLongform && post.image
      ? post.image
      : post.fileUrl.length
        ? (() => {
            try {
              const first = post.fileUrl[0];
              if (typeof first === "string") {
                try {
                  const parsed = JSON.parse(first) as string[] | string;
                  return Array.isArray(parsed) ? parsed[0] : first;
                } catch {
                  return first;
                }
              }
              return null;
            } catch {
              return null;
            }
          })()
        : null;
  const preview = getPostPreview(post, postIsLongform);
  const captionOrTitle = postIsLongform
    ? (post.title ?? post.summary ?? preview)
    : (post.caption ?? preview);

  return (
    <div className="flex flex-col gap-3">
      {mediaUrl ? (
        <div className="bg-muted relative h-24 w-full overflow-hidden rounded-[var(--calendar-radius-md)]">
          <MediaThumbnail
            src={mediaUrl}
            alt=""
            className="h-full w-full object-cover"
            forceType={isVideoFile(mediaUrl) ? "video" : "image"}
            hidePlayButton={false}
            fallback={
              <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs">
                {post.postType === "VIDEO" || isVideoFile(mediaUrl)
                  ? "VIDEO"
                  : "IMAGE"}
              </div>
            }
          />
        </div>
      ) : null}
      <div className="text-muted-foreground text-xs">{timeString}</div>
      {post.queueType?.name ? (
        <div className="text-muted-foreground text-xs">
          Queue: {post.queueType.name}
        </div>
      ) : null}
      <p className="line-clamp-3 text-sm">
        {captionOrTitle && captionOrTitle.length > 0 ? captionOrTitle : preview}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-1.5 rounded-[var(--calendar-radius-sm)] px-3 py-2 text-sm font-medium"
      >
        <Pencil className="h-4 w-4" strokeWidth={INLINE_ICON_STROKE} />
        Edit
      </button>
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
