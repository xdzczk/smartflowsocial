/**
 * Queue client implementation using BullMQ
 * This is the concrete implementation of the QueueClient interface
 */

import { Queue } from "bullmq";
import Redis from "ioredis";

import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";

import type {
  QueueClient,
  QueueType,
  ScheduleOptions,
  QueueOperationResult,
  JobStatus,
  PostJobData,
  LongFormPostJobData,
} from "./queue-types";

// Redis connection with BullMQ required config
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Queue instances - lazy loaded
const queues = new Map<QueueType, Queue>();

/**
 * Get or create a queue instance
 */
function getQueue(queueName: QueueType): Queue {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: queueName === "post-checker" ? 10 : 100,
        removeOnFail: queueName === "post-checker" ? 10 : 50,
      },
    });
    queues.set(queueName, queue);
  }
  const existingQueue = queues.get(queueName);
  if (!existingQueue) {
    throw new Error(`Queue ${queueName} not found`);
  }
  return existingQueue;
}

/**
 * BullMQ implementation of QueueClient
 */
class BullMQClient implements QueueClient {
  async enqueue<T = unknown>(
    queueName: QueueType,
    jobName: string,
    data: T,
    options?: ScheduleOptions,
  ): Promise<QueueOperationResult> {
    try {
      const queue = getQueue(queueName);

      let delay: number | undefined;

      if (options?.scheduledFor !== undefined) {
        // Calculate delay from scheduled timestamp (in seconds) to now
        delay = options.scheduledFor * 1000 - Date.now();
        // Allow delay: 0 for immediate processing
        if (delay < 0) {
          return {
            success: false,
            error: "Scheduled time must be in the future",
          };
        }
      } else if (options?.delay !== undefined) {
        delay = options.delay;
      }

      const job = await queue.add(jobName, data, { delay });

      return {
        success: true,
        jobId: job.id,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to enqueue job";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async cancelByData(
    queueName: QueueType,
    dataKey: string,
    dataValue: string,
  ): Promise<boolean> {
    try {
      const queue = getQueue(queueName);
      const jobs = await queue.getJobs(["waiting", "delayed"]);
      const job = jobs.find((j) => {
        const jobData: unknown = j.data;
        if (
          jobData &&
          typeof jobData === "object" &&
          !Array.isArray(jobData) &&
          dataKey in jobData
        ) {
          const dataValueInJob = (jobData as Record<string, unknown>)[dataKey];
          return String(dataValueInJob) === dataValue;
        }
        return false;
      });

      if (job) {
        await job.remove();
        return true;
      }

      return false;
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        queueName,
        message: "Error canceling job",
      });
      return false;
    }
  }

  async getJobs(
    queueName: QueueType,
    statuses: JobStatus[],
  ): Promise<
    { id: string; data: PostJobData | LongFormPostJobData; status: JobStatus }[]
  > {
    try {
      const queue = getQueue(queueName);
      // BullMQ's getJobs accepts an array of status strings
      const jobs = await queue.getJobs(statuses);

      return jobs.map((job) => {
        const jobId: unknown = job.id;
        const jobData: unknown = job.data;
        const id = typeof jobId === "string" ? jobId : String(jobId ?? "");
        const data: PostJobData | LongFormPostJobData = jobData as
          | PostJobData
          | LongFormPostJobData;
        const status: JobStatus = (
          job.opts.delay && job.opts.delay > 0 ? "delayed" : "waiting"
        ) as JobStatus;
        return { id, data, status };
      });
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        queueName,
        statuses,
        message: "Error getting jobs",
      });
      return [];
    }
  }

  async removeJob(queueName: QueueType, jobId: string): Promise<boolean> {
    try {
      const queue = getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (job) {
        await job.remove();
        return true;
      }

      return false;
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        queueName,
        jobId,
        message: "Error removing job",
      });
      return false;
    }
  }
}

// Export singleton instance
export const queueClient: QueueClient = new BullMQClient();

// Export queue getter for workers (they still need direct access)
export function getQueueInstance(queueName: QueueType): Queue {
  return getQueue(queueName);
}

// Export redis connection for workers
export { redis };

// Graceful shutdown helper
export async function closeAllQueues(): Promise<void> {
  for (const queue of queues.values()) {
    await queue.close();
  }
  await redis.quit();
}
