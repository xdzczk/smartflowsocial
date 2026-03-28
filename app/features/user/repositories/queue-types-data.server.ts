/**
 * Queue types data access. Prisma confined to feature repositories/ per architecture.
 */

import type { Prisma, QueueType, ScheduleType } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export interface UpdateQueueTypeInput {
  id?: string;
  name: string;
  scheduleType: ScheduleType;
  scheduleConfig: QueueType["scheduleConfig"];
  colorToken?: string;
  description?: string;
  isEnabled?: boolean;
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
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
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

export function findQueueTypeIdByNameAndUserId(
  userId: string,
  name: string
): Promise<{ id: string } | null> {
  return prisma.queueType.findFirst({
    where: { userId, name },
    select: { id: true },
  });
}
