/**
 * Publish Long Form Post Now Use Case
 *
 * Publishes a long form post immediately to Nostr relays.
 */

import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import { getLongFormPost } from "~/models/longformpost.server";

import { deriveIsPublishedLongForm } from "../state-machine/longform-post-state";
import { LongFormPostStateMachine } from "../state-machine/longform-post-state-machine.server";

import type { PublishLongFormNowInput } from "./longform-types";

export class PublishLongFormNowUseCase {
  private readonly stateMachine = new LongFormPostStateMachine();

  async execute(input: PublishLongFormNowInput): Promise<void> {
    // Verify post exists and not already published
    const post = await getLongFormPost({
      id: input.postId,
      userId: input.userId,
    });
    if (!post) {
      throw new Error(
        `Long form post ${input.postId} not found for user ${input.userId}`
      );
    }
    // Use currentState as single source of truth
    const isAlreadyPublished = deriveIsPublishedLongForm(post.currentState);
    if (isAlreadyPublished) {
      throw new Error(`Long form post ${input.postId} already published`);
    }

    // Transition to PUBLISHING
    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHING",
      "Publishing longform post immediately"
    );

    // Publish to Nostr (flags will be set by state machine transition)
    const publisher = getNostrPublisher();
    await publisher.publish(
      input.signedEvent,
      input.relays,
      input.correlationId
    );

    // Transition to PUBLISHED (this will automatically sync flags including isPublished)
    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHED",
      "Successfully published to Nostr"
    );
  }
}
