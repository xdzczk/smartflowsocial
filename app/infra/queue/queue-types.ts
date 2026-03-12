/**
 * Queue abstraction types
 * These types define the interface for queue operations, independent of the underlying implementation
 */

import type { SignedEvent } from "~/features/nostr/types";
/**
 * Job data for scheduled posts
 */
export interface PostJobData {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
  correlationId?: string; // For request tracking
}

/**
 * Job data for scheduled longform posts
 */
export interface LongFormPostJobData {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
  correlationId?: string; // For request tracking
}

/**
 * Options for scheduling a job
 */
export interface ScheduleOptions {
  /**
   * Delay in milliseconds before the job should be processed
   */
  delay?: number;
  /**
   * Timestamp (in seconds) when the job should be processed
   */
  scheduledFor?: number;
  /**
   * Optional deterministic job ID. If provided, allows O(1) cancellation by jobId.
   * Recommended: use postId as jobId for scheduled posts.
   */
  jobId?: string;
}

/**
 * Result of a queue operation
 */
export interface QueueOperationResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * Queue job status
 */
export type JobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed";

/**
 * Queue type identifier
 */
export type QueueType =
  | "scheduled-posts"
  | "scheduled-longform-posts"
  | "post-checker";

/**
 * Queue client interface
 * This abstraction allows swapping queue implementations without changing business logic
 */
export interface QueueClient {
  /**
   * Enqueue a job to be processed
   */
  enqueue<T extends PostJobData | LongFormPostJobData>(
    queueName: QueueType,
    jobName: string,
    data: T,
    options?: ScheduleOptions
  ): Promise<QueueOperationResult>;

  /**
   * Cancel a job by its deterministic job ID (O(1) operation)
   * This is the preferred method for cancellation when using deterministic job IDs.
   */
  cancelByJobId(queueName: QueueType, jobId: string): Promise<boolean>;

  /**
   * Get jobs by status
   */
  getJobs(
    queueName: QueueType,
    statuses: JobStatus[]
  ): Promise<
    Array<{
      id: string;
      data: PostJobData | LongFormPostJobData;
      status: JobStatus;
    }>
  >;

  /**
   * Remove a job by ID
   */
  removeJob(queueName: QueueType, jobId: string): Promise<boolean>;
}
