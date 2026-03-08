/**
 * Schedule Post Use Case
 *
 * Schedules a post for future publication using the outbox pattern.
 */

import type { Prisma } from "@prisma/client";

import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import type { PostScheduledPayload } from "~/infra/outbox/outbox.server";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { recordPostScheduled } from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";
import { toPrismaDate, toUnixTimestamp } from "~/lib/temporal";
import { getPostById } from "~/models/post.queries.server";

import type { SchedulePostInput } from "./types";

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
    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: input.postId },
        data: {
          scheduledAtUtc: scheduledAtUtcDate,
          ...(nominalScheduledAtUtcDate != null
            ? { nominalScheduledAtUtc: nominalScheduledAtUtcDate }
            : {}),
          enqueueIdempotencyKey,
          currentState: "SCHEDULED",
          // @deprecated - isScheduled flag removed. State machine will set it via transition.
          signedEvent: input.signedEvent as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.postStateTransition.create({
        data: {
          postId: input.postId,
          fromState: post.currentState,
          toState: "SCHEDULED",
          reason: `Post scheduled for ${scheduledAtUtcDate.toISOString()}`,
        },
      });

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
