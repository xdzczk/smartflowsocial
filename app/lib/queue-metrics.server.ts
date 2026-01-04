/**
 * Queue Performance Metrics
 *
 * Provides Prometheus metrics for queue job performance monitoring.
 * Metrics are automatically registered with the default Prometheus registry
 * and will be exposed via the /metrics endpoint.
 */

import * as promClient from "prom-client";

import { singleton } from "./singleton.server";

/**
 * Get or create a metric, handling hot-reloads gracefully
 */
function getOrCreateMetric<T extends promClient.Metric>(
  name: string,
  factory: () => T,
): T {
  return singleton(`prom_metric_${name}`, () => {
    // Check if metric already exists in registry
    const registry = promClient.register;
    try {
      const existingMetric = registry.getSingleMetric(name);
      if (existingMetric) {
        return existingMetric as T;
      }
    } catch {
      // Metric doesn't exist, continue to create it
    }

    try {
      return factory();
    } catch (error) {
      // If metric already exists (e.g., from hot reload), try to get it
      if (
        error instanceof Error &&
        error.message.includes("has already been registered")
      ) {
        const existingMetric = registry.getSingleMetric(name);
        if (existingMetric) {
          return existingMetric as T;
        }
      }
      throw error;
    }
  });
}

/**
 * Job processing duration histogram
 * Tracks how long jobs take to process, broken down by queue and status
 */
export const jobDurationHistogram = getOrCreateMetric(
  "queue_job_duration_ms",
  () =>
    new promClient.Histogram({
      name: "queue_job_duration_ms",
      help: "Duration of queue job processing in milliseconds",
      labelNames: ["queue", "status"],
      buckets: [100, 500, 1000, 2000, 5000, 10000, 30000, 60000],
    }),
);

/**
 * Job counter
 * Tracks total number of jobs processed
 */
export const jobCounter = getOrCreateMetric(
  "queue_job_total",
  () =>
    new promClient.Counter({
      name: "queue_job_total",
      help: "Total number of queue jobs processed",
      labelNames: ["queue", "status"],
    }),
);

/**
 * Failed job counter
 * Tracks number of failed jobs
 */
export const failedJobCounter = getOrCreateMetric(
  "queue_job_failed_total",
  () =>
    new promClient.Counter({
      name: "queue_job_failed_total",
      help: "Total number of failed queue jobs",
      labelNames: ["queue", "error_type"],
    }),
);

/**
 * Queue length gauge
 * Tracks current queue length (waiting jobs)
 */
export const queueLengthGauge = getOrCreateMetric(
  "queue_length",
  () =>
    new promClient.Gauge({
      name: "queue_length",
      help: "Current number of jobs waiting in queue",
      labelNames: ["queue"],
    }),
);

/**
 * Active jobs gauge
 * Tracks number of jobs currently being processed
 */
export const activeJobsGauge = getOrCreateMetric(
  "queue_active_jobs",
  () =>
    new promClient.Gauge({
      name: "queue_active_jobs",
      help: "Number of jobs currently being processed",
      labelNames: ["queue"],
    }),
);

/**
 * Retry counter
 * Tracks number of job retries
 */
export const retryCounter = getOrCreateMetric(
  "queue_job_retries_total",
  () =>
    new promClient.Counter({
      name: "queue_job_retries_total",
      help: "Total number of job retries",
      labelNames: ["queue"],
    }),
);

/**
 * Stuck job counter
 * Tracks jobs that have been processing for too long
 */
export const stuckJobCounter = getOrCreateMetric(
  "queue_stuck_jobs_total",
  () =>
    new promClient.Counter({
      name: "queue_stuck_jobs_total",
      help: "Total number of stuck jobs (processing > 5 minutes)",
      labelNames: ["queue"],
    }),
);

/**
 * Record job metrics
 */
export function recordJobMetrics(
  queue: string,
  duration: number,
  success = true,
  error?: Error,
): void {
  const status = success ? "success" : "error";

  // Record duration
  jobDurationHistogram.observe(
    {
      queue,
      status,
    },
    duration,
  );

  // Increment job counter
  jobCounter.inc({
    queue,
    status,
  });

  // Record failed jobs
  if (!success) {
    const errorType = error?.constructor.name ?? "UnknownError";
    failedJobCounter.inc({
      queue,
      error_type: errorType,
    });

    // Record stuck jobs (processing > 5 minutes)
    if (duration > 300000) {
      // 5 minutes
      stuckJobCounter.inc({
        queue,
      });
    }
  }
}

/**
 * Update queue length gauge
 */
export function updateQueueLength(queue: string, length: number): void {
  queueLengthGauge.set({ queue }, length);
}

/**
 * Update active jobs gauge
 */
export function updateActiveJobs(queue: string, active: number): void {
  activeJobsGauge.set({ queue }, active);
}

/**
 * Record job retry
 */
export function recordJobRetry(queue: string): void {
  retryCounter.inc({ queue });
}



