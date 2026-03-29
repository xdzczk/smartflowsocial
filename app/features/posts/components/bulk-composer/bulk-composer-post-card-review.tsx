import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { PreparedEvent, RepostConditions } from "~/features/posts/types";

import type { BulkPost } from "../BulkPostCard";

import type { BulkComposerReviewDisplay } from "./bulk-composer-post-card-display";
import { followUpSummaryLine } from "./bulk-composer-post-card-utils";

export function BulkComposerPostCardReviewBody({
  reviewDisplay,
  preparedEvent,
  post,
  onMediaClick,
  bulkRepostConditions,
  showBatchRepostConditions,
}: {
  reviewDisplay: BulkComposerReviewDisplay;
  preparedEvent: PreparedEvent;
  post: BulkPost;
  onMediaClick: (src: string) => void;
  bulkRepostConditions: RepostConditions | null;
  showBatchRepostConditions: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        {reviewDisplay.caption ? (
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {reviewDisplay.caption}
          </p>
        ) : null}
        {reviewDisplay.mediaUrl ? (
          <MediaThumbnail
            src={reviewDisplay.mediaUrl}
            alt=""
            className="max-h-56 w-full rounded-lg object-cover"
            onClick={() => onMediaClick(reviewDisplay.mediaUrl)}
          />
        ) : null}
        {!reviewDisplay.caption && !reviewDisplay.mediaUrl ? (
          <div className="bg-muted text-muted-foreground flex h-24 items-center justify-center rounded-lg text-sm">
            {reviewDisplay.isRepost ? "REPOST" : "TEXT"}
          </div>
        ) : null}
      </div>
      <dl className="text-muted-foreground grid gap-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt>Scheduled</dt>
          <dd className="text-foreground font-medium">
            {reviewDisplay.scheduledLabel}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Queue</dt>
          <dd className="text-foreground font-medium">
            {preparedEvent.queueType}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Follow-up</dt>
          <dd className="text-foreground font-medium">
            {followUpSummaryLine(
              post,
              bulkRepostConditions,
              showBatchRepostConditions
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Hide tags</dt>
          <dd className="text-foreground font-medium">
            {post.includeHashtagsInNoteBody === false ? "On" : "Off"}
          </dd>
        </div>
      </dl>
    </>
  );
}
