/**
 * Queue workers and initialization
 *
 * This file handles the worker processes that process queue jobs.
 * For enqueueing/canceling jobs, use the queue abstraction layer:
 *   import { enqueuePostJob, cancelPostJob } from "~/infra/queue";
 *
 * Job handlers live in queue-handlers/post-job.server.ts, longform-job.server.ts,
 * and checker-job.server.ts. This file defines Worker instances and startup.
 */

import { Worker, type Job } from "bullmq";

import { runBroadcastDmJob } from "~/features/broadcast/broadcast-job.server";
import { runPostChecker } from "~/features/posts/queue-handlers/checker-job.server";
import {
  runScheduledLongFormPostJob,
  handleScheduledLongFormPostJobError,
} from "~/features/posts/queue-handlers/longform-job.server";
import {
  runScheduledPostJob,
  handleScheduledPostJobError,
} from "~/features/posts/queue-handlers/post-job.server";
import {
  QUEUE_SCHEDULED_POSTS,
  QUEUE_SCHEDULED_LONGFORM_POSTS,
  QUEUE_POST_CHECKER,
} from "~/features/posts/queue-handlers/shared.server";
import type { PublishLease } from "~/infra/publishing/publish-lease.server";
import { getQueueInstance, redis, closeAllQueues } from "~/infra/queue";
import type {
  PostJobData,
  LongFormPostJobData,
  BroadcastJobData,
} from "~/infra/queue";
import { logError, logInfo } from "~/lib/error-logger.server";
import {
  recordJobMetrics,
  recordJobStarted,
  updateActiveJobs,
} from "~/lib/queue-metrics.server";
import { addBreadcrumb } from "~/lib/sentry.server";
import { nowMillis } from "~/lib/temporal";

// ---------------------------------------------------------------------------
// Queue instances
// ---------------------------------------------------------------------------

const _scheduledPostsQueue = getQueueInstance(QUEUE_SCHEDULED_POSTS);
const _scheduledLongFormPostsQueue = getQueueInstance(
  QUEUE_SCHEDULED_LONGFORM_POSTS
);
const postCheckerQueue = getQueueInstance(QUEUE_POST_CHECKER);

const QUEUE_BROADCAST_DM = "broadcast-dm" as const;

// ---------------------------------------------------------------------------
// Worker: scheduled posts
// ---------------------------------------------------------------------------

export const scheduledPostsWorker = new Worker<PostJobData>(
  QUEUE_SCHEDULED_POSTS,
  async (job: Job<PostJobData>) => {
    const startTime = nowMillis();
    const queueName = QUEUE_SCHEDULED_POSTS;
    const ctx: { lease: PublishLease | null } = { lease: null };
    const { postId, userId, correlationId } = job.data;

    try {
      updateActiveJobs(queueName, 1);
      recordJobStarted(queueName);
      addBreadcrumb({
        message: "scheduled_post_job_started",
        category: "worker",
        level: "info",
        data: {
          queue: queueName,
          postId,
          userId,
          correlationId,
          jobId: job.id ?? "unknown",
          attempt: job.attemptsMade,
        },
      });
      return await runScheduledPostJob({ job, startTime, ctx });
    } catch (error) {
      await handleScheduledPostJobError({
        job,
        startTime,
        lease: ctx.lease,
        error,
      });
      throw error;
    } finally {
      updateActiveJobs(queueName, -1);
    }
  },
  {
    // BullMQ accepts ioredis instances at runtime, but TypeScript types don't reflect this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- BullMQ runtime accepts ioredis instance
    connection: redis as any,
    concurrency: 5,
  }
);

// ---------------------------------------------------------------------------
// Worker: scheduled longform posts
// ---------------------------------------------------------------------------

