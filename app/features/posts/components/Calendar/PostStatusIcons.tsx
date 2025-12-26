import type { CalendarPost } from "./PostBlock.types";

interface PostStatusIconsProps {
  post: CalendarPost;
  isLongform: boolean;
}

export function PostStatusIcons({ post, isLongform }: PostStatusIconsProps) {
  return (
    <div className="flex items-center space-x-1">
      {!isLongform &&
      !post.manual_override &&
      Boolean(!post.manual_override) ? (
        <svg
          className="h-3 w-3 text-blue-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      ) : null}

      {post.signedEvent && Boolean(post.signedEvent) ? (
        <svg
          className="h-3 w-3 text-green-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
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
        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
          Auto
        </span>
      ) : null}

      {post.signedEvent && Boolean(post.signedEvent) ? (
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-400">
          Signed
        </span>
      ) : null}
    </div>
  );
}


