/**
 * Shared helpers and constants for queue job handlers.
 * Used by post-job, longform-job, and checker-job handlers.
 */

import type { SignedEvent } from "~/features/nostr/types";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import {
  getNostrPublisher,
  type NostrPublishResult,
} from "~/infra/publishers/nostr-publisher.server";
import type { QueueType } from "~/infra/queue/queue-types";
import { getRetryPolicy, shouldRetry } from "~/infra/queue/retry-policy.server";
import { isRetryableErrorEnhanced } from "~/lib/error-classification.server";
import { withSentrySpan } from "~/lib/sentry.server";
import { nowMillis } from "~/lib/temporal";

export const QUEUE_SCHEDULED_POSTS: QueueType = "scheduled-posts";
export const QUEUE_SCHEDULED_LONGFORM_POSTS: QueueType =
  "scheduled-longform-posts";
export const QUEUE_POST_CHECKER: QueueType = "post-checker";

export const SENTRY_QUEUE_PUBLISH_NAME = "queue.publish";
export const SENTRY_QUEUE_PUBLISH_OP = "queue.publish";

export interface WorkerSuccessResult {
  success: true;
  postId: string;
  skipped?: boolean;
}

export async function getSanitizedUserRelays(
  userId: string
): Promise<string[]> {
  return await resolveExecutionRelays(userId);
}

export async function publishWithQueueSpan(input: {
  queueName: QueueType;
  attributes: Record<string, unknown>;
  event: SignedEvent;
  relays: string[];
  correlationId?: string;
}): Promise<{
  publishLatencyMs: number;
  publishResult: NostrPublishResult;
}> {
  const publisher = getNostrPublisher();
  const publishStartTime = nowMillis();
  const publishResult = await withSentrySpan(
    {
      name: SENTRY_QUEUE_PUBLISH_NAME,
      op: SENTRY_QUEUE_PUBLISH_OP,
      attributes: input.attributes,
    },
    async () =>
      await publisher.publish(input.event, input.relays, input.correlationId)
  );
  return { publishLatencyMs: nowMillis() - publishStartTime, publishResult };
}

export function computeWillRetry(input: {
  queueName: QueueType;
  attemptsMade: number;
  error: Error;
}): boolean {
  const policy = getRetryPolicy(input.queueName);
  return (
    shouldRetry(input.attemptsMade, policy) &&
    isRetryableErrorEnhanced(input.error)
  );
}
