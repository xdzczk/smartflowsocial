/**
 * Dead Letter Queue Service
 *
 * Handles permanently failed jobs that have exhausted all retry attempts.
 * Provides storage, retrieval, and manual retry capabilities.
 */

import { logError, logWarning, logInfo } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";
import { recordDeadLetterJob } from "~/lib/queue-metrics.server";

import { queueClient } from "./queue-client.server";
import type {
  QueueType,
  PostJobData,
  LongFormPostJobData,
} from "./queue-types";

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry {
  id: string;
  queueType: QueueType;
  jobId: string;
  jobName: string;
  jobData: PostJobData | LongFormPostJobData;
  error: string;
  errorStack?: string;
  attemptsMade: number;
  lastAttemptAt: Date;
  createdAt: Date;
  correlationId?: string;
}

/**
 * Create a dead letter entry
 */
export async function createDeadLetterEntry(
  queueType: QueueType,
  jobId: string,
  jobName: string,
  jobData: PostJobData | LongFormPostJobData,
  error: Error,
  attemptsMade: number,
  correlationId?: string
): Promise<void> {
  try {
    const postId =
      typeof jobData === "object" && "postId" in jobData
        ? String((jobData as unknown as { postId?: unknown }).postId ?? "")
        : undefined;
    const userId =
      typeof jobData === "object" && "userId" in jobData
        ? String((jobData as unknown as { userId?: unknown }).userId ?? "")
        : undefined;

    // Store in database for persistence and querying
    await prisma.deadLetterJob.create({
      data: {
        queueType,
        jobId,
        jobName,
        jobData: jobData as unknown as Record<string, unknown>,
        error: error.message,
        errorStack: error.stack ?? null,
        attemptsMade,
        correlationId: correlationId ?? null,
      },
    });

    // Record metric
    const errorType = error.constructor.name;
    recordDeadLetterJob(queueType, errorType);

    logWarning("Job moved to dead letter queue", {
      queueType,
      jobId,
      jobName,
      attemptsMade,
      error: error.message,
      correlationId,
      ...(postId && { postId }),
      ...(userId && { userId }),
    });
  } catch (dbError) {
    // Log but don't fail - dead letter queue is best effort
    logError(dbError instanceof Error ? dbError : new Error(String(dbError)), {
      queueType,
      jobId,
      message: "Failed to create dead letter entry",
      correlationId,
    });
  }
}

/**
 * Get dead letter entries
 */
export async function getDeadLetterEntries(
  queueType?: QueueType,
  limit = 50
): Promise<DeadLetterEntry[]> {
  const entries = await prisma.deadLetterJob.findMany({
    where: queueType ? { queueType } : undefined,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return entries.map((entry) => ({
    id: entry.id,
    queueType: entry.queueType as QueueType,
    jobId: entry.jobId,
    jobName: entry.jobName,
    jobData: entry.jobData as unknown as PostJobData | LongFormPostJobData,
    error: entry.error,
    errorStack: entry.errorStack ?? undefined,
    attemptsMade: entry.attemptsMade,
    lastAttemptAt: entry.updatedAt,
    createdAt: entry.createdAt,
    correlationId: entry.correlationId ?? undefined,
  }));
}

/**
 * Retry a dead letter job
 */
export async function retryDeadLetterJob(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const entry = await prisma.deadLetterJob.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      return { success: false, error: "Dead letter entry not found" };
    }

    // Re-enqueue the job
    const result = await queueClient.enqueue(
      entry.queueType as QueueType,
      entry.jobName,
      entry.jobData as unknown as PostJobData | LongFormPostJobData,
      {
        // No delay - retry immediately
      }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Failed to re-enqueue job",
      };
    }

    // Delete from dead letter queue
    await prisma.deadLetterJob.delete({
      where: { id: entryId },
    });

    logInfo("Dead letter job retried", {
      entryId,
      queueType: entry.queueType,
      jobId: entry.jobId,
      correlationId: entry.correlationId ?? undefined,
    });

    return { success: true };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      entryId,
      message: "Failed to retry dead letter job",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Delete a dead letter entry
 */
export async function deleteDeadLetterEntry(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.deadLetterJob.delete({
      where: { id: entryId },
    });

    logInfo("Dead letter entry deleted", { entryId });
    return { success: true };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      entryId,
      message: "Failed to delete dead letter entry",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get dead letter statistics
 */
export async function getDeadLetterStats(): Promise<{
  total: number;
  byQueueType: Record<QueueType, number>;
  recentErrors: Array<{ error: string; count: number }>;
}> {
  const allEntries = await prisma.deadLetterJob.findMany({
    select: {
      queueType: true,
      error: true,
    },
  });

  const byQueueType: Record<string, number> = {};
  const errorCounts: Record<string, number> = {};

  for (const entry of allEntries) {
    // Count by queue type
    const queueType = entry.queueType;
    byQueueType[queueType] = (byQueueType[queueType] ?? 0) + 1;

    // Count by error message
    const error = entry.error;
    errorCounts[error] = (errorCounts[error] ?? 0) + 1;
  }

  // Get top 10 errors
  const recentErrors = Object.entries(errorCounts)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total: allEntries.length,
    byQueueType: byQueueType,
    recentErrors,
  };
}
