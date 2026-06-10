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
      const nominalScheduledAtUtc =
        input.nominalScheduledFor != null
          ? toPrismaDate(fromUnixTimestamp(input.nominalScheduledFor, "UTC"))
          : null;
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
          ...(nominalScheduledAtUtc != null ? { nominalScheduledAtUtc } : {}),
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

    // Not scheduled - create as DRAFT regardless of input.isPublished.
    //
    // When the caller intends an immediate publish (input.isPublished === true),
    // they run the dedicated publish-longform-now flow right after this use case.
    // That flow owns the full DRAFT → PUBLISHING → PUBLISHED lifecycle, persists the
    // signedEvent/nostrEvent and publishAttemptId atomically on the PUBLISHED
    // transition, and writes per-relay ACK rows.
    //
    // We deliberately do NOT pre-mark the post as PUBLISHED here. Doing so used
    // to make that publish flow treat the very first publish as a
    // duplicate (its idempotency guard reads `currentState`), silently skip the
    // call to the Nostr publisher, and report success  -  leaving an event that
    // never actually reached any relay. We also do NOT persist signedEvent /
    // nostrEvent / scheduledAtUtc at create time for this path: the signed event
    // carries a `published_at` tag set to "now", which `calculateLongFormStatus`
    // would otherwise auto-interpret as a scheduled post and put us in
    // SCHEDULED state instead of DRAFT.
    const isImmediatePublish = input.isPublished ?? false;

    const post = await createLongFormPost({
      userId: input.userId,
      title: input.title,
      summary: input.summary,
      content: input.content,
      image: input.image,
      tags: input.tags,
      queueTypeId,
      hashTagPresetId: input.hashTagPresetId,
      isPublished: false,
      signedEvent: isImmediatePublish
        ? undefined
        : (input.signedEvent as unknown as Prisma.JsonValue | undefined),
      nostrEvent: isImmediatePublish
        ? undefined
        : (input.nostrEvent as unknown as Prisma.JsonValue | undefined),
      scheduledAtUtc: isImmediatePublish
        ? undefined
        : (input.scheduledFor ?? undefined),
    });

    // For the immediate-publish path the post is already DRAFT from the create
    // call above, so we skip the redundant state-machine transition (DRAFT →
    // DRAFT short-circuits anyway). For other callers we fall through with the
    // existing DRAFT-init behavior.
    if (!isImmediatePublish) {
      await this.stateMachine.transition(
        post.id,
        input.userId,
        "DRAFT",
        "Longform post created as draft"
      );
    }

    return {
      post,
      needsScheduling: false,
    };
  }
}
