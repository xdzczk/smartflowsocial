import type { BulkPost, RepostConditions } from "~/features/posts/types";

import {
  buildBulkComposerFollowUpLine,
  countRepostConditionRules,
} from "../follow-up";

export function hasMedia(post: BulkPost): boolean {
  return (
    post.files.length > 0 ||
    (Array.isArray(post.fileUrl) && post.fileUrl.length > 0) ||
    (typeof post.fileUrl === "string" && post.fileUrl.trim() !== "")
  );
}

/** Kind 6 (NIP-18) repost rows have empty note body; caption/media rules for normal posts do not apply. */
export function bulkPostMissingRequiredCaption(post: BulkPost): boolean {
  if (post.isKind6Repost) return false;
  return !hasMedia(post) && !post.caption.trim();
}

export function buildBulkPostStatusLabel(
  post: BulkPost,
  rowErrors: string[] | undefined
): { label: string; variant: "default" | "amber" | "muted" } {
  if (rowErrors?.length) {
    return { label: "Needs attention", variant: "amber" };
  }
  if (bulkPostMissingRequiredCaption(post)) {
    return { label: "Needs caption", variant: "amber" };
  }
  if (!post.scheduledFor.trim()) {
    return { label: "Missing schedule", variant: "amber" };
  }
  if (!post.queueType || post.queueType === "unassigned") {
    return { label: "Unassigned queue", variant: "muted" };
  }
  return { label: "Ready", variant: "default" };
}

export function followUpSummaryLine(
  post: BulkPost,
  bulkRepostConditions: RepostConditions | null,
  showBatchRepostConditions: boolean
): string {
  return buildBulkComposerFollowUpLine({
    repostScheduleCount: post.repostSchedules?.length ?? 0,
    quoteScheduleCount: post.quoteSchedules?.length ?? 0,
    showBatchRepostConditions,
    batchHasRepostConditionRules:
      countRepostConditionRules(bulkRepostConditions) > 0,
  });
}
