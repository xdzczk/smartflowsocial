/**
 * Post State Machine Service
 *
 * Manages post state transitions with database persistence.
 */

import type { Prisma } from "~/features/posts/data/posts-prisma-types.server";
import { recordPostStateTransition } from "~/lib/metrics/business-metrics.server";

import {
  findPostUnique,
  updatePost,
} from "../repositories/post-queries-data.server";
import {
  createPostStateTransitionInTx,
  findPostCurrentState,
  findPostStateTransitions,
  runTransaction,
  updatePostInTx,
} from "../repositories/post-state-machine-data.server";

import {
  transitionPost,
  type PostState,
  type PostStateTransition,
} from "./post-state";

export class PostStateMachine {
  async transition(
    postId: string,
    userId: string,
    targetState: PostState,
    reason: string,
    options?: {
      additionalPostData?: Prisma.PostUpdateInput;
    }
  ): Promise<void> {
    const currentState = (await findPostCurrentState(
      postId,
      userId
    )) as PostState | null;
    if (currentState === null) {
      throw new Error(`Post ${postId} not found for user ${userId}`);
    }

    const state = currentState;

    if (state === targetState) {
      if (options?.additionalPostData) {
        await updatePost(postId, userId, options.additionalPostData);
      }
      return;
    }

    const transition = transitionPost(state, targetState, reason);

    await runTransaction(async (tx) => {
      try {
        await updatePostInTx(tx, postId, userId, {
          currentState: targetState,
          ...(options?.additionalPostData ?? {}),
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "P2025"
        ) {
          throw new Error(
            `Post ${postId} not found for user ${userId} (may have been deleted)`
          );
        }
        throw error;
      }
      await createPostStateTransitionInTx(
        tx,
        postId,
        transition.from,
        transition.to,
        transition.reason
      );
    });

    recordPostStateTransition(transition.from, transition.to);
  }

  async getStateHistory(postId: string): Promise<PostStateTransition[]> {
    const transitions = await findPostStateTransitions(postId);
    return transitions.map((t) => ({
      from: t.fromState as PostState,
      to: t.toState as PostState,
      reason: t.reason,
      timestamp: t.createdAt,
    }));
  }

  async getCurrentState(postId: string): Promise<PostState | null> {
    const post = await findPostUnique(
      { id: postId },
      { select: { currentState: true } }
    );
    return (post?.currentState ?? "DRAFT") as PostState;
  }
}
