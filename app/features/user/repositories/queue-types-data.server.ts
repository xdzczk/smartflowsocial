/**
 * Queue types data access. Prisma confined to feature repositories/ per architecture.
 */

import type {
  Prisma,
  QueueHoldStatus,
  QueueStatus,
  QueueType,
  ScheduleType,
} from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export interface UpdateQueueTypeInput {
  id?: string;
  name: string;
  scheduleType: ScheduleType;
  scheduleConfig: QueueType["scheduleConfig"];
  colorToken?: string;
  description?: string;
  isEnabled?: boolean;
  status?: QueueStatus;
  hashTagPresetId?: string | null;
  includeHashtagsInNoteBody?: boolean;
}

export function updateQueueType(
  userId: string,
  data: UpdateQueueTypeInput
): Promise<QueueType> {
  const colorToken = data.colorToken ?? "slate";
  if (data.id) {
    const updateData: Prisma.QueueTypeUpdateInput = {
      name: data.name.trim(),
      scheduleType: data.scheduleType,
      scheduleConfig: data.scheduleConfig as Prisma.InputJsonValue,
      colorToken,
      description: data.description,
      isEnabled: data.isEnabled ?? true,
      status: data.status,
      includeHashtagsInNoteBody: data.includeHashtagsInNoteBody ?? true,
    };
    if (data.hashTagPresetId === null) {
      updateData.hashTagPreset = { disconnect: true };
    } else if (data.hashTagPresetId) {
      updateData.hashTagPreset = { connect: { id: data.hashTagPresetId } };
    }
    return prisma.queueType.update({
      where: { id: data.id, userId },
      data: updateData,
    });
  }
  const createData: Prisma.QueueTypeCreateInput = {
    user: { connect: { id: userId } },
    name: data.name.trim(),
    scheduleType: data.scheduleType,
    scheduleConfig: data.scheduleConfig as Prisma.InputJsonValue,
    colorToken,
    description: data.description,
    isEnabled: data.isEnabled ?? true,
    status: data.status ?? "ACTIVE",
    includeHashtagsInNoteBody: data.includeHashtagsInNoteBody ?? true,
  };
  if (data.hashTagPresetId) {
    createData.hashTagPreset = { connect: { id: data.hashTagPresetId } };
  }
  return prisma.queueType.create({ data: createData });
}

export async function deleteQueueType(
  userId: string,
  queueTypeId: string
): Promise<void> {
  await prisma.queueType.delete({
    where: { id: queueTypeId, userId },
  });
}

export function findQueueTypesByUserId(
  userId: string
): Promise<Array<QueueType & { hashTagPreset: unknown }>> {
  return prisma.queueType.findMany({
    where: { userId },
    include: { hashTagPreset: true },
    orderBy: [{ createdAt: "asc" }],
  });
}

export function findQueueTypeByIdAndUserId(
  userId: string,
  queueTypeId: string
): Promise<QueueType | null> {
  return prisma.queueType.findFirst({
    where: { id: queueTypeId, userId },
  });
}

export function setQueueTypeEnabledForUser(
  userId: string,
  queueTypeId: string,
  isEnabled: boolean
): Promise<QueueType> {
  return prisma.queueType.update({
    where: { id: queueTypeId, userId },
    data: { isEnabled },
  });
}

export function setQueueTypeStatusForUser(
  userId: string,
  queueTypeId: string,
  status: QueueStatus
): Promise<QueueType> {
  return prisma.queueType.update({
    where: { id: queueTypeId, userId },
    data: { status },
  });
}

export function holdFuturePostsForQueue(
  userId: string,
  queueTypeId: string,
  now: Date
): Promise<Prisma.BatchPayload> {
  return prisma.post.updateMany({
    where: {
      userId,
      queueTypeId,
      currentState: "SCHEDULED",
      scheduledAtUtc: { gt: now },
      queueHoldStatus: "NONE",
    },
    data: {
      queueHoldStatus: "HELD_BY_QUEUE" satisfies QueueHoldStatus,
      queueHeldAtUtc: now,
      queueHeldByQueueTypeId: queueTypeId,
    },
  });
}

export function holdFutureLongFormPostsForQueue(
  userId: string,
  queueTypeId: string,
  now: Date
): Promise<Prisma.BatchPayload> {
  return prisma.longFormPost.updateMany({
    where: {
      userId,
      queueTypeId,
      currentState: "SCHEDULED",
      scheduledAtUtc: { gt: now },
      queueHoldStatus: "NONE",
    },
    data: {
      queueHoldStatus: "HELD_BY_QUEUE" satisfies QueueHoldStatus,
      queueHeldAtUtc: now,
      queueHeldByQueueTypeId: queueTypeId,
    },
  });
}

export function findQueueTypeIdByNameAndUserId(
  userId: string,
  name: string
): Promise<{ id: string } | null> {
  return prisma.queueType.findFirst({
    where: { userId, name },
    select: { id: true },
  });
}

export function countQueueTypesForUser(userId: string): Promise<number> {
  return prisma.queueType.count({ where: { userId } });
}
