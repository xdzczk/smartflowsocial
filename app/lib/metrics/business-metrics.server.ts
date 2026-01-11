/**
 * Business Metrics
 *
 * Tracks business-level metrics for posts:
 * - Post creation rate (by type, by user)
 * - Post publication success/failure
 * - Post scheduling rate
 * - State transitions
 * - Outbox events processed
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
 * Post creation counter
 * Tracks posts created by type
 */
export const postCreatedCounter = getOrCreateMetric(
  "posts_created_total",
  () =>
    new promClient.Counter({
      name: "posts_created_total",
      help: "Total number of posts created",
      labelNames: ["post_type", "is_scheduled"],
    })
);

/**
 * Post published counter
 * Tracks posts successfully published
 */
export const postPublishedCounter = getOrCreateMetric(
  "posts_published_total",
  () =>
    new promClient.Counter({
      name: "posts_published_total",
      help: "Total number of posts published",
      labelNames: ["post_type", "publish_method"], // publish_method: "immediate" | "scheduled"
    })
);

/**
 * Post publish failure counter
 * Tracks failed post publications
 */
export const postPublishFailedCounter = getOrCreateMetric(
  "posts_publish_failed_total",
  () =>
    new promClient.Counter({
      name: "posts_publish_failed_total",
      help: "Total number of failed post publications",
      labelNames: ["post_type", "publish_method", "error_type"],
    })
);

/**
 * Post scheduled counter
 * Tracks posts scheduled for future publication
 */
export const postScheduledCounter = getOrCreateMetric(
  "posts_scheduled_total",
  () =>
    new promClient.Counter({
      name: "posts_scheduled_total",
      help: "Total number of posts scheduled",
      labelNames: ["post_type"],
    })
);

/**
 * Post state transition counter
 * Tracks state transitions for posts
 */
export const postStateTransitionCounter = getOrCreateMetric(
  "posts_state_transitions_total",
  () =>
    new promClient.Counter({
      name: "posts_state_transitions_total",
      help: "Total number of post state transitions",
      labelNames: ["from_state", "to_state"],
    })
);

/**
 * Outbox events processed counter
 * Tracks outbox events processed
 */
export const outboxEventsProcessedCounter = getOrCreateMetric(
  "outbox_events_processed_total",
  () =>
    new promClient.Counter({
      name: "outbox_events_processed_total",
      help: "Total number of outbox events processed",
      labelNames: ["event_type", "status"], // status: "success" | "error"
    })
);

/**
 * Record post creation
 */
export function recordPostCreated(
  postType: string,
  isScheduled: boolean
): void {
  postCreatedCounter.inc({
    post_type: postType,
    is_scheduled: isScheduled ? "true" : "false",
  });
}

/**
 * Record post published
 */
export function recordPostPublished(
  postType: string,
  publishMethod: "immediate" | "scheduled"
): void {
  postPublishedCounter.inc({
    post_type: postType,
    publish_method: publishMethod,
  });
}

/**
 * Record post publish failure
 */
export function recordPostPublishFailed(
  postType: string,
  publishMethod: "immediate" | "scheduled",
  errorType?: string
): void {
  postPublishFailedCounter.inc({
    post_type: postType,
    publish_method: publishMethod,
    error_type: errorType ?? "UnknownError",
  });
}

/**
 * Record post scheduled
 */
export function recordPostScheduled(postType: string): void {
  postScheduledCounter.inc({
    post_type: postType,
  });
}

/**
 * Record post state transition
 */
export function recordPostStateTransition(
  fromState: string,
  toState: string
): void {
  postStateTransitionCounter.inc({
    from_state: fromState,
    to_state: toState,
  });
}

/**
 * Record outbox event processed
 */
export function recordOutboxEventProcessed(
  eventType: string,
  success: boolean
): void {
  outboxEventsProcessedCounter.inc({
    event_type: eventType,
    status: success ? "success" : "error",
  });
}
