/**
 * Schedule Long Form Post Use Case
 *
 * Schedules a long form post for future publication.
 */

import type { Prisma } from "@prisma/client";

import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import type { LongFormPostScheduledPayload } from "~/infra/outbox/outbox.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { prisma } from "~/lib/prisma.server";
import { toPrismaDate, toUnixTimestamp } from "~/lib/temporal";
import { getLongFormPost } from "~/models/longformpost.server";

import type { ScheduleLongFormPostInput } from "./longform-types";

export class ScheduleLongFormPostUseCase {
  async execute(input: ScheduleLongFormPostInput): Promise<void> {
    // Verify post exists
    const post = await getLongFormPost({
      id: input.postId,
      userId: input.userId,
    });
    if (!post) {
      throw new Error(
        `Long form post ${input.postId} not found for user ${input.userId}`
      );
    }

    // Convert Temporal to Date for database
    const scheduledAtUtcDate = toPrismaDate(input.scheduledAtUtc);
    if (!scheduledAtUtcDate) {
      throw new Error("Invalid scheduledAtUtc provided");
    }

    // Convert Temporal to Unix timestamp for legacy field
    const scheduledForUnix = toUnixTimestamp(input.scheduledAtUtc);

    const enqueueIdempotencyKey = generateEnqueueIdempotencyKey(
      input.postId,
      scheduledForUnix
    );

    // Update post, transition state, and create outbox event atomically
    await prisma.$transaction(async (tx) => {
      await tx.longFormPost.update({
        where: { id: input.postId },
        data: {
          scheduledAtUtc: scheduledAtUtcDate,
          enqueueIdempotencyKey,
          currentState: "SCHEDULED",
          // @deprecated - isScheduled flag removed. State machine will set it via transition.
          signedEvent: input.signedEvent as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.longFormPostStateTransition.create({
        data: {
          longFormPostId: input.postId,
          fromState: post.currentState,
          toState: "SCHEDULED",
          reason: `Longform post scheduled for ${scheduledAtUtcDate.toISOString()}`,
        },
      });

      const payload: LongFormPostScheduledPayload = {
        postId: input.postId,
        userId: input.userId,
        signedEvent: input.signedEvent,
        scheduledFor: scheduledForUnix,
        schemaVersion: "1.0",
        correlationId: input.correlationId,
      };

      await createOutboxEventInTransaction(
        tx as Prisma.TransactionClient,
        "LONGFORM_SCHEDULED",
        input.postId,
        "LongFormPost",
        payload,
        scheduledAtUtcDate,
        enqueueIdempotencyKey,
        input.correlationId
      );
    });
  }
}
