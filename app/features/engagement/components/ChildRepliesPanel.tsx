import { Loader2 } from "lucide-react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";

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
  const { formatDate } = useFormattedDate();

  if (isLoading) {
    return (
      <div
        className="dark:border-primary/30 border-border mt-3 border-l-2 pl-3"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2
            className={`${INLINE_ICON_SIZE_CLASS} animate-spin`}
            aria-hidden
          />
          Loading replies...
        </div>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div
        className="dark:border-primary/30 border-border mt-3 border-l-2 pl-3"
        role="status"
      >
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
            className="border-border bg-muted dark:bg-secondary/30 rounded-lg border p-2"
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
                {formatDate(reply.created_at, {
                  isUnixTimestamp: true,
                })}
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
