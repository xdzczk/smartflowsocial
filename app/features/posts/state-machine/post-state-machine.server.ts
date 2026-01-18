/**
 * Post State Machine Service
 *
 * Manages post state transitions with database persistence.
 */

import type { Prisma } from "@prisma/client";

import { recordPostStateTransition } from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";

import {
  transitionPost,
  type PostState,
  type PostStateTransition,
} from "./post-state";

export class PostStateMachine {
  /**
   * Transition a post to a new state
   * Records the transition in the database
   */
  async transition(
    postId: string,
    userId: string,
    targetState: PostState,
    reason: string,
    options?: {
      /**
       * Additional Post fields to update atomically with the state transition.
       *
       * This is used by queue workers to make \"attempt succeeded\" updates (e.g. `postedAt`,
       * `publishAttemptId`) atomic with the transition to `PUBLISHED`, preventing stuck states
       * under crashes/retries.
       */
      additionalPostData?: Prisma.PostUpdateInput;
    }
  ): Promise<void> {
    const post = await prisma.post.findUnique({
      where: { id: postId, userId },
      select: { currentState: true },
    });

    if (!post) {
      throw new Error(`Post ${postId} not found for user ${userId}`);
    }

    const currentState = (post.currentState || "DRAFT") as PostState;

    // Skip transition if already in target state.
    // If additional fields need updating (e.g. releasing locks), update them and return.
    if (currentState === targetState) {
      if (options?.additionalPostData) {
        await prisma.post.update({
          where: { id: postId, userId },
          data: options.additionalPostData,
        });
      }
      return;
    }

    const transition = transitionPost(currentState, targetState, reason);

    await prisma.$transaction(async (tx) => {
      // Update post state (flags have been removed)
      // Include userId in where clause for consistency and security
      // If post was deleted between check and transaction, this will throw a clear error
      try {
        await tx.post.update({
          where: { id: postId, userId },
          data: {
            currentState: targetState,
            ...(options?.additionalPostData ?? {}),
          },
        });
      } catch (error) {
        // Provide clearer error message if post was deleted
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          throw new Error(
            `Post ${postId} not found for user ${userId} (may have been deleted)`
          );
        }
        throw error;
      }

      // Record transition
      await tx.postStateTransition.create({
        data: {
          postId,
          fromState: transition.from,
          toState: transition.to,
          reason: transition.reason,
        },
      });
    });

    // Record state transition metric
    recordPostStateTransition(transition.from, transition.to);
  }

  /**
   * Get state transition history for a post
   */
  async getStateHistory(postId: string): Promise<PostStateTransition[]> {
    const transitions = await prisma.postStateTransition.findMany({
      where: { postId },
      orderBy: { createdAt: "desc" },
    });

    return transitions.map((t) => ({
      from: t.fromState as PostState,
      to: t.toState as PostState,
      reason: t.reason,
      timestamp: t.createdAt,
    }));
  }

  /**
   * Get current state of a post
   */
  async getCurrentState(postId: string): Promise<PostState | null> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { currentState: true },
    });

    return (post?.currentState ?? "DRAFT") as PostState;
  }
}
