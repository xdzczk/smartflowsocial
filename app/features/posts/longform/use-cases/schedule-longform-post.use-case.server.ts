/**
 * Schedule Long Form Post Use Case
 *
 * Schedules a long form post for future publication.
 */

import { getLongFormPost } from "~/features/posts/server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { toPrismaDate, toUnixTimestamp } from "~/lib/temporal";

import { runScheduleLongFormPostInTransaction } from "../../repositories/longform-data.server";

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

    const nominalScheduledAtUtcDate = input.nominalScheduledAtUtc
      ? toPrismaDate(input.nominalScheduledAtUtc)
      : null;

    // Convert Temporal to Unix timestamp for legacy field
    const scheduledForUnix = toUnixTimestamp(input.scheduledAtUtc);

    const nostrEventId =
      typeof input.signedEvent.id === "string"
        ? input.signedEvent.id
        : undefined;
    const enqueueIdempotencyKey = generateEnqueueIdempotencyKey(
      input.postId,
      scheduledForUnix,
      nostrEventId
    );

    await runScheduleLongFormPostInTransaction(
      input.postId,
      input.userId,
      {
        scheduledAtUtc: scheduledAtUtcDate,
        nominalScheduledAtUtc: nominalScheduledAtUtcDate ?? undefined,
        enqueueIdempotencyKey,
        signedEvent: input.signedEvent,
      },
      post.currentState,
      "SCHEDULED",
      `Longform post scheduled for ${scheduledAtUtcDate.toISOString()}`,
      {
        payload: {
          postId: input.postId,
          userId: input.userId,
          signedEvent: input.signedEvent,
          scheduledFor: scheduledForUnix,
          schemaVersion: "1.0",
          correlationId: input.correlationId,
        },
        scheduledAtUtc: scheduledAtUtcDate,
        enqueueIdempotencyKey,
        correlationId: input.correlationId ?? undefined,
      }
    );
  }
}
