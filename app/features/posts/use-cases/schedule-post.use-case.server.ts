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

import { PostStateMachine } from "../state-machine/post-state-machine.server";

import type { SchedulePostInput } from "./types";

export class SchedulePostUseCase {
  private readonly stateMachine = new PostStateMachine();

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

    // Update post and create outbox event in transaction
    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: input.postId },
        data: {
          scheduledAtUtc: scheduledAtUtcDate,
          scheduledFor: scheduledForUnix.toString(), // Legacy field
          // @deprecated - isScheduled flag removed. State machine will set it via transition.
          signedEvent: input.signedEvent as unknown as Prisma.InputJsonValue,
        },
      });

      const enqueueIdempotencyKey = generateEnqueueIdempotencyKey(
        input.postId,
        scheduledForUnix
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

    // Transition to SCHEDULED state
    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "SCHEDULED",
      `Post scheduled for ${scheduledAtUtcDate.toISOString()}`
    );

    // Record metrics
    recordPostScheduled(post.postType);

    logInfo("SchedulePostUseCase: Post scheduled successfully", {
      postId: input.postId,
      userId: input.userId,
      correlationId,
    });
  }
}
