import type { QueueType } from "./types";

/** Accepts DB/Prisma enum strings, client literals, and uppercase variants. */
export function normalizeQueueStatus(
  status: string | null | undefined,
  isEnabled?: boolean | null
): QueueType["status"] {
  if (status === "paused" || status === "PAUSED") return "paused";
  if (status === "archived" || status === "ARCHIVED") return "archived";
  if (status === "active" || status === "ACTIVE") return "active";
  if (isEnabled === false) return "paused";
  return "active";
}

export function isQueuePaused(
  queue:
    | Pick<QueueType, "status" | "isEnabled">
    | { status?: string | null | undefined; isEnabled?: boolean | null }
    | null
    | undefined
): boolean {
  if (!queue) return false;
  return normalizeQueueStatus(queue.status, queue.isEnabled) === "paused";
}

export function isQueueArchived(
  queue:
    | Pick<QueueType, "status" | "isEnabled">
    | { status?: string | null | undefined; isEnabled?: boolean | null }
    | null
    | undefined
): boolean {
  if (!queue) return false;
  return normalizeQueueStatus(queue.status, queue.isEnabled) === "archived";
}

export function isQueueSchedulable(
  queue:
    | Pick<QueueType, "status" | "isEnabled">
    | { status?: string | null | undefined; isEnabled?: boolean | null }
    | null
    | undefined
): boolean {
  if (!queue) return true;
  return normalizeQueueStatus(queue.status, queue.isEnabled) === "active";
}

export function shouldShowQueueInUi(
  queue:
    | Pick<QueueType, "status" | "isEnabled">
    | { status?: string | null | undefined; isEnabled?: boolean | null }
    | null
    | undefined
): boolean {
  return !isQueueArchived(queue);
}

export function normalizeQueueHoldStatus(
  status: string | null | undefined
): "none" | "held_by_queue" | "needs_resign_after_queue_resume" {
  if (
    status === "needs_resign_after_queue_resume" ||
    status === "NEEDS_RESIGN_AFTER_QUEUE_RESUME"
  ) {
    return "needs_resign_after_queue_resume";
  }
  if (status === "held_by_queue" || status === "HELD_BY_QUEUE") {
    return "held_by_queue";
  }
  return "none";
}

export function isHeldByQueue(status: string | null | undefined): boolean {
  return normalizeQueueHoldStatus(status) !== "none";
}

/** True when a scheduled post/article must be signed again (e.g. after queue resume). */
export function needsResignAfterQueueResume(content: {
  queueHoldStatus?: string | null;
}): boolean {
  return (
    normalizeQueueHoldStatus(content.queueHoldStatus) ===
    "needs_resign_after_queue_resume"
  );
}