export const scheduledLongFormPostsWorker = new Worker<LongFormPostJobData>(
  QUEUE_SCHEDULED_LONGFORM_POSTS,
  async (job: Job<LongFormPostJobData>) => {
    const startTime = nowMillis();
    const queueName = QUEUE_SCHEDULED_LONGFORM_POSTS;
    const ctx: { lease: PublishLease | null } = { lease: null };
    const { postId, userId, correlationId } = job.data;

    try {
      updateActiveJobs(queueName, 1);
      recordJobStarted(queueName);
      addBreadcrumb({
        message: "scheduled_longform_job_started",
        category: "worker",
        level: "info",
        data: {
          queue: queueName,
          postId,
          userId,
          correlationId,
          jobId: job.id ?? "unknown",
          attempt: job.attemptsMade,
        },
      });
      return await runScheduledLongFormPostJob({ job, startTime, ctx });
    } catch (error) {
      await handleScheduledLongFormPostJobError({
        job,
        startTime,
        lease: ctx.lease,
        error,
      });
      throw error;
    } finally {
      updateActiveJobs(queueName, -1);
    }
  },
  {
    // BullMQ accepts ioredis instances at runtime, but TypeScript types don't reflect this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- BullMQ runtime accepts ioredis instance
    connection: redis as any,
    concurrency: 5,
  }
);

// ---------------------------------------------------------------------------
// Worker: broadcast DMs
// ---------------------------------------------------------------------------

export const broadcastDmWorker = new Worker<BroadcastJobData>(
  QUEUE_BROADCAST_DM,
  async (job: Job<BroadcastJobData>) => {
    const startTime = nowMillis();
    const queueName = QUEUE_BROADCAST_DM;
    try {
      updateActiveJobs(queueName, 1);
      recordJobStarted(queueName);
      addBreadcrumb({
        message: "broadcast_dm_job_started",
        category: "worker",
        level: "info",
        data: {
          queue: queueName,
          campaignId: job.data.campaignId,
          recipientId: job.data.recipientId,
          jobId: job.id ?? "unknown",
        },
      });
      const result = await runBroadcastDmJob(job);
      const duration = nowMillis() - startTime;
      recordJobMetrics(queueName, duration, true);
      return result;
    } catch (error) {
      const duration = nowMillis() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      recordJobMetrics(queueName, duration, false, err);
      throw error;
    } finally {
      updateActiveJobs(queueName, -1);
    }
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- BullMQ runtime accepts ioredis instance
    connection: redis as any,
    concurrency: 3,
  }
);

// ---------------------------------------------------------------------------
// Worker: post checker
// ---------------------------------------------------------------------------

export const postCheckerWorker = new Worker(
  QUEUE_POST_CHECKER,
  async () => {
    const startTime = nowMillis();
    const queueName = QUEUE_POST_CHECKER;
    updateActiveJobs(queueName, 1);
    recordJobStarted(queueName);
    try {
      const result = await runPostChecker();
      const duration = nowMillis() - startTime;
      recordJobMetrics(queueName, duration, true);
      return result;
    } catch (error) {
      const duration = nowMillis() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      recordJobMetrics(queueName, duration, false, err);
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Error checking scheduled posts",
      });
      throw error;
    } finally {
      updateActiveJobs(queueName, -1);
    }
  },
  {
    // BullMQ accepts ioredis instances at runtime, but TypeScript types don't reflect this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- BullMQ runtime accepts ioredis instance
    connection: redis as any,
    concurrency: 1,
  }
);

// ---------------------------------------------------------------------------
// Start post checker recurring job
// ---------------------------------------------------------------------------

async function startPostChecker() {
  await postCheckerQueue.add(
    "check-due-posts",
    {},
    {
      repeat: { every: 60000 },
      removeOnComplete: 1,
      removeOnFail: 1,
    }
  );
  logInfo("Post checker recurring job registered", { interval: 60000 });
}

void (async () => {
  try {
    await startPostChecker();
    logInfo("Post checker initialized successfully");
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error starting post checker",
    });
  }
})();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on("SIGTERM", () => {
  void (async () => {
    await scheduledPostsWorker.close();
    await scheduledLongFormPostsWorker.close();
    await broadcastDmWorker.close();
    await postCheckerWorker.close();
    await closeAllQueues();
  })();
});

process.on("SIGINT", () => {
  void (async () => {
    await scheduledPostsWorker.close();
    await scheduledLongFormPostsWorker.close();
    await broadcastDmWorker.close();
    await postCheckerWorker.close();
    await closeAllQueues();
  })();
});

// ---------------------------------------------------------------------------
// Re-exports from infra/queue
// ---------------------------------------------------------------------------

export {
  enqueuePostJob as schedulePost,
  cancelPostJob as cancelScheduledPost,
  enqueueLongFormPostJob as scheduleLongFormPost,
  cancelLongFormPostJob as cancelScheduledLongFormPost,
} from "~/infra/queue";
