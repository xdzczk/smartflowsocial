import { Check } from "lucide-react";

import {
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";

import type { CalendarPost } from "./PostBlock.types";
interface PostStatusIconsProps {
  post: CalendarPost;
  isLongform: boolean;
}

export function PostStatusIcons({ post }: PostStatusIconsProps) {
  return (
    <div className="flex items-center space-x-1">
      {post.signedEvent && Boolean(post.signedEvent) ? (
        <Check
          className={`text-success ${SMALL_ICON_SIZE_CLASS}`}
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
        <span className="border-border text-foreground dark:bg-muted/20 dark:text-muted-foreground rounded-full border bg-transparent px-2 py-1 text-xs dark:border-transparent">
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
