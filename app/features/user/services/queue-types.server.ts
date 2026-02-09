import type { QueueType, ScheduleType, Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

/**
 * Creates default queue types for a new user.
 * We no longer create an "Unassigned" queue—unassigned is represented by null queueTypeId.
 */
export async function createDefaultQueueTypes(_userId: string): Promise<void> {
  // No default queue types. Users create their own queues.
  // "Unassigned" is a filter/sentinel for posts with no queue (queueTypeId null), not a DB queue.
}

/**
 * Updates or creates a queue type
 */
export function updateQueueType(
  userId: string,
  queueTypeData: {
    id?: string;
    name: string;
    scheduleType: ScheduleType;
    scheduleConfig: QueueType["scheduleConfig"];
    colorToken?: string;
    description?: string;
    isEnabled?: boolean;
    hashTagPresetId?: string | null;
  }
): Promise<QueueType> {
  const colorToken = queueTypeData.colorToken ?? "slate";
  if (queueTypeData.id) {
    // Update existing queue type
    const updateData: Prisma.QueueTypeUpdateInput = {
      name: queueTypeData.name.trim(),
      scheduleType: queueTypeData.scheduleType,
      scheduleConfig: queueTypeData.scheduleConfig as Prisma.InputJsonValue,
      colorToken,
      description: queueTypeData.description,
      isEnabled: queueTypeData.isEnabled ?? true,
    };

    // Handle hashtag preset relationship
    if (queueTypeData.hashTagPresetId === null) {
      updateData.hashTagPreset = { disconnect: true };
    } else if (queueTypeData.hashTagPresetId) {
      updateData.hashTagPreset = {
        connect: { id: queueTypeData.hashTagPresetId },
      };
    }

    return prisma.queueType.update({
      where: {
        id: queueTypeData.id,
        userId: userId,
      },
      data: updateData,
    });
  } else {
    // Create new queue type
    const createData: Prisma.QueueTypeCreateInput = {
      user: { connect: { id: userId } },
      name: queueTypeData.name.trim(),
      scheduleType: queueTypeData.scheduleType,
      scheduleConfig: queueTypeData.scheduleConfig as Prisma.InputJsonValue,
      colorToken,
      description: queueTypeData.description,
      isEnabled: queueTypeData.isEnabled ?? true,
    };

    // Handle hashtag preset relationship
    if (queueTypeData.hashTagPresetId) {
      createData.hashTagPreset = {
        connect: { id: queueTypeData.hashTagPresetId },
      };
    }

    return prisma.queueType.create({
      data: createData,
    });
  }
}

/**
 * Deletes a queue type
 */
export async function deleteQueueType(
  userId: string,
  queueTypeId: string
): Promise<void> {
  await prisma.queueType.delete({
    where: {
      id: queueTypeId,
      userId: userId,
    },
  });
}

/**
 * Gets all queue types for a user
 * Ensures default queue types exist before returning
 */
export async function getQueueTypes(userId: string): Promise<QueueType[]> {
  // Ensure user has default queue types
  await createDefaultQueueTypes(userId);

  return prisma.queueType.findMany({
    where: {
      userId: userId,
    },
    include: {
      hashTagPreset: true,
    },
    orderBy: [
      { isDefault: "desc" }, // Default types first
      { createdAt: "asc" },
    ],
  });
}

/**
 * Gets a queue type by ID for a specific user
 */
export function getQueueTypeByIdForUser(
  userId: string,
  queueTypeId: string
): Promise<QueueType | null> {
  return prisma.queueType.findFirst({
    where: {
      id: queueTypeId,
      userId: userId,
    },
  });
}

/**
 * Gets a queue type by name for a specific user
 */
export function getQueueTypeByNameForUser(
  userId: string,
  queueTypeName: string
): Promise<{ id: string } | null> {
  return prisma.queueType.findFirst({
    where: {
      userId,
      name: queueTypeName,
    },
    select: {
      id: true,
    },
  });
}
