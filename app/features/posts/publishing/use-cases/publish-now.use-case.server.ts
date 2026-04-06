/**
 * Publish Now Use Case
 *
 * Publishes a post immediately to Nostr relays.
 */

import { getPostById } from "~/features/posts/server";
import {
  deriveIsPublished,
  isPublishingState,
} from "~/features/posts/state-machine/post-state";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import type { PublishNowInput } from "~/features/posts/use-cases/types";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import {
  acquirePostPublishLease,
  releasePostPublishLease,
  type PublishLease,
} from "~/infra/publishing/publish-lease.server";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo, logError as logErrorUtil } from "~/lib/error-logger.server";
import { generatePublishAttemptId } from "~/lib/idempotency.server";
import {
  recordPostPublished,
  recordPostPublishFailed,
} from "~/lib/metrics/business-metrics.server";
import { recordPublishLatency } from "~/lib/metrics/performance-metrics.server";
import { buildObsContext } from "~/lib/observability-context.server";
import { nowMillis } from "~/lib/temporal";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

export class PublishNowUseCase {
  private readonly stateMachine = new PostStateMachine();

  async execute(input: PublishNowInput): Promise<void> {
    // Get or create correlation ID for this operation
    const correlationId = getCorrelationId(input.correlationId);

    logInfo(
      "PublishNowUseCase: Starting immediate publish",
      buildObsContext({
        postId: input.postId,
        userId: input.userId,
        correlationId,
      })
    );

    // Verify post exists and not already posted
    const post = await getPostById({ id: input.postId, userId: input.userId });
    if (!post) {
      throw new Error(
        `Post ${input.postId} not found for user ${input.userId}`
      );
    }
    // Use currentState as single source of truth
    const isAlreadyPosted = deriveIsPublished(post.currentState);
    if (isAlreadyPosted) {
      // Idempotent behavior: if already published, log and return gracefully
      // This handles duplicate requests (e.g., double-clicks, form resubmissions)
      logInfo(
        "PublishNowUseCase: Post already published, skipping duplicate publish",
        buildObsContext({
          postId: input.postId,
          userId: input.userId,
          correlationId,
        })
      );
      return;
    }

    // Cryptographically validate the signed event before publishing
    // This ensures the event signature and ID are valid
    const validatedSignedEvent = validateSignedEventCryptographically(
      input.signedEvent
    );

    // Transition to PUBLISHING
    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHING",
      "Publishing post immediately"
    );

    // Acquire a DB-backed publish lease. This prevents concurrent publishes and makes retries safe.
    // Note: we acquire after transitioning to PUBLISHING because the lease guard is state-based.
    let lease: PublishLease | null = null;
    lease = await acquirePostPublishLease({
      postId: input.postId,
      userId: input.userId,
    });
    if (!lease) {
      logInfo("PublishNowUseCase: Publish lease not acquired", {
        postId: input.postId,
        userId: input.userId,
        correlationId,
      });

      // Duplicate submissions can race: one request holds lease and publishes,
      // while another request cannot acquire lease. Treat in-flight/already-done
      // states as idempotent success instead of failing the post.
      const latestPost = await getPostById({
        id: input.postId,
        userId: input.userId,
      });
      const latestState = latestPost?.currentState;
      if (
        latestState &&
        (deriveIsPublished(latestState) || isPublishingState(latestState))
      ) {
        logInfo(
          "PublishNowUseCase: Lease miss treated as duplicate publish request",
          {
            postId: input.postId,
            userId: input.userId,
            correlationId,
            latestState,
          }
        );
        return;
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

    const publishStartTime = nowMillis();
    try {
      // Publish to Nostr (flags will be set by state machine transition)
      const publisher = getNostrPublisher();
      const publishResult = await publisher.publish(
        validatedSignedEvent,
        input.relays,
        correlationId
      );

      const publishLatency = nowMillis() - publishStartTime;

      // Persist per-relay outcomes for observability (best-effort).
      try {
        await persistPublishRelayAcks({
          publishAttemptId,
          userId: input.userId,
          eventId: validatedSignedEvent.id,
          results: publishResult.results,
        });
      } catch (ackError) {
        logErrorUtil(
          ackError instanceof Error ? ackError : new Error(String(ackError)),
          {
            ...buildObsContext({
              postId: input.postId,
              userId: input.userId,
              correlationId,
              publishAttemptId,
            }),
            message: "PublishNowUseCase: Failed to persist publish ACKs",
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
            publishingLockId: null,
            publishingLockExpiresAt: null,
          },
        }
      );

      // Record metrics
      recordPostPublished(post.postType, "immediate");
      recordPublishLatency(post.postType, "immediate", publishLatency);

      logInfo("PublishNowUseCase: Post published successfully", {
        ...buildObsContext({
          postId: input.postId,
          userId: input.userId,
          correlationId,
          publishAttemptId,
        }),
      });

      try {
        const { maybeActivateContestAfterSourcePostPublish } =
          await import("~/features/contest");
        await maybeActivateContestAfterSourcePostPublish({
          postId: input.postId,
          userId: input.userId,
          publishedEventId: validatedSignedEvent.id,
        });
      } catch (orchErr) {
        logErrorUtil(
          orchErr instanceof Error ? orchErr : new Error(String(orchErr)),
          {
            message: "Contest launch hook after immediate publish failed",
            postId: input.postId,
            userId: input.userId,
          }
        );
      }

      // Send push notification for publish success
      try {
        const { sendPublishSuccessNotification } =
          await import("~/infra/notifications/push-notification.server");
        await sendPublishSuccessNotification(
          input.userId,
          input.postId,
          publishAttemptId,
          {
            isLongForm: false,
            source: "immediate",
            postKind: post.postKind,
            queueName: null,
          }
        );
      } catch (notificationError) {
        logErrorUtil(
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
      const publishLatency = nowMillis() - publishStartTime;
      const errorType =
        error instanceof Error ? error.constructor.name : "UnknownError";

      // Transition to FAILED
      try {
        await this.stateMachine.transition(
          input.postId,
          input.userId,
          "FAILED",
          `Publish failed: ${error instanceof Error ? error.message : String(error)}`,
          {
            additionalPostData: {
              publishingLockId: null,
              publishingLockExpiresAt: null,
            },
          }
        );
      } catch (transitionError) {
        // Best-effort release: avoid wedging this post until lease expiry.
        await releasePostPublishLease({
          postId: input.postId,
          userId: input.userId,
          lockId: lease.lockId,
        });
        throw transitionError;
      }

      // Record metrics
      recordPostPublishFailed(post.postType, "immediate", errorType);
      recordPublishLatency(post.postType, "immediate", publishLatency);

      logErrorUtil(error instanceof Error ? error : new Error(String(error)), {
        ...buildObsContext({
          postId: input.postId,
          userId: input.userId,
          correlationId,
          publishAttemptId,
        }),
        message: "PublishNowUseCase: Failed to publish post",
      });
      throw error;
    }
  }
}
