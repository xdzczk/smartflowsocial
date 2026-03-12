/**
 * Create Long Form Post Use Case
 *
 * Handles long form post creation with optional scheduling and outbox pattern.
 */

import type { Prisma } from "~/features/posts/data/posts-prisma-types.server";
import {
  resolveQueueTypeId,
  createLongFormPost,
} from "~/features/posts/server";
import { fromUnixTimestamp, toPrismaDate } from "~/lib/temporal";

import { runCreateScheduledLongFormPostInTransaction } from "../../repositories/longform-data.server";
import { calculateLongFormStatus } from "../services/longform-status-calculator.server";
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
      const { status, publishedAt, nostrEventId } = calculateLongFormStatus({
        isPublished: false,
        scheduledFor: scheduledForStr,
        signedEvent: input.signedEvent,
      });

      const post = await runCreateScheduledLongFormPostInTransaction(
        {
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
          scheduledAtUtc,
          currentState: "SCHEDULED",
        },
        {
          payload: {
            userId: input.userId,
            signedEvent: input.signedEvent,
            scheduledFor: input.scheduledFor,
            schemaVersion: "1.0",
          },
          scheduledAtUtc: scheduledAtUtc ?? new Date(),
          scheduledForUnix: input.scheduledFor,
        }
      );
      return {
        post,
        needsScheduling: true,
      };
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
      scheduledAtUtc: input.scheduledFor ?? undefined,
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
