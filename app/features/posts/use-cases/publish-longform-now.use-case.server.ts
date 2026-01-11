/**
 * Publish Long Form Post Now Use Case
 *
 * Publishes a long form post immediately to Nostr relays.
 */

import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import {
  updateLongFormPostStatus,
  getLongFormPost,
} from "~/models/longformpost.server";

import type { PublishLongFormNowInput } from "./longform-types";

export class PublishLongFormNowUseCase {
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
    if (post.isPublished) {
      throw new Error(`Long form post ${input.postId} already published`);
    }

    // Update status and publish in parallel
    const publisher = getNostrPublisher();
    await Promise.all([
      updateLongFormPostStatus({
        id: input.postId,
        userId: input.userId,
        isPublished: true,
      }),
      publisher.publish(input.signedEvent, input.relays, input.correlationId),
    ]);
  }
}
