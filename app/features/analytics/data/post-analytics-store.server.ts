import { Prisma } from "@prisma/client";

import type { AuthorStream, DiscoveredEvent } from "~/features/nostrmash/parse";
import { convertToHex } from "~/lib/nostr-conversion";
import { prisma } from "~/lib/prisma.server";

import { publishedEventId, publishedNoteExcerpt } from "../published-events";
import type { AnalyticsDirectory, ObservationInput, SyncState } from "../sweep";

function observationData(row: ObservationInput) {
  return {
    userId: row.userId,
    nostrEventId: row.nostrEventId,
    postId: row.postId,
    reactionCount: row.reactionCount,
    replyCount: row.replyCount,
    repostCount: row.repostCount,
    zapCount: row.zapCount,
    zapMsats: row.zapMsats,
    missingFromIndex: row.missingFromIndex,
    checkedAt: row.checkedAt,
  };
}

export function createAnalyticsDirectory(
  isCollectionActive: (userId: string) => Promise<boolean>
): AnalyticsDirectory {
  return {
    async listCandidateUserIds() {
      const rows = await prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        select: { userId: true },
      });
      return [...new Set(rows.map((row) => row.userId))];
    },
    isCollectionActive,
    async pubkeyHex(userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { npub: true },
      });
      return convertToHex(user?.npub);
    },
    async postIdForEvent(userId, nostrEventId) {
      const post = await prisma.post.findFirst({
        where: { userId, nostrEventId },
        select: { id: true },
      });
      return post?.id ?? null;
    },
    async getSync(userId, stream) {
      const row = await prisma.authorEventSync.findUnique({
        where: { userId_stream: { userId, stream } },
      });
      if (!row) return null;
      const state: SyncState = {
        nextCursor: row.nextCursor,
        backfillComplete: row.backfillComplete,
        updatedAt: row.updatedAt.getTime(),
      };
      return state;
    },
    async saveSync(userId, stream: AuthorStream, state) {
      await prisma.authorEventSync.upsert({
        where: { userId_stream: { userId, stream } },
        create: {
          userId,
          stream,
          nextCursor: state.nextCursor,
          backfillComplete: state.backfillComplete,
        },
        update: {
          nextCursor: state.nextCursor,
          backfillComplete: state.backfillComplete,
        },
      });
    },
    async upsertTracked(row: {
      userId: string;
      event: DiscoveredEvent;
      postId: string | null;
    }) {
      await prisma.trackedAuthorEvent.upsert({
        where: {
          userId_nostrEventId: {
            userId: row.userId,
            nostrEventId: row.event.nostrEventId,
          },
        },
        create: {
          userId: row.userId,
          nostrEventId: row.event.nostrEventId,
          kind: row.event.kind,
          eventCreatedAt: row.event.eventCreatedAt,
          contentExcerpt: row.event.contentExcerpt,
          postId: row.postId,
        },
        update: {
          postId: row.postId,
          ...(row.event.contentExcerpt
            ? { contentExcerpt: row.event.contentExcerpt }
            : {}),
          ...(row.event.eventCreatedAt
            ? { eventCreatedAt: row.event.eventCreatedAt }
            : {}),
        },
      });
    },
    async oldestForSnapshot(userIds, limit) {
      if (userIds.length === 0 || limit <= 0) return [];
      return prisma.$queryRaw<
        Array<{ userId: string; nostrEventId: string; postId: string | null }>
      >(Prisma.sql`
        SELECT t."userId", t."nostrEventId", t."postId"
        FROM "TrackedAuthorEvent" t
        LEFT JOIN "PostPerformanceLatest" l
          ON l."userId" = t."userId" AND l."nostrEventId" = t."nostrEventId"
        WHERE t."userId" IN (${Prisma.join(userIds)})
        ORDER BY l."checkedAt" ASC NULLS FIRST, t."discoveredAt" ASC
        LIMIT ${limit}
      `);
    },
    async appendObservation(row) {
      const data = observationData(row);
      await prisma.$transaction(async (tx) => {
        await tx.postPerformanceObservation.create({ data });
        await tx.postPerformanceLatest.upsert({
          where: {
            userId_nostrEventId: {
              userId: row.userId,
              nostrEventId: row.nostrEventId,
            },
          },
          create: data,
          update: {
            postId: data.postId,
            reactionCount: data.reactionCount,
            replyCount: data.replyCount,
            repostCount: data.repostCount,
            zapCount: data.zapCount,
            zapMsats: data.zapMsats,
            missingFromIndex: data.missingFromIndex,
            checkedAt: data.checkedAt,
          },
        });
      });
    },
  };
}

