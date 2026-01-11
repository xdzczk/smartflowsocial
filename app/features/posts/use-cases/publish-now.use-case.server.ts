/**
 * Publish Now Use Case
 *
 * Publishes a post immediately to Nostr relays.
 */

import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo, logError as logErrorUtil } from "~/lib/error-logger.server";
import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import {
  recordPostPublished,
  recordPostPublishFailed,
} from "~/lib/metrics/business-metrics.server";
import { recordPublishLatency } from "~/lib/metrics/performance-metrics.server";

import type { SignedEvent } from "~/features/nostr/types";
import { updatePostStatus } from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";
import { PostStateMachine } from "../state-machine/post-state-machine.server";

import type { PublishNowInput } from "./types";

export class PublishNowUseCase {
  private stateMachine = new PostStateMachine();

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
      throw new Error(`Post ${input.postId} not found for user ${input.userId}`);
    }
    if (post.isPosted) {
      throw new Error(`Post ${input.postId} already published`);
    }

    // Transition to PUBLISHING
    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHING",
      "Publishing post immediately"
    );

    const publishStartTime = Date.now();
    try {
      // Update status and publish in parallel
      const publisher = getNostrPublisher();
      await Promise.all([
        updatePostStatus({
          id: input.postId,
          userId: input.userId,
          isPosted: true,
        }),
        publisher.publish(input.signedEvent, input.relays, correlationId),
      ]);

      const publishLatency = Date.now() - publishStartTime;

      // Transition to PUBLISHED
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
      const publishLatency = Date.now() - publishStartTime;
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

      logErrorUtil(
        error instanceof Error ? error : new Error(String(error)),
        {
          postId: input.postId,
          userId: input.userId,
          correlationId,
          message: "PublishNowUseCase: Failed to publish post",
        }
      );
      throw error;
    }
  }
}
