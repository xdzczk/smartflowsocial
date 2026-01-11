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
import { createLongFormPost } from "~/models/longformpost.server";

import { calculateLongFormStatus } from "../server";
import { resolveQueueTypeId } from "../services/queue-type-resolver.server";

import type {
  CreateLongFormPostInput,
  CreateLongFormPostResult,
} from "./longform-types";

export class CreateLongFormPostUseCase {
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
      const scheduledAtUtc = new Date(input.scheduledFor * 1000);
      const scheduledForStr = input.scheduledFor.toString();

      // Calculate status using business logic
      const {
        status,
        isScheduled,
        isDraft,
        publishedAt,
        nostrEventId,
        finalScheduledFor,
      } = calculateLongFormStatus({
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
            isPublished: false,
            isScheduled,
            draft: isDraft,
            signedEvent: input.signedEvent as unknown as Prisma.InputJsonValue,
            nostrEvent: input.nostrEvent as unknown as Prisma.InputJsonValue,
            nostrEventId,
            status,
            publishedAt,
            scheduledFor: finalScheduledFor,
            scheduledAtUtc,
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
          scheduledAtUtc,
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

    return {
      post,
      needsScheduling: false,
    };
  }
}
