/**
 * LongFormPost State Machine Service
 *
 * Manages longform post state transitions with database persistence.
 */

import { prisma } from "~/lib/prisma.server";

import {
  transitionLongFormPost,
  type LongFormPostState,
} from "./longform-post-state";

export class LongFormPostStateMachine {
  /**
   * Transition a longform post to a new state
   * Records the transition in the database
   */
  async transition(
    postId: string,
    userId: string,
    targetState: LongFormPostState,
    reason: string
  ): Promise<void> {
    const post = await prisma.longFormPost.findUnique({
      where: { id: postId, userId },
      select: { currentState: true },
    });

    if (!post) {
      throw new Error(`LongFormPost ${postId} not found for user ${userId}`);
    }

    const currentState = (post.currentState || "DRAFT") as LongFormPostState;

    // Skip transition if already in target state (but still record it for history)
    if (currentState === targetState) {
      // Still record the transition for audit purposes, even if state doesn't change
      // Note: LongFormPost doesn't have a state transition table yet
      // TODO: Add LongFormPostStateTransition table if audit trail is needed
      return;
    }

    transitionLongFormPost(currentState, targetState, reason);

    await prisma.$transaction(async (tx) => {
      // Update post state (flags have been removed)
      await tx.longFormPost.update({
        where: { id: postId },
        data: {
          currentState: targetState,
        },
      });

      // TODO: Record transition in LongFormPostStateTransition table if needed
      // For now, we'll rely on the state field itself for audit
    });

    // Record state transition metric
    // TODO: Re-enable analytics when analytics.server module is available
    // recordLongFormPostStateTransition(transition.from, transition.to);
  }

  /**
   * Get current state of a longform post
   */
  async getCurrentState(postId: string): Promise<LongFormPostState | null> {
    const post = await prisma.longFormPost.findUnique({
      where: { id: postId },
      select: { currentState: true },
    });

    return (post?.currentState ?? "DRAFT") as LongFormPostState;
  }
}
