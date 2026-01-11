/**
 * Schedule Long Form Post Use Case
 *
 * Schedules a long form post for future publication.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";
import { getLongFormPost } from "~/models/longformpost.server";
import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import type { LongFormPostScheduledPayload } from "~/infra/outbox/outbox.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";

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

    const scheduledForUnix = Math.floor(input.scheduledAtUtc.getTime() / 1000);

    // Update post and create outbox event in transaction
    await prisma.$transaction(async (tx) => {
      await tx.longFormPost.update({
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

      const payload: LongFormPostScheduledPayload = {
        postId: input.postId,
        userId: input.userId,
        signedEvent: input.signedEvent,
        scheduledFor: scheduledForUnix,
        schemaVersion: "1.0",
        correlationId: input.correlationId,
      };

      await createOutboxEventInTransaction(
        tx,
        "LONGFORM_SCHEDULED",
        input.postId,
        "LongFormPost",
        payload,
        input.scheduledAtUtc,
        enqueueIdempotencyKey,
        input.correlationId
      );
    });
  }
}
