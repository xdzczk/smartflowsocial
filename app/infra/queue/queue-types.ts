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
}

/**
 * Job data for scheduled longform posts
 */
export interface LongFormPostJobData {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
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
export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed";

/**
 * Queue type identifier
 */
export type QueueType = "scheduled-posts" | "scheduled-longform-posts" | "post-checker";

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
    options?: ScheduleOptions,
  ): Promise<QueueOperationResult>;

  /**
   * Cancel a job by its data identifier (e.g., postId)
   */
  cancelByData(
    queueName: QueueType,
    dataKey: keyof PostJobData | keyof LongFormPostJobData,
    dataValue: string,
  ): Promise<boolean>;

  /**
   * Get jobs by status
   */
  getJobs(
    queueName: QueueType,
    statuses: JobStatus[],
  ): Promise<{ id: string; data: PostJobData | LongFormPostJobData; status: JobStatus }[]>;

  /**
   * Remove a job by ID
   */
  removeJob(queueName: QueueType, jobId: string): Promise<boolean>;
}


