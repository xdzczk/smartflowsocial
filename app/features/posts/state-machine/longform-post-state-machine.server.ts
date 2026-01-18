/**
 * LongFormPost State Machine Service
 *
 * Manages longform post state transitions with database persistence.
 */

import type { Prisma } from "@prisma/client";

import { recordLongFormPostStateTransition } from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";

import {
  transitionLongFormPost,
  type LongFormPostState,
  type LongFormPostStateTransition,
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
    reason: string,
    options?: {
      /**
       * Additional LongFormPost fields to update atomically with the state transition.
       * Used by queue workers to avoid stuck states under crashes/retries.
       */
      additionalPostData?: Prisma.LongFormPostUpdateInput;
    }
  ): Promise<void> {
    const post = await prisma.longFormPost.findUnique({
      where: { id: postId, userId },
      select: { currentState: true },
    });

    if (!post) {
      throw new Error(`LongFormPost ${postId} not found for user ${userId}`);
    }

    const currentState = (post.currentState || "DRAFT") as LongFormPostState;

    // Skip transition if already in target state.
    // If additional fields need updating (e.g. releasing locks), update them and return.
    if (currentState === targetState) {
      if (options?.additionalPostData) {
        await prisma.longFormPost.update({
          where: { id: postId, userId },
          data: options.additionalPostData,
        });
      }
      return;
    }

    const transition = transitionLongFormPost(
      currentState,
      targetState,
      reason
    );

    await prisma.$transaction(async (tx) => {
      // Update post state (flags have been removed)
      await tx.longFormPost.update({
        where: { id: postId, userId },
        data: {
          currentState: targetState,
          ...(options?.additionalPostData ?? {}),
        },
      });

      // Record transition
      await tx.longFormPostStateTransition.create({
        data: {
          longFormPostId: postId,
          fromState: transition.from,
          toState: transition.to,
          reason: transition.reason,
        },
      });
    });

    // Record state transition metric
    recordLongFormPostStateTransition(transition.from, transition.to);
  }

  /**
   * Get state transition history for a longform post
   */
  async getStateHistory(
    postId: string
  ): Promise<LongFormPostStateTransition[]> {
    const transitions = await prisma.longFormPostStateTransition.findMany({
      where: { longFormPostId: postId },
      orderBy: { createdAt: "desc" },
    });

    return transitions.map((t) => ({
      from: t.fromState as LongFormPostState,
      to: t.toState as LongFormPostState,
      reason: t.reason,
      timestamp: t.createdAt,
    }));
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
