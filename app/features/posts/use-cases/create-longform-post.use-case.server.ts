/**
 * Create Long Form Post Use Case
 *
 * Handles long form post creation with optional scheduling and outbox pattern.
 */

import type { Prisma } from "@prisma/client";

import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import type { LongFormPostScheduledPayload } from "~/infra/outbox/outbox.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { prisma } from "~/lib/prisma.server";
import { fromUnixTimestamp, toPrismaDate } from "~/lib/temporal";
import { createLongFormPost } from "~/models/longformpost.server";

import { calculateLongFormStatus } from "../server";
import { resolveQueueTypeId } from "../services/queue-type-resolver.server";
import { LongFormPostStateMachine } from "../state-machine/longform-post-state-machine.server";

import type {
  CreateLongFormPostInput,
  CreateLongFormPostResult,
} from "./longform-types";

export class CreateLongFormPostUseCase {
  private readonly stateMachine = new LongFormPostStateMachine();
  async execute(
    input: CreateLongFormPostInput
  ): Promise<CreateLongFormPostResult> {
    // Resolve queue type
    const queueTypeId = await resolveQueueTypeId(
      input.userId,
      input.queueTypeId,
      input.queueType
    );

    // If scheduled, create post with outbox event in transaction
    if (input.scheduledFor && input.signedEvent && !input.isPublished) {
      const scheduledAtUtc = toPrismaDate(
        fromUnixTimestamp(input.scheduledFor, "UTC")
      );
      const scheduledForStr = input.scheduledFor.toString();

      // Calculate status using business logic
      const { status, publishedAt, nostrEventId, finalScheduledFor } =
        calculateLongFormStatus({
          isPublished: false,
          scheduledFor: scheduledForStr,
          signedEvent: input.signedEvent,
        });

      return prisma.$transaction(async (tx) => {
        // Create long form post
        const post = await tx.longFormPost.create({
          data: {
            userId: input.userId,
            title: input.title,
            summary: input.summary,
            content: input.content,
            image: input.image,
            tags: input.tags ?? [],
            queueTypeId,
            hashTagPresetId: input.hashTagPresetId,
            signedEvent: input.signedEvent as unknown as Prisma.InputJsonValue,
            nostrEvent: input.nostrEvent as unknown as Prisma.InputJsonValue,
            nostrEventId,
            status,
            publishedAt: publishedAt ?? undefined,
            scheduledFor: finalScheduledFor,
            scheduledAtUtc,
            currentState: "SCHEDULED", // Single source of truth
          },
        });

        // Create outbox event
        const payload: LongFormPostScheduledPayload = {
          postId: post.id,
          userId: input.userId,
          signedEvent: input.signedEvent!,
          scheduledFor: input.scheduledFor!,
          schemaVersion: "1.0",
        };

        await createOutboxEventInTransaction(
          tx as Prisma.TransactionClient,
          "LONGFORM_SCHEDULED",
          post.id,
          "LongFormPost",
          payload,
          scheduledAtUtc ?? new Date(),
          generateEnqueueIdempotencyKey(post.id, input.scheduledFor!)
        );

        return {
          post,
          needsScheduling: true,
        };
      });
    }

    // Not scheduled - create normally
    const post = await createLongFormPost({
      userId: input.userId,
      title: input.title,
      summary: input.summary,
      content: input.content,
      image: input.image,
      tags: input.tags,
      queueTypeId,
      hashTagPresetId: input.hashTagPresetId,
      isPublished: input.isPublished ?? false,
      signedEvent: input.signedEvent as unknown as Prisma.JsonValue | undefined,
      nostrEvent: input.nostrEvent as unknown as Prisma.JsonValue | undefined,
      scheduledFor: input.scheduledFor
        ? input.scheduledFor.toString()
        : undefined,
    });

    // Set initial state using state machine
    const initialState = input.isPublished ? "PUBLISHED" : "DRAFT";
    await this.stateMachine.transition(
      post.id,
      input.userId,
      initialState,
      input.isPublished
        ? "Longform post created and published"
        : "Longform post created as draft"
    );

    return {
      post,
      needsScheduling: false,
    };
  }
}
