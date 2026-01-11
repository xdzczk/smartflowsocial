/**
 * Performance Metrics
 *
 * Tracks performance metrics:
 * - Publish latency (p50, p95, p99)
 * - Queue processing time
 * - Outbox processing time
 */

import * as promClient from "prom-client";

import { singleton } from "../singleton.server";

/**
 * Get or create a metric, handling hot-reloads gracefully
 */
function getOrCreateMetric<T extends promClient.Metric>(
  name: string,
  factory: () => T
): T {
  return singleton(`prom_metric_${name}`, () => {
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
 * Publish latency histogram
 * Tracks how long it takes to publish posts to Nostr
 */
export const publishLatencyHistogram = getOrCreateMetric(
  "publish_latency_ms",
  () =>
    new promClient.Histogram({
      name: "publish_latency_ms",
      help: "Latency of publishing posts to Nostr in milliseconds",
      labelNames: ["post_type", "publish_method"], // publish_method: "immediate" | "scheduled"
      buckets: [100, 500, 1000, 2000, 5000, 10000, 15000, 30000],
    })
);

/**
 * Outbox processing duration histogram
 * Tracks how long it takes to process outbox events
 */
export const outboxProcessingDurationHistogram = getOrCreateMetric(
  "outbox_processing_duration_ms",
  () =>
    new promClient.Histogram({
      name: "outbox_processing_duration_ms",
      help: "Duration of outbox event processing in milliseconds",
      labelNames: ["event_type", "status"],
      buckets: [10, 50, 100, 500, 1000, 2000, 5000],
    })
);

/**
 * Record publish latency
 */
export function recordPublishLatency(
  postType: string,
  publishMethod: "immediate" | "scheduled",
  latencyMs: number
): void {
  publishLatencyHistogram.observe(
    {
      post_type: postType,
      publish_method: publishMethod,
    },
    latencyMs
  );
}

/**
 * Record outbox processing duration
 */
export function recordOutboxProcessingDuration(
  eventType: string,
  durationMs: number,
  success: boolean
): void {
  outboxProcessingDurationHistogram.observe(
    {
      event_type: eventType,
      status: success ? "success" : "error",
    },
    durationMs
  );
}