export async function notesBackfillComplete(userId: string): Promise<boolean> {
  const row = await prisma.authorEventSync.findUnique({
    where: { userId_stream: { userId, stream: "notes" } },
    select: { backfillComplete: true },
  });
  return row?.backfillComplete ?? false;
}

export async function listTrackedAuthorEvents(userId: string) {
  return prisma.trackedAuthorEvent.findMany({
    where: { userId },
    orderBy: [
      { eventCreatedAt: { sort: "desc", nulls: "last" } },
      { discoveredAt: "desc" },
    ],
    take: 100,
  });
}

export async function listPerformanceLatest(
  userId: string,
  eventIds: string[]
) {
  if (eventIds.length === 0) return [];
  return prisma.postPerformanceLatest.findMany({
    where: { userId, nostrEventId: { in: eventIds } },
  });
}

const PUBLISHED_INDEX_LIMIT = 100;

/**
 * Catalog notes and articles already published in SmartFlow.
 * The page can list them even when the NostrMash author walk does not answer.
 */
export async function indexPublishedAuthorEvents(
  userId: string
): Promise<number> {
  const [posts, articles] = await Promise.all([
    prisma.post.findMany({
      where: { userId, currentState: "PUBLISHED", repost: false },
      orderBy: { publishedAt: "desc" },
      take: PUBLISHED_INDEX_LIMIT,
      select: {
        id: true,
        nostrEventId: true,
        nostrEvent: true,
        content: true,
        caption: true,
        fileUrl: true,
        publishedAt: true,
      },
    }),
    prisma.longFormPost.findMany({
      where: { userId, currentState: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: PUBLISHED_INDEX_LIMIT,
      select: {
        id: true,
        nostrEventId: true,
        nostrEvent: true,
        title: true,
        summary: true,
        content: true,
        publishedAt: true,
      },
    }),
  ]);

  const seen = new Set<string>();
  const data: Array<{
    userId: string;
    nostrEventId: string;
    kind: number;
    eventCreatedAt: Date | null;
    contentExcerpt: string;
    postId: string | null;
  }> = [];
  for (const post of posts) {
    const nostrEventId = publishedEventId(post.nostrEventId, post.nostrEvent);
    if (!nostrEventId || seen.has(nostrEventId)) continue;
    seen.add(nostrEventId);
    data.push({
      userId,
      nostrEventId,
      kind: 1,
      eventCreatedAt: post.publishedAt,
      contentExcerpt: publishedNoteExcerpt([
        post.content,
        post.caption,
        post.fileUrl[0],
      ]),
      postId: post.id,
    });
  }
  for (const article of articles) {
    const nostrEventId = publishedEventId(
      article.nostrEventId,
      article.nostrEvent
    );
    if (!nostrEventId || seen.has(nostrEventId)) continue;
    seen.add(nostrEventId);
    data.push({
      userId,
      nostrEventId,
      kind: 30023,
      eventCreatedAt: article.publishedAt,
      contentExcerpt: publishedNoteExcerpt([
        article.title,
        article.summary,
        article.content,
      ]),
      postId: null,
    });
  }
  if (data.length === 0) return 0;
  await prisma.trackedAuthorEvent.createMany({ data, skipDuplicates: true });
  return data.length;
}

export async function hasPerformanceLatest(userId: string): Promise<boolean> {
  const row = await prisma.postPerformanceLatest.findFirst({
    where: { userId },
    select: { nostrEventId: true },
  });
  return row !== null;
}

export async function listPerformanceObservations(
  userId: string,
  nostrEventId: string
) {
  return prisma.postPerformanceObservation.findMany({
    where: { userId, nostrEventId },
    orderBy: { checkedAt: "asc" },
    take: 500,
  });
}
