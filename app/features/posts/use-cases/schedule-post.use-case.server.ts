/**
 * Schedule Post Use Case
 *
 * Schedules a post for future publication using the outbox pattern.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { getPostById } from "~/models/post.queries.server";
import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import type { PostScheduledPayload } from "~/infra/outbox/outbox.server";
import { PostStateMachine } from "../state-machine/post-state-machine.server";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import { recordPostScheduled } from "~/lib/metrics/business-metrics.server";

import type { SchedulePostInput } from "./types";

export class SchedulePostUseCase {
  private stateMachine = new PostStateMachine();

  async execute(input: SchedulePostInput): Promise<void> {
    // Get or create correlation ID for this operation
    const correlationId = getCorrelationId(input.correlationId);

    logInfo("SchedulePostUseCase: Starting post scheduling", {
      postId: input.postId,
      userId: input.userId,
      scheduledAtUtc: input.scheduledAtUtc.toISOString(),
      correlationId,
    });

    // Verify post exists
    const post = await getPostById({ id: input.postId, userId: input.userId });
    if (!post) {
      throw new Error(`Post ${input.postId} not found for user ${input.userId}`);
    }

    const scheduledForUnix = Math.floor(input.scheduledAtUtc.getTime() / 1000);

    // Update post and create outbox event in transaction
    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: input.postId },
        data: {
          scheduledAtUtc: input.scheduledAtUtc,
          scheduledFor: scheduledForUnix.toString(), // Legacy field
          isScheduled: true,
          signedEvent: input.signedEvent as Prisma.InputJsonValue,
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
        tx,
        "POST_SCHEDULED",
        input.postId,
        "Post",
        payload,
        input.scheduledAtUtc,
        enqueueIdempotencyKey,
        correlationId
      );
    });

    // Transition to SCHEDULED state
    await this.stateMachine.transition(
      input.postId,
      input.userId,
      "SCHEDULED",
      `Post scheduled for ${input.scheduledAtUtc.toISOString()}`
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
