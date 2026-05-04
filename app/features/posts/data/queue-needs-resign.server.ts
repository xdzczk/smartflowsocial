/**
 * Scheduled posts/longform on a queue that still need Nostr signatures after resume.
 */

import { prisma } from "~/lib/prisma.server";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";

import {
  toPostDTO,
  toLongFormPostDTO,
  type PostDTO,
  type LongFormPostDTO,
} from "../dtos";
import { convertPrismaQueueTypeToQueueType } from "../types";
import type { LongFormPostData, PostData } from "../types";

import { pickRescheduleSourceSignedEvents } from "./reschedule-source-events.server";

function queueSortDate(row: PostData | LongFormPostData): number {
  const held =
    "queueHeldOriginalScheduledAtUtc" in row
      ? row.queueHeldOriginalScheduledAtUtc
      : null;
  const nominal =
    "nominalScheduledAtUtc" in row ? row.nominalScheduledAtUtc : null;
  return (
    held?.getTime() ??
    nominal?.getTime() ??
    row.scheduledAtUtc?.getTime() ??
    row.createdAt.getTime()
  );
}

export type NeedsResignLoaderItem =
  | { kind: "post"; post: PostDTO }
  | { kind: "longform"; longform: LongFormPostDTO };

/**
 * Maps rows to DTOs ordered like queue resume (posts + longform interleaved).
 */
export async function loadNeedsResignItemsForQueue(
  userId: string,
  queueTypeId: string
): Promise<
  { items: NeedsResignLoaderItem[] } | { error: string; status: number }
> {
  const queueOk = await prisma.queueType.findFirst({
    where: { id: queueTypeId, userId },
    select: { id: true },
  });
  if (!queueOk) {
    return { error: "Queue not found", status: 404 };
  }

  const [posts, longFormPosts] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId,
        queueTypeId,
        currentState: "SCHEDULED",
        queueHoldStatus: "NEEDS_RESIGN_AFTER_QUEUE_RESUME",
      },
      include: {
        queueType: true,
        hashTagPreset: true,
        template: true,
        repostOf: {
          select: { fileUrl: true, postType: true, signedEvent: true },
        },
        quoteOf: { select: { signedEvent: true } },
        quoteOfLongForm: { select: { signedEvent: true } },
      },
      orderBy: [{ scheduledAtUtc: "asc" }, { id: "asc" }],
    }),
    prisma.longFormPost.findMany({
      where: {
        userId,
        queueTypeId,
        currentState: "SCHEDULED",
        queueHoldStatus: "NEEDS_RESIGN_AFTER_QUEUE_RESUME",
      },
      include: {
        queueType: true,
        hashTagPreset: true,
      },
      orderBy: [{ scheduledAtUtc: "asc" }, { id: "asc" }],
    }),
  ]);

  const postsData: PostData[] = posts.map((post) => {
    const { queueType, repostOf, quoteOf, quoteOfLongForm, ...rest } =
      post as typeof post & {
        repostOf?: {
          fileUrl: string[];
          postType: string | null;
          signedEvent?: unknown;
        } | null;
        quoteOf?: { signedEvent?: unknown } | null;
        quoteOfLongForm?: { signedEvent?: unknown } | null;
      };
    const isRepostWithNoMedia =
      post.postKind === "REPOST" &&
      Boolean(repostOf) &&
      post.fileUrl.length === 0;
    const fileUrl = isRepostWithNoMedia ? repostOf!.fileUrl : post.fileUrl;
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const sources = pickRescheduleSourceSignedEvents({
      repostOf,
      quoteOf,
      quoteOfLongForm,
    });
    return {
      ...rest,
      fileUrl,
      postType: isRepostWithNoMedia ? repostOf!.postType : rest.postType,
      queueType: convertPrismaQueueTypeToQueueType(queueType),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
      ...sources,
    };
  });

  const longformData: LongFormPostData[] = longFormPosts.map((post) => {
    const { queueType, ...rest } = post;
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    return {
      ...rest,
      queueType: convertPrismaQueueTypeToQueueType(queueType),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
  });

  const ordered: NeedsResignLoaderItem[] = [
    ...postsData.map((p) => ({
      kind: "post" as const,
      row: p,
      dto: toPostDTO(p),
    })),
    ...longformData.map((p) => ({
      kind: "longform" as const,
      row: p,
      dto: toLongFormPostDTO(p),
    })),
  ]
    .sort((a, b) => {
      const diff = queueSortDate(a.row) - queueSortDate(b.row);
      if (diff !== 0) return diff;
      if (a.row.createdAt.getTime() !== b.row.createdAt.getTime()) {
        return a.row.createdAt.getTime() - b.row.createdAt.getTime();
      }
      return a.row.id.localeCompare(b.row.id);
    })
    .map((x) =>
      x.kind === "post"
        ? { kind: "post" as const, post: x.dto }
        : { kind: "longform" as const, longform: x.dto }
    );

  return { items: ordered };
}
