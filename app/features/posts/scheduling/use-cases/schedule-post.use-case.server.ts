/**
 * Schedule Post Use Case
 *
 * Schedules a post for future publication using the outbox pattern.
 */

import type { Prisma } from "~/features/posts/data/posts-prisma-types.server";
import { getPostById } from "~/features/posts/server";
import type { SchedulePostInput } from "~/features/posts/use-cases/types";
import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import type { PostScheduledPayload } from "~/infra/outbox/outbox.server";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { recordPostScheduled } from "~/lib/metrics/business-metrics.server";
import { toPrismaDate, toUnixTimestamp } from "~/lib/temporal";

import {
  runTransaction,
  schedulePostInTx,
} from "../../repositories/schedule-post-data.server";

export class SchedulePostUseCase {
  async execute(input: SchedulePostInput): Promise<void> {
    // Get or create correlation ID for this operation
    const correlationId = getCorrelationId(input.correlationId);

    // Convert Temporal to Date for database and logging
    const scheduledAtUtcDate = toPrismaDate(input.scheduledAtUtc);
    if (!scheduledAtUtcDate) {
      throw new Error("Invalid scheduledAtUtc provided");
    }

    logInfo("SchedulePostUseCase: Starting post scheduling", {
      postId: input.postId,
      userId: input.userId,
      scheduledAtUtc: scheduledAtUtcDate.toISOString(),
      correlationId,
    });

    // Verify post exists
    const post = await getPostById({ id: input.postId, userId: input.userId });
    if (!post) {
      throw new Error(
        `Post ${input.postId} not found for user ${input.userId}`
      );
    }

    // Convert Temporal to Unix timestamp for legacy field
    const scheduledForUnix = toUnixTimestamp(input.scheduledAtUtc);

    const enqueueIdempotencyKey = generateEnqueueIdempotencyKey(
      input.postId,
      scheduledForUnix
    );

    const nominalScheduledAtUtcDate = input.nominalScheduledAtUtc
      ? toPrismaDate(input.nominalScheduledAtUtc)
      : null;

    // Update post, transition state, and create outbox event atomically
    await runTransaction(async (tx) => {
      await schedulePostInTx(
        tx,
        input.postId,
        {
          scheduledAtUtc: scheduledAtUtcDate,
          nominalScheduledAtUtc: nominalScheduledAtUtcDate ?? undefined,
          enqueueIdempotencyKey,
          signedEvent: input.signedEvent,
        },
        post.currentState,
        "SCHEDULED",
        `Post scheduled for ${scheduledAtUtcDate.toISOString()}`
      );

      const payload: PostScheduledPayload = {
        postId: input.postId,
        userId: input.userId,
        signedEvent: input.signedEvent,
        scheduledFor: scheduledForUnix,
        schemaVersion: "1.0",
        correlationId,
      };

      await createOutboxEventInTransaction(
        tx as Prisma.TransactionClient,
        "POST_SCHEDULED",
        input.postId,
        "Post",
        payload,
        scheduledAtUtcDate,
        enqueueIdempotencyKey,
        correlationId
      );
    });

    // Record metrics
    recordPostScheduled(post.postType);

    logInfo("SchedulePostUseCase: Post scheduled successfully", {
      postId: input.postId,
      userId: input.userId,
      correlationId,
    });
  }
}
