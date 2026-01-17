/**
 * Cancel Schedule Use Case
 *
 * Cancels a scheduled post by removing it from the queue and updating its state.
 */

import { cancelPostJob } from "~/infra/queue";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo, logError } from "~/lib/error-logger.server";
import { recordPostCancelled } from "~/lib/metrics/business-metrics.server";
import { updatePost } from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";

import { deriveIsScheduled } from "../state-machine/post-state";
import { PostStateMachine } from "../state-machine/post-state-machine.server";

import type { CancelPostInput } from "./types";

export class CancelScheduleUseCase {
  private readonly stateMachine = new PostStateMachine();

  async execute(input: CancelPostInput): Promise<{ cancelled: boolean }> {
    // Get or create correlation ID for this operation
    const correlationId = getCorrelationId();

    logInfo("CancelScheduleUseCase: Starting post cancellation", {
      postId: input.postId,
      userId: input.userId,
      correlationId,
    });

    // Verify post exists
    const post = await getPostById({ id: input.postId, userId: input.userId });
    if (!post) {
      throw new Error(
        `Post ${input.postId} not found for user ${input.userId}`
      );
    }

    // Check if post is actually scheduled
    // Use currentState as single source of truth
    const isScheduled = deriveIsScheduled(post.currentState);
    if (!isScheduled) {
      logInfo(
        "CancelScheduleUseCase: Post is not scheduled, nothing to cancel",
        {
          postId: input.postId,
          userId: input.userId,
          correlationId,
        }
      );
      return { cancelled: false };
    }

    // Cancel the job in the queue
    const jobCancelled = await cancelPostJob(input.postId);

    if (!jobCancelled) {
      logInfo(
        "CancelScheduleUseCase: Job not found in queue (may have already been processed)",
        {
          postId: input.postId,
          userId: input.userId,
          correlationId,
        }
      );
    }

    // Clear scheduled time (flags will be set by state machine)
    await updatePost({
      id: input.postId,
      userId: input.userId,
      data: {
        scheduledFor: null,
        // @deprecated - isScheduled flag removed. State machine will set it via transition.
      },
    });

    // Transition to CANCELLED state (this will automatically sync flags)
    try {
      await this.stateMachine.transition(
        input.postId,
        input.userId,
        "CANCELLED",
        "Post schedule cancelled by user"
      );
    } catch (error) {
      // Log but don't throw - state transition failure shouldn't block cancellation
      logError(error instanceof Error ? error : new Error(String(error)), {
        postId: input.postId,
        userId: input.userId,
        correlationId,
        message: "Failed to transition to CANCELLED state",
      });
    }

    // Record metrics
    recordPostCancelled(post.postType);

    logInfo("CancelScheduleUseCase: Post cancelled successfully", {
      postId: input.postId,
      userId: input.userId,
      jobCancelled,
      correlationId,
    });

    return { cancelled: true };
  }
}
