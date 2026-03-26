/**
 * Publish Long Form Post Now Use Case
 *
 * Publishes a long form post immediately to Nostr relays.
 */

import { getLongFormPost } from "~/features/posts/server";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import {
  acquireLongFormPostPublishLease,
  releaseLongFormPostPublishLease,
  type PublishLease,
} from "~/infra/publishing/publish-lease.server";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logError, logInfo } from "~/lib/error-logger.server";
import { generatePublishAttemptId } from "~/lib/idempotency.server";
import { buildObsContext } from "~/lib/observability-context.server";
import { nowMillis } from "~/lib/temporal";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

import { deriveIsPublishedLongForm } from "../state-machine/longform-post-state";
import { LongFormPostStateMachine } from "../state-machine/longform-post-state-machine.server";

import type { PublishLongFormNowInput } from "./longform-types";

export class PublishLongFormNowUseCase {
  private readonly stateMachine = new LongFormPostStateMachine();

  async execute(input: PublishLongFormNowInput): Promise<void> {
    const correlationId = getCorrelationId(input.correlationId);

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
      // Idempotent behavior: if already published, log and return gracefully
      // This handles duplicate requests (e.g., double-clicks, form resubmissions)
      logInfo(
        "PublishLongFormNowUseCase: Post already published, skipping duplicate publish",
        buildObsContext({
          postId: input.postId,
          userId: input.userId,
          correlationId,
        })
      );
      return;
    }

    const validatedSignedEvent = validateSignedEventCryptographically(
      input.signedEvent
    );

    // Transition to PUBLISHING
    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHING",
      "Publishing longform post immediately"
    );

    // Acquire a DB-backed publish lease. This prevents concurrent publishes and makes retries safe.
    let lease: PublishLease | null = null;
    lease = await acquireLongFormPostPublishLease({
      postId: input.postId,
      userId: input.userId,
    });
    if (!lease) {
      logInfo(
        "PublishLongFormNowUseCase: Publish lease not acquired; failing publish",
        {
          postId: input.postId,
          userId: input.userId,
          correlationId,
        }
      );
      try {
        await this.stateMachine.transition(
          input.postId,
          input.userId,
          "FAILED",
          "Publish lease not acquired (concurrent publish or lock held)",
          {
            additionalPostData: {
              publishingLockId: null,
              publishingLockExpiresAt: null,
            },
          }
        );
      } catch (transitionError) {
        logError(
          transitionError instanceof Error
            ? transitionError
            : new Error(String(transitionError)),
          {
            postId: input.postId,
            userId: input.userId,
            correlationId,
            message:
              "PublishLongFormNowUseCase: Failed to transition to FAILED after lease miss",
          }
        );
      }
      throw new Error(
        "Could not start publish (another publish may be in progress). Please try again in a few seconds."
      );
    }

    const publishAttemptId = generatePublishAttemptId(
      input.postId,
      validatedSignedEvent.created_at,
      0
    );

    // Publish to Nostr (flags will be set by state machine transition)
    const publisher = getNostrPublisher();
    const publishStartTime = nowMillis();
    try {
      const publishResult = await publisher.publish(
        validatedSignedEvent,
        input.relays,
        correlationId
      );

      // Persist per-relay outcomes for observability (best-effort).
      try {
        await persistPublishRelayAcks({
          publishAttemptId,
          userId: input.userId,
          eventId: validatedSignedEvent.id,
          results: publishResult.results,
        });
      } catch (ackError) {
        logError(
          ackError instanceof Error ? ackError : new Error(String(ackError)),
          {
            postId: input.postId,
            userId: input.userId,
            correlationId,
            publishAttemptId,
            message:
              "PublishLongFormNowUseCase: Failed to persist publish ACKs",
          }
        );
      }

      const relayResults = publishResult.results;
      if (relayResults.length > 0 && relayResults.every((r) => !r.ok)) {
        throw new Error(
          "Publish failed on all relays: no relay accepted the event. Check Network settings and try again."
        );
      }

      // Transition to PUBLISHED and atomically persist publish metadata.
      await this.stateMachine.transition(
        input.postId,
        input.userId,
        "PUBLISHED",
        "Successfully published to Nostr",
        {
          additionalPostData: {
            nostrEventId: validatedSignedEvent.id,
            publishAttemptId,
            publishedAt: new Date(),
            postedAt: new Date(),
            publishingLockId: null,
            publishingLockExpiresAt: null,
          },
        }
      );

      // Send push notification for publish success
      try {
        const { sendPublishSuccessNotification } =
          await import("~/infra/notifications/push-notification.server");
        await sendPublishSuccessNotification(
          input.userId,
          input.postId,
          publishAttemptId,
          {
            isLongForm: true,
            source: "immediate",
            queueName: post.queueType?.name ?? null,
          }
        );
      } catch (notificationError) {
        logError(
          notificationError instanceof Error
            ? notificationError
            : new Error(String(notificationError)),
          {
            message: "Failed to send publish success notification",
            postId: input.postId,
            userId: input.userId,
            publishAttemptId,
          }
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      try {
        await this.stateMachine.transition(
          input.postId,
          input.userId,
          "FAILED",
          `Publish failed: ${err.message}`,
          {
            additionalPostData: {
              publishingLockId: null,
              publishingLockExpiresAt: null,
            },
          }
        );
      } catch (transitionError) {
        // Best-effort release: avoid wedging this post until lease expiry.
        await releaseLongFormPostPublishLease({
          postId: input.postId,
          userId: input.userId,
          lockId: lease.lockId,
        });
        throw transitionError;
      }

      logError(err, {
        postId: input.postId,
        userId: input.userId,
        correlationId,
        message: "PublishLongFormNowUseCase: Failed to publish longform post",
        publishLatencyMs: nowMillis() - publishStartTime,
      });
      throw err;
    }
  }
}
