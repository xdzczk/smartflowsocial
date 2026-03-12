/**
 * Move Scheduled to Draft Use Case
 *
 * Moves a scheduled post back to draft: cancels the queue job, clears scheduledAtUtc, and transitions to DRAFT.
 */

import { updatePost, getPostById } from "~/features/posts/server";
import { deriveIsScheduled } from "~/features/posts/state-machine/post-state";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import { cancelPostJob } from "~/infra/queue";

export interface MoveScheduledToDraftInput {
  postId: string;
  userId: string;
}

export class MoveScheduledToDraftUseCase {
  private readonly stateMachine = new PostStateMachine();

  async execute(input: MoveScheduledToDraftInput): Promise<{ moved: boolean }> {
    const post = await getPostById({
      id: input.postId,
      userId: input.userId,
    });
    if (!post) {
      throw new Error(
        `Post ${input.postId} not found for user ${input.userId}`
      );
    }

    const isScheduled = deriveIsScheduled(post.currentState);
    if (!isScheduled) {
      return { moved: false };
    }

    await cancelPostJob(input.postId);

    await updatePost({
      id: input.postId,
      userId: input.userId,
      data: { scheduledAtUtc: null },
    });

    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "DRAFT",
      "Moved back to drafts by user"
    );

    return { moved: true };
  }
}
