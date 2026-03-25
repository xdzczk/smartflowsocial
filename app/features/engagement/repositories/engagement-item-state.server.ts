/**
 * Engagement item state data access. Prisma confined to feature repositories/ per architecture.
 */

import type { PrismaClient } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

const db = prisma as unknown as PrismaClient;

interface EngagementItemStateRow {
  id: string;
  eventId: string;
  state: EngagementWorkflowState;
  repliedFromApp: boolean;
  snoozedUntil: Date | null;
}

interface EngagementLinkedActionRow {
  kind: EngagementLinkedActionKind;
  postId: string | null;
  draftId: string | null;
  queueTypeId: string | null;
  label: string | null;
  scheduledFor: Date | null;
  isCanceled: boolean;
  isPublished: boolean;
  engagementItemState: { eventId: string };
}

interface EngagementItemStateStore {
  upsert(args: unknown): Promise<{ id: string }>;
  findMany(args: unknown): Promise<EngagementItemStateRow[]>;
}

interface EngagementLinkedActionStore {
  create(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<EngagementLinkedActionRow[]>;
}

const engagementItemStateStore =
  db.engagementItemState as unknown as EngagementItemStateStore;
const engagementLinkedActionStore = (db as unknown as Record<string, unknown>)[
  "engagementLinkedAction"
] as EngagementLinkedActionStore;

export type EngagementWorkflowState =
  | "UNHANDLED"
  | "DRAFTED"
  | "SCHEDULED"
  | "REPLIED"
  | "IGNORED"
  | "SNOOZED"
  | "HANDLED";

export type EngagementLinkedActionKind =
  | "DRAFT"
  | "SCHEDULED_REPLY"
  | "SCHEDULED_QUOTE"
  | "SCHEDULED_REPOST"
  | "QUEUED_REPLY"
  | "QUEUED_QUOTE"
  | "QUEUED_REPOST";

export async function upsertEngagementItemState(
  userId: string,
  eventId: string,
  repliedFromApp: boolean,
  state: EngagementWorkflowState = "REPLIED",
  snoozedUntil?: Date | null
): Promise<void> {
  await engagementItemStateStore.upsert({
    where: {
      userId_eventId: { userId, eventId },
    },
    create: {
      userId,
      eventId,
      state,
      repliedFromApp,
      snoozedUntil: snoozedUntil ?? null,
      updatedAt: new Date(),
    },
    update: {
      state,
      repliedFromApp,
      snoozedUntil: snoozedUntil ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function findEngagementItemStatesByEventIds(
  userId: string,
  eventIds: string[]
): Promise<
  Array<{
    id: string;
    eventId: string;
    state: EngagementWorkflowState;
    repliedFromApp: boolean;
    snoozedUntil: Date | null;
  }>
> {
  return engagementItemStateStore.findMany({
    where: {
      userId,
      eventId: { in: eventIds },
    },
    select: {
      id: true,
      eventId: true,
      state: true,
      repliedFromApp: true,
      snoozedUntil: true,
    },
  });
}

export async function upsertLinkedActionForEngagementItem(params: {
  userId: string;
  eventId: string;
  state?: EngagementWorkflowState;
  kind: EngagementLinkedActionKind;
  postId?: string | null;
  draftId?: string | null;
  queueTypeId?: string | null;
  label?: string | null;
  scheduledFor?: Date | null;
}): Promise<void> {
  const {
    userId,
    eventId,
    state = "SCHEDULED",
    kind,
    postId = null,
    draftId = null,
    queueTypeId = null,
    label = null,
    scheduledFor = null,
  } = params;
  const item = await engagementItemStateStore.upsert({
    where: { userId_eventId: { userId, eventId } },
    create: {
      userId,
      eventId,
      state,
      repliedFromApp: false,
      snoozedUntil: null,
    },
    update: { state, snoozedUntil: null },
    select: { id: true },
  });
  await engagementLinkedActionStore.create({
    data: {
      engagementItemStateId: item.id,
      kind,
      postId,
      draftId,
      queueTypeId,
      label,
      scheduledFor,
    },
  });
}

export async function findLinkedActionsByEventIds(
  userId: string,
  eventIds: string[]
): Promise<
  Array<{
    eventId: string;
    kind: EngagementLinkedActionKind;
    postId: string | null;
    draftId: string | null;
    queueTypeId: string | null;
    label: string | null;
    scheduledFor: Date | null;
    isCanceled: boolean;
    isPublished: boolean;
  }>
> {
  if (eventIds.length === 0) return [];
  const rows = await engagementLinkedActionStore.findMany({
    where: {
      engagementItemState: {
        userId,
        eventId: { in: eventIds },
      },
    },
    select: {
      kind: true,
      postId: true,
      draftId: true,
      queueTypeId: true,
      label: true,
      scheduledFor: true,
      isCanceled: true,
      isPublished: true,
      engagementItemState: { select: { eventId: true } },
    },
  });
  return rows.map((row) => ({
    eventId: row.engagementItemState.eventId,
    kind: row.kind,
    postId: row.postId,
    draftId: row.draftId,
    queueTypeId: row.queueTypeId,
    label: row.label,
    scheduledFor: row.scheduledFor,
    isCanceled: row.isCanceled,
    isPublished: row.isPublished,
  }));
}
