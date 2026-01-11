/**
 * Post State Machine Service
 *
 * Manages post state transitions with database persistence.
 */

import { Prisma } from "@prisma/client";

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
    reason: string
  ): Promise<void> {
    const post = await prisma.post.findUnique({
      where: { id: postId, userId },
      select: { currentState: true },
    });

    if (!post) {
      throw new Error(`Post ${postId} not found for user ${userId}`);
    }

    const currentState = (post.currentState || "DRAFT") as PostState;
    const transition = transitionPost(currentState, targetState, reason);

    await prisma.$transaction(async (tx) => {
      // Update post state
      await tx.post.update({
        where: { id: postId },
        data: { currentState: targetState },
      });

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

    return (post?.currentState || "DRAFT") as PostState;
  }
}
