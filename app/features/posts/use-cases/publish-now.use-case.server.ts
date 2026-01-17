/**
 * Publish Now Use Case
 *
 * Publishes a post immediately to Nostr relays.
 */

import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo, logError as logErrorUtil } from "~/lib/error-logger.server";
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

      // Transition to PUBLISHED (this will automatically sync flags including isPosted)
      await this.stateMachine.transition(
        input.postId,
        input.userId,
        "PUBLISHED",
        "Successfully published to Nostr"
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
      await this.stateMachine.transition(
        input.postId,
        input.userId,
        "FAILED",
        `Publish failed: ${error instanceof Error ? error.message : String(error)}`
      );

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
