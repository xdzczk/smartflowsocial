import { formatDate } from "~/lib/helpers";

import type { ChildReply } from "../hooks/useNotificationActions";
interface ChildRepliesPanelProps {
  isLoading: boolean;
  replies: ChildReply[];
  metadata: Record<string, unknown>;
}

export function ChildRepliesPanel({
  isLoading,
  replies,
  metadata,
}: ChildRepliesPanelProps) {
  if (isLoading) {
    return (
      <div className="dark:border-primary/30 mt-3 border-l-2 border-gray-300 pl-3">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Loading replies...
        </div>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="dark:border-primary/30 mt-3 border-l-2 border-gray-300 pl-3">
        <div className="text-muted-foreground text-xs">No replies yet</div>
      </div>
    );
  }

  return (
    <div className="border-primary/30 mt-3 space-y-2 border-l-2 pl-3">
      {replies.map((reply) => {
        const replyMetadata = metadata[reply.pubkey];
        let replyAuthorName =
          reply.pubkey.substring(0, 8) + "..." + reply.pubkey.slice(-4);
        let replyAuthorPicture = null;

        if (replyMetadata) {
          try {
            const metadataContent =
              typeof replyMetadata === "object" &&
              !Array.isArray(replyMetadata) &&
              "content" in replyMetadata
                ? (replyMetadata as { content?: unknown }).content
                : null;
            const profile =
              typeof metadataContent === "string"
                ? (JSON.parse(metadataContent) as Record<string, unknown>)
                : metadataContent &&
                    typeof metadataContent === "object" &&
                    !Array.isArray(metadataContent)
                  ? (metadataContent as Record<string, unknown>)
                  : null;
            if (profile && typeof profile === "object") {
              replyAuthorName =
                (profile as { display_name?: string; name?: string })
                  .display_name ??
                (profile as { name?: string }).name ??
                replyAuthorName;
              replyAuthorPicture =
                (profile as { picture?: string | null }).picture ?? null;
            }
          } catch (_e) {
            // Ignore parsing errors
          }
        }

        return (
          <div
            key={reply.id}
            className="border-border dark:bg-secondary/30 rounded-lg border bg-gray-50 p-2"
          >
            <div className="mb-1 flex items-center gap-2">
              {replyAuthorPicture ? (
                <img
                  src={replyAuthorPicture}
                  alt={replyAuthorName}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="bg-muted h-6 w-6 rounded-full" />
              )}
              <span className="text-foreground text-xs font-semibold">
                {replyAuthorName}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatDate(new Date(reply.created_at * 1000).toISOString())}
              </span>
            </div>
            <p className="text-foreground text-xs break-words whitespace-pre-wrap">
              {reply.content}
            </p>
          </div>
        );
      })}
    </div>
  );
}
