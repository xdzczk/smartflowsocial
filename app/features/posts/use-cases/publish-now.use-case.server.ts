/**
 * Publish Now Use Case
 *
 * Publishes a post immediately to Nostr relays.
 */

import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import {
  acquirePostPublishLease,
  releasePostPublishLease,
  type PublishLease,
} from "~/infra/publishing/publish-lease.server";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo, logError as logErrorUtil } from "~/lib/error-logger.server";
import { generatePublishAttemptId } from "~/lib/idempotency.server";
import {
  recordPostPublished,
  recordPostPublishFailed,
} from "~/lib/metrics/business-metrics.server";
import { recordPublishLatency } from "~/lib/metrics/performance-metrics.server";
import { nowMillis } from "~/lib/temporal";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";
import { getPostById } from "~/models/post.queries.server";

import { deriveIsPosted } from "../state-machine/post-state";
import { PostStateMachine } from "../state-machine/post-state-machine.server";

import type { PublishNowInput } from "./types";

export class PublishNowUseCase {
  private readonly stateMachine = new PostStateMachine();

  async execute(input: PublishNowInput): Promise<void> {
    // Get or create correlation ID for this operation
    const correlationId = getCorrelationId(input.correlationId);

    logInfo("PublishNowUseCase: Starting immediate publish", {
      postId: input.postId,
      userId: input.userId,
      correlationId,
    });

    // Verify post exists and not already posted
    const post = await getPostById({ id: input.postId, userId: input.userId });
    if (!post) {
      throw new Error(
        `Post ${input.postId} not found for user ${input.userId}`
      );
    }
    // Use currentState as single source of truth
    const isAlreadyPosted = deriveIsPosted(post.currentState);
    if (isAlreadyPosted) {
      throw new Error(`Post ${input.postId} already published`);
    }

    // Cryptographically validate the signed event before publishing
    // This ensures the event signature and ID are valid
    const validatedSignedEvent = validateSignedEventCryptographically(
      input.signedEvent
    );

    // Transition to PUBLISHING
    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHING",
      "Publishing post immediately"
    );

    // Acquire a DB-backed publish lease. This prevents concurrent publishes and makes retries safe.
    // Note: we acquire after transitioning to PUBLISHING because the lease guard is state-based.
    let lease: PublishLease | null = null;
    lease = await acquirePostPublishLease({
      postId: input.postId,
      userId: input.userId,
    });
    if (!lease) {
      logInfo(
        "PublishNowUseCase: Publish lease held, skipping duplicate publish",
        {
          postId: input.postId,
          userId: input.userId,
          correlationId,
        }
      );
      return;
    }

    const publishAttemptId = generatePublishAttemptId(
      input.postId,
      validatedSignedEvent.created_at,
      0
    );

    const publishStartTime = nowMillis();
    try {
      // Publish to Nostr (flags will be set by state machine transition)
      const publisher = getNostrPublisher();
      await publisher.publish(
        validatedSignedEvent,
        input.relays,
        correlationId
      );

      const publishLatency = nowMillis() - publishStartTime;

      // Transition to PUBLISHED and atomically persist publish metadata.
      await this.stateMachine.transition(
        input.postId,
        input.userId,
        "PUBLISHED",
        "Successfully published to Nostr",
        {
          additionalPostData: {
            nostrEventId: validatedSignedEvent.id,
            publishAttemptId,
            postedAt: new Date(),
            publishingLockId: null,
            publishingLockExpiresAt: null,
          },
        }
      );

      // Record metrics
      recordPostPublished(post.postType, "immediate");
      recordPublishLatency(post.postType, "immediate", publishLatency);

      logInfo("PublishNowUseCase: Post published successfully", {
        postId: input.postId,
        userId: input.userId,
        correlationId,
      });
    } catch (error) {
      const publishLatency = nowMillis() - publishStartTime;
      const errorType =
        error instanceof Error ? error.constructor.name : "UnknownError";

      // Transition to FAILED
      try {
        await this.stateMachine.transition(
          input.postId,
          input.userId,
          "FAILED",
          `Publish failed: ${error instanceof Error ? error.message : String(error)}`,
          {
            additionalPostData: {
              publishingLockId: null,
              publishingLockExpiresAt: null,
            },
          }
        );
      } catch (transitionError) {
        // Best-effort release: avoid wedging this post until lease expiry.
        await releasePostPublishLease({
          postId: input.postId,
          userId: input.userId,
          lockId: lease.lockId,
        });
        throw transitionError;
      }

      // Record metrics
      recordPostPublishFailed(post.postType, "immediate", errorType);
      recordPublishLatency(post.postType, "immediate", publishLatency);

      logErrorUtil(error instanceof Error ? error : new Error(String(error)), {
        postId: input.postId,
        userId: input.userId,
        correlationId,
        message: "PublishNowUseCase: Failed to publish post",
      });
      throw error;
    }
  }
}
