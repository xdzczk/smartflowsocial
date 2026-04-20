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
import {
  persistIntendedPublishRelays,
  persistPublishRelayAcks,
} from "~/features/relays/publish-relay-acks.server";
import type { PublishPostKind } from "~/infra/notifications/publish-copy.server";
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

/**
 * Thrown when a publish call arrives for a Post that is already PUBLISHED but
 * carries a different signed Nostr event id than the one we recorded against
 * that Post. This catches the silent-success bug where creation idempotency
 * matched a historic Post (e.g. cold-restart re-publish of identical content)
 * and the caller's brand-new signed event would otherwise be dropped on the
 * floor without ever being sent to relays.
 *
 * The route layer should translate this to a 409 Conflict so the user sees a
 * clear error instead of a fake success modal.
 */
export class PublishEventMismatchError extends Error {
  readonly postId: string;
  readonly existingEventId: string | null;
  readonly attemptedEventId: string;
  constructor(input: {
    postId: string;
    existingEventId: string | null;
    attemptedEventId: string;
  }) {
    super(
      `Publish refused: post ${input.postId} is already published with event ${input.existingEventId ?? "<unknown>"} but the request carries a different signed event ${input.attemptedEventId}.`
    );
    this.name = "PublishEventMismatchError";
    this.postId = input.postId;
    this.existingEventId = input.existingEventId;
    this.attemptedEventId = input.attemptedEventId;
  }
}

export class PublishNowUseCase {
  private readonly stateMachine = new PostStateMachine();

  async execute(input: PublishNowInput): Promise<void> {
    const correlationId = getCorrelationId(input.correlationId);

    logInfo(
      "PublishNowUseCase: Starting immediate publish",
      buildObsContext({
        postId: input.postId,
        userId: input.userId,
        correlationId,
      })
    );

    const post = await getPostById({ id: input.postId, userId: input.userId });
    if (!post) {
      throw new Error(
        `Post ${input.postId} not found for user ${input.userId}`
      );
    }
    if (this.handleAlreadyPublishedGuard(post, input, correlationId)) return;

    // Cryptographically validate the signed event before publishing.
    const validatedSignedEvent = validateSignedEventCryptographically(
      input.signedEvent
    );

    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHING",
      "Publishing post immediately"
    );

    const lease = await this.acquireLeaseOrHandleMiss(input, correlationId);
    if (!lease) return;

    const publishAttemptId = generatePublishAttemptId(
      input.postId,
      validatedSignedEvent.created_at,
      0
    );

