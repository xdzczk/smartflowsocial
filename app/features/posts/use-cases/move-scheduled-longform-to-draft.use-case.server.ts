/**
 * Move Scheduled Longform to Draft Use Case
 *
 * Moves a scheduled longform post back to draft: cancels the queue job, clears scheduledAtUtc, and transitions to DRAFT.
 */

import { cancelLongFormPostJob } from "~/infra/queue";
import {
  getLongFormPost,
  updateLongFormPost,
} from "~/models/longformpost.server";

import { deriveIsScheduledLongForm } from "../state-machine/longform-post-state";
import { LongFormPostStateMachine } from "../state-machine/longform-post-state-machine.server";

export interface MoveScheduledLongFormToDraftInput {
  postId: string;
  userId: string;
}

export class MoveScheduledLongFormToDraftUseCase {
  private readonly stateMachine = new LongFormPostStateMachine();

  async execute(
    input: MoveScheduledLongFormToDraftInput
  ): Promise<{ moved: boolean }> {
    const post = await getLongFormPost({
      id: input.postId,
      userId: input.userId,
    });
    if (!post) {
      throw new Error(
        `Longform post ${input.postId} not found for user ${input.userId}`
      );
    }

    const isScheduled = deriveIsScheduledLongForm(post.currentState);
    if (!isScheduled) {
      return { moved: false };
    }

    await cancelLongFormPostJob(input.postId);

    await updateLongFormPost({
      id: input.postId,
      userId: input.userId,
      scheduledFor: null,
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
