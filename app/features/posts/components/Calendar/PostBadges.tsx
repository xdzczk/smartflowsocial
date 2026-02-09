import { Quote, Share2 } from "lucide-react";

import type { CalendarPost } from "./PostBlock.types";
interface PostBadgesProps {
  post: CalendarPost;
  size?: "xs" | "sm" | "md";
  position?: "absolute" | "inline" | "absolute-large";
}

const sizeClasses = {
  xs: "h-1 w-1",
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

const strokeWidths = {
  xs: 4,
  sm: 3,
  md: 2,
};

const positionClasses = {
  absolute: "absolute -right-0.5 -top-0.5",
  "absolute-large": "absolute right-1 top-1",
  inline: "",
};

export function PostBadges({
  post,
  size = "sm",
  position = "absolute",
}: PostBadgesProps) {
  const sizeClass = sizeClasses[size];
  const strokeWidth = strokeWidths[size];
  const positionClass = positionClasses[position];

  return (
    <>
      {post.repost ? (
        <div className={`${positionClass} bg-primary rounded-full p-0.5`}>
          <Share2
            className={`${sizeClass} text-white`}
            strokeWidth={strokeWidth}
            aria-hidden
          />
        </div>
      ) : null}
      {post.isQuotedPost ? (
        <div className={`${positionClass} bg-success rounded-full p-0.5`}>
          <Quote
            className={`${sizeClass} text-white`}
            strokeWidth={strokeWidth}
            aria-hidden
          />
        </div>
      ) : null}
    </>
  );
}