    const publishStartTime = nowMillis();
    try {
      // Pre-publish observability: surface the EXACT relay list we are about
      // to fan out to. Combined with the action-layer `publish.relays.resolved`
      // log, this lets us prove that fresh and resumed publishes target the
      // same canonical user-configured relay set.
      logInfo("publish.publisher.request", {
        postId: input.postId,
        userId: input.userId,
        correlationId,
        publishAttemptId,
        relayCount: input.relays.length,
        relays: input.relays,
      });

      // Pre-register intended relays as PENDING ACK rows so the
      // PublishResultModal always shows the canonical user-configured set,
      // not just the subset the publisher returned a result for. Any row
      // left as PENDING after fanout is a true gap (publisher returned no
      // result for that relay), not a UI inference.
      try {
        await persistIntendedPublishRelays({
          publishAttemptId,
          userId: input.userId,
          eventId: validatedSignedEvent.id,
          intendedRelays: input.relays,
        });
      } catch (intendedAckErr) {
        // Best-effort: don't fail the publish if observability writes fail.
        logErrorUtil(
          intendedAckErr instanceof Error
            ? intendedAckErr
            : new Error(String(intendedAckErr)),
          {
            ...buildObsContext({ correlationId }),
            postId: input.postId,
            userId: input.userId,
            publishAttemptId,
            event: "publish.intended_acks.persist_failed",
          }
        );
      }

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

      await this.runPostPublishSideEffects({
        input,
        post,
        publishAttemptId,
        publishedEventId: validatedSignedEvent.id,
      });
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

  /**
   * Returns true when the caller should short-circuit (idempotent success);
   * throws PublishEventMismatchError when the post is already PUBLISHED but
   * with a different signed event id (cold-restart collision guard).
   */
  private handleAlreadyPublishedGuard(
    post: { currentState: string; nostrEventId: string | null },
    input: PublishNowInput,
    correlationId: string | undefined
  ): boolean {
    if (!deriveIsPublished(post.currentState)) return false;

    // Same event id → genuine duplicate, treat as idempotent success.
    if (post.nostrEventId && post.nostrEventId === input.signedEvent.id) {
      logInfo(
        "PublishNowUseCase: Post already published, skipping duplicate publish",
        buildObsContext({
          postId: input.postId,
          userId: input.userId,
          correlationId,
        })
      );
      return true;
    }

    // Different event id → creation idempotency matched a historic Post and
    // the caller's brand-new signed event would be silently dropped. Surface
    // it so the route layer can return a real 409 instead of a fake success.
    logInfo(
      "PublishNowUseCase: Refusing publish — existing PUBLISHED post has different event id",
      buildObsContext({
        postId: input.postId,
        userId: input.userId,
        correlationId,
        existingEventId: post.nostrEventId ?? null,
        attemptedEventId: input.signedEvent.id,
      })
    );
    throw new PublishEventMismatchError({
      postId: input.postId,
      existingEventId: post.nostrEventId ?? null,
      attemptedEventId: input.signedEvent.id,
    });
  }

  /**
   * Tries to acquire the publish lease. Returns the lease on success.
   * On lease miss, inspects the latest post state and either short-circuits
   * (concurrent publish in flight or already done — idempotent), throws
   * PublishEventMismatchError (mismatched event id), or throws a "try again"
   * error. Returning `null` means the caller should short-circuit.
   */
  private async acquireLeaseOrHandleMiss(
    input: PublishNowInput,
    correlationId: string | undefined
  ): Promise<PublishLease | null> {
    const lease = await acquirePostPublishLease({
      postId: input.postId,
      userId: input.userId,
    });
    if (lease) return lease;

    logInfo("PublishNowUseCase: Publish lease not acquired", {
      postId: input.postId,
      userId: input.userId,
      correlationId,
    });

    const latestPost = await getPostById({
      id: input.postId,
      userId: input.userId,
    });
    // Narrow `latestPost` once at the top so the rest of the function can
    // address its fields without TS18047 noise. A null latestPost means the
    // record vanished between the lease attempt and this lookup, which we
    // treat the same as "not in flight, not done" → tell the caller to retry.
    if (!latestPost) {
      throw new Error(
        "Could not start publish (another publish may be in progress). Please try again in a few seconds."
      );
    }
    const latestState = latestPost.currentState;
    const isInFlightOrDone =
      deriveIsPublished(latestState) || isPublishingState(latestState);

    if (!isInFlightOrDone) {
      throw new Error(
        "Could not start publish (another publish may be in progress). Please try again in a few seconds."
      );
    }

    if (
      deriveIsPublished(latestState) &&
      latestPost.nostrEventId &&
      latestPost.nostrEventId !== input.signedEvent.id
    ) {
      logInfo(
        "PublishNowUseCase: Lease miss with mismatched event id — refusing silent skip",
        {
          postId: input.postId,
          userId: input.userId,
          correlationId,
          latestState,
          existingEventId: latestPost.nostrEventId,
          attemptedEventId: input.signedEvent.id,
        }
      );
      throw new PublishEventMismatchError({
        postId: input.postId,
        existingEventId: latestPost.nostrEventId,
        attemptedEventId: input.signedEvent.id,
      });
    }

    logInfo(
      "PublishNowUseCase: Lease miss treated as duplicate publish request",
      {
        postId: input.postId,
        userId: input.userId,
        correlationId,
        latestState,
      }
    );
    return null;
  }

  /**
   * Best-effort post-publish side effects (contest activation hook + push
   * notification). Both are isolated in their own try/catch so a failure in
   * one cannot cancel the other or fail the publish itself.
   */
  private async runPostPublishSideEffects(args: {
    input: PublishNowInput;
    post: { postKind: PublishPostKind };
    publishAttemptId: string;
    publishedEventId: string;
  }): Promise<void> {
    const { input, post, publishAttemptId, publishedEventId } = args;

    try {
      const { maybeActivateContestAfterSourcePostPublish } =
        await import("~/features/contest");
      await maybeActivateContestAfterSourcePostPublish({
        postId: input.postId,
        userId: input.userId,
        publishedEventId,
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
  }
}
