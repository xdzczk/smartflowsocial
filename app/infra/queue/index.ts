/**
 * Queue abstraction layer
 *
 * This module provides a clean abstraction over the queue implementation,
 * allowing the codebase to swap queue systems without changing business logic.
 *
 * Usage:
 *   import { enqueuePostJob, cancelPostJob } from "~/infra/queue";
 *
 *   await enqueuePostJob(postId, userId, signedEvent, scheduledTimestamp);
 *   await cancelPostJob(postId);
 */

// High-level operations
export {
  enqueuePostJob,
  cancelPostJob,
  enqueueLongFormPostJob,
  cancelLongFormPostJob,
  enqueuePostCheckerJob,
} from "./queue-operations.server";

// Queue client (for advanced usage)
export { queueClient } from "./queue-client.server";

// Queue instances and utilities (for workers)
export { getQueueInstance, redis, closeAllQueues } from "./queue-client.server";

// Types
export type {
  QueueClient,
  PostJobData,
  LongFormPostJobData,
  ScheduleOptions,
  QueueOperationResult,
  JobStatus,
  QueueType,
} from "./queue-types";
