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
  const hasMedia = reviewDisplay.mediaUrl.trim().length > 0;

  const mediaBlock = hasMedia ? (
    <MediaThumbnail
      src={reviewDisplay.mediaUrl}
      alt=""
      className="max-h-40 w-full max-w-44 rounded-lg object-cover sm:h-24 sm:max-h-none sm:w-24"
      onClick={() => onMediaClick(reviewDisplay.mediaUrl)}
    />
  ) : !reviewDisplay.caption ? (
    <div className="bg-surface-hover text-text-secondary flex h-24 w-full max-w-44 items-center justify-center rounded-lg text-xs sm:w-24">
      {reviewDisplay.isRepost ? "REPOST" : "TEXT"}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      {mediaBlock != null ? (
        <div className="flex min-w-0 shrink-0 flex-wrap gap-2">
          {mediaBlock}
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-2">
        {reviewDisplay.caption ? (
          <p className="text-text text-sm leading-snug whitespace-pre-wrap">
            {reviewDisplay.caption}
          </p>
        ) : null}
        <dl className="text-text-secondary grid w-full gap-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt>Scheduled</dt>
            <dd className="text-text font-medium">
              {reviewDisplay.scheduledLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Queue</dt>
            <dd className="text-text font-medium">{preparedEvent.queueType}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Follow-up</dt>
            <dd className="text-text text-right font-medium">
              {followUpSummaryLine(
                post,
                bulkRepostConditions,
                showBatchRepostConditions
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Hide tags</dt>
            <dd className="text-text font-medium">
              {post.includeHashtagsInNoteBody === false ? "On" : "Off"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
