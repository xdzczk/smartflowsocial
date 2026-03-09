/**
 * LongFormPost State Machine Service
 *
 * Manages longform post state transitions with database persistence.
 */

import type { Prisma } from "~/features/posts/data/posts-prisma-types.server";
import { recordLongFormPostStateTransition } from "~/lib/metrics/business-metrics.server";

import {
  createLongFormPostStateTransitionInTx,
  findLongFormPostById,
  findLongFormPostStateTransitions,
  findLongFormPostUnique,
  runTransaction,
  updateLongFormPost,
  updateLongFormPostInTx,
} from "../../repositories/longform-data.server";

import {
  transitionLongFormPost,
  type LongFormPostState,
  type LongFormPostStateTransition,
} from "./longform-post-state";

export class LongFormPostStateMachine {
  async transition(
    postId: string,
    userId: string,
    targetState: LongFormPostState,
    reason: string,
    options?: {
      additionalPostData?: Prisma.LongFormPostUpdateInput;
    }
  ): Promise<void> {
    const post = await findLongFormPostById(postId, userId);
    if (!post) {
      throw new Error(`LongFormPost ${postId} not found for user ${userId}`);
    }

    const currentState = (post.currentState || "DRAFT") as LongFormPostState;

    if (currentState === targetState) {
      if (options?.additionalPostData) {
        await updateLongFormPost(postId, userId, options.additionalPostData);
      }
      return;
    }

    const transition = transitionLongFormPost(
      currentState,
      targetState,
      reason
    );

    await runTransaction(async (tx) => {
      await updateLongFormPostInTx(tx, postId, userId, {
        currentState: targetState,
        ...(options?.additionalPostData ?? {}),
      });
      await createLongFormPostStateTransitionInTx(
        tx,
        postId,
        transition.from,
        transition.to,
        transition.reason
      );
    });

    recordLongFormPostStateTransition(transition.from, transition.to);
  }

  async getStateHistory(
    postId: string
  ): Promise<LongFormPostStateTransition[]> {
    const transitions = await findLongFormPostStateTransitions(postId);
    return transitions.map((t) => ({
      from: t.fromState as LongFormPostState,
      to: t.toState as LongFormPostState,
      reason: t.reason,
      timestamp: t.createdAt,
    }));
  }

  async getCurrentState(postId: string): Promise<LongFormPostState | null> {
    const post = await findLongFormPostUnique(
      { id: postId },
      { select: { currentState: true } }
    );
    return (post?.currentState ?? "DRAFT") as LongFormPostState;
  }
}
