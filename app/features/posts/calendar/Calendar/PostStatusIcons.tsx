import { Check, Clock } from "lucide-react";

import {
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";

import type { CalendarPost } from "./PostBlock.types";
interface PostStatusIconsProps {
  post: CalendarPost;
  isLongform: boolean;
  isPast?: boolean;
}

export function PostStatusIcons({
  post,
  isPast = false,
}: PostStatusIconsProps) {
  const showPublishedIcon = isPast || Boolean(post.isPosted);
  const showScheduledIcon =
    !showPublishedIcon &&
    (Boolean(post.isScheduled) || Boolean(post.signedEvent));

  return (
    <div className="flex items-center space-x-1">
      {showPublishedIcon ? (
        <Check
          className={`text-success ${SMALL_ICON_SIZE_CLASS}`}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      ) : null}
      {showScheduledIcon ? (
        <Clock
          className={`text-text-secondary ${SMALL_ICON_SIZE_CLASS}`}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function PostStatusBadges({ post, isLongform }: PostStatusIconsProps) {
  return (
    <div className="flex items-center space-x-2">
      {!isLongform &&
      !post.manual_override &&
      Boolean(!post.manual_override) ? (
        <span className="border-border text-text dark:bg-surface-hover/20 dark:text-text-secondary rounded-full border bg-transparent px-2 py-1 text-xs dark:border-transparent">
          Auto
        </span>
      ) : null}

      {post.signedEvent && Boolean(post.signedEvent) ? (
        <span className="border-success text-success dark:bg-success/20/20 dark:text-success rounded-full border bg-transparent px-2 py-1 text-xs dark:border-transparent">
          Signed
        </span>
      ) : null}
    </div>
  );
}
