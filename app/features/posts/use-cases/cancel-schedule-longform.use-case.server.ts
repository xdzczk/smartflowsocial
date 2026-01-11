/**
 * Cancel Schedule Longform Use Case
 *
 * Cancels a scheduled longform post by removing it from the queue and updating its state.
 */

import { cancelLongFormPostJob } from "~/infra/queue";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo, logError } from "~/lib/error-logger.server";
import {
  getLongFormPost,
  updateLongFormPost,
} from "~/models/longformpost.server";

export interface CancelLongFormPostInput {
  postId: string;
  userId: string;
  correlationId?: string;
}

export class CancelScheduleLongFormUseCase {
  async execute(
    input: CancelLongFormPostInput
  ): Promise<{ cancelled: boolean }> {
    // Get or create correlation ID for this operation
    const correlationId = getCorrelationId(input.correlationId);

    logInfo(
      "CancelScheduleLongFormUseCase: Starting longform post cancellation",
      {
        postId: input.postId,
        userId: input.userId,
        correlationId,
      }
    );

    // Verify post exists
    const post = await getLongFormPost({
      id: input.postId,
      userId: input.userId,
    });
    if (!post) {
      throw new Error(
        `Longform post ${input.postId} not found for user ${input.userId}`
      );
    }

    // Check if post is actually scheduled
    if (!post.isScheduled) {
      logInfo(
        "CancelScheduleLongFormUseCase: Post is not scheduled, nothing to cancel",
        {
          postId: input.postId,
          userId: input.userId,
          correlationId,
        }
      );
      return { cancelled: false };
    }

    // Cancel the job in the queue
    const jobCancelled = await cancelLongFormPostJob(input.postId);

    if (!jobCancelled) {
      logInfo(
        "CancelScheduleLongFormUseCase: Job not found in queue (may have already been processed)",
        {
          postId: input.postId,
          userId: input.userId,
          correlationId,
        }
      );
    }

    // Update post to mark as not scheduled
    try {
      await updateLongFormPost({
        id: input.postId,
        userId: input.userId,
        scheduledFor: null,
      });
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        postId: input.postId,
        userId: input.userId,
        correlationId,
        message: "Failed to update longform post",
      });
      throw error;
    }

    logInfo(
      "CancelScheduleLongFormUseCase: Longform post cancelled successfully",
      {
        postId: input.postId,
        userId: input.userId,
        jobCancelled,
        correlationId,
      }
    );

    return { cancelled: true };
  }
}
