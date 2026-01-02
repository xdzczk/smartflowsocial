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
        <div className={`${positionClass} rounded-full bg-purple-500 p-0.5`}>
          <svg
            className={`${sizeClass} text-white`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={strokeWidth}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </div>
      ) : null}
      {post.isQuotedPost ? (
        <div className={`${positionClass} rounded-full bg-green-500 p-0.5`}>
          <svg
            className={`${sizeClass} text-white`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={strokeWidth}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
        </div>
      ) : null}
    </>
  );
}
