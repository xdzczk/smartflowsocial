/* eslint-disable import/order, @typescript-eslint/prefer-optional-chain -- Contest resolver scaffold prioritizes correctness; style cleanup follows. */
import type { RelatedEvent } from "~/features/giveaway/types";
import type { ContestRankingMetric } from "./types";
import {
  processGiveawayParticipants,
  type GiveawayParticipantFilters,
} from "~/features/giveaway/giveaway-loader.server";
import { fetchGiveawayParticipants } from "~/features/giveaway/giveaway.server";
import { getUserById } from "~/features/user";

export interface ContestResolvedEntry {
  entryEventId: string;
  authorPubkey: string;
  createdAtUnix: number;
  replySnippet?: string;
  reactionsCount: number;
  zapCount: number;
  satsZapped: number;
  repliesCount: number;
  repostsCount: number;
  score: number;
}

function scoreForMetric(
  metric: ContestRankingMetric,
  values: {
    reactionsCount: number;
    zapCount: number;
    satsZapped: number;
    repliesCount: number;
    repostsCount: number;
  }
): number {
  if (metric === "REACTIONS") return values.reactionsCount;
  if (metric === "ZAPS") return values.zapCount;
  if (metric === "SATS_ZAPPED") return values.satsZapped;
  if (metric === "REPLIES") return values.repliesCount;
  return values.repostsCount;
}

function buildMetricAggregatesForReply(
  eventId: string,
  relatedEvents: RelatedEvent[],
  /** Do not count reactions, zaps, nested replies, or reposts performed by the entry author on their own entry. */
  entryAuthorPubkey: string
): {
  reactionsCount: number;
  zapCount: number;
  satsZapped: number;
  repliesCount: number;
  repostsCount: number;
} {
  let reactionsCount = 0;
  let zapCount = 0;
  let satsZapped = 0;
  let repliesCount = 0;
  let repostsCount = 0;

  for (const ev of relatedEvents) {
    if (ev.pubkey === entryAuthorPubkey) continue;
    const tags: string[][] = Array.isArray(ev.tags) ? ev.tags : [];
    const isTaggedToReply = tags.some(
      (t) => Array.isArray(t) && t[0] === "e" && t[1] === eventId
    );
    if (!isTaggedToReply) continue;
    if (ev.kind === 1) repliesCount += 1;
    if (ev.kind === 6) repostsCount += 1;
    if (ev.kind === 7) reactionsCount += 1;
    if (ev.kind === 9735) {
      zapCount += 1;
      const amountTag = tags.find((t) => Array.isArray(t) && t[0] === "amount");
      const msats = amountTag && amountTag[1] ? Number(amountTag[1]) : 0;
      if (Number.isFinite(msats) && msats > 0) {
        satsZapped += Math.floor(msats / 1000);
      }
    }
  }

  return { reactionsCount, zapCount, satsZapped, repliesCount, repostsCount };
}

export async function resolveContestEntries(params: {
  userId: string;
  sourceNoteId: string;
  metric: ContestRankingMetric;
  deadlineUnix: number;
  filters?: GiveawayParticipantFilters;
}): Promise<ContestResolvedEntry[]> {
  const user = await getUserById(params.userId);
  if (!user) return [];

  const { relatedEvents } = await fetchGiveawayParticipants([
    params.sourceNoteId,
  ]);
  const replies = relatedEvents.filter(
    (ev) =>
      ev.kind === 1 &&
      ev.created_at <= params.deadlineUnix &&
      Array.isArray(ev.tags) &&
      ev.tags.some(
        (tag) =>
          Array.isArray(tag) && tag[0] === "e" && tag[1] === params.sourceNoteId
      )
  );

  const eligibleReplies = await processGiveawayParticipants(
    replies,
    params.userId,
    {
      ...user,
      mutedList:
        user.mutedList &&
        typeof user.mutedList === "object" &&
        !Array.isArray(user.mutedList) &&
        "npubs" in user.mutedList
          ? {
              npubs: Array.isArray(
                (user.mutedList as { npubs?: unknown }).npubs
              )
                ? ((user.mutedList as { npubs?: unknown }).npubs as string[])
                : [],
            }
          : { npubs: [] },
    },
    params.filters ? { filters: params.filters } : undefined
  );

  const rows: ContestResolvedEntry[] = eligibleReplies.map((reply) => {
    const aggregates = buildMetricAggregatesForReply(
      reply.id,
      relatedEvents,
      reply.pubkey
    );
    const score = scoreForMetric(params.metric, aggregates);
    return {
      entryEventId: reply.id,
      authorPubkey: reply.pubkey,
      createdAtUnix: reply.created_at,
      replySnippet: reply.content?.slice(0, 200),
      reactionsCount: aggregates.reactionsCount,
      zapCount: aggregates.zapCount,
      satsZapped: aggregates.satsZapped,
      repliesCount: aggregates.repliesCount,
      repostsCount: aggregates.repostsCount,
      score,
    };
  });

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.createdAtUnix !== b.createdAtUnix)
      return a.createdAtUnix - b.createdAtUnix;
    return a.entryEventId.localeCompare(b.entryEventId);
  });

  return rows;
}
/* eslint-enable import/order, @typescript-eslint/prefer-optional-chain */
