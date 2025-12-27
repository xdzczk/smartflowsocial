import type { QueueType, ScheduleType, Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

/**
 * Creates default queue types for a new user
 */
export function createDefaultQueueTypes(userId: string): Promise<void> {
  const defaultQueueTypes = [
    {
      name: "Unassigned",
      scheduleType: "INTERVAL" as ScheduleType,
      scheduleConfig: { useGlobalInterval: true }, // Use global schedule intervals
      color: "#6B7280", // Gray
      description: "Default queue for unassigned posts",
      isDefault: true,
    },
  ];

  // Check if user already has queue types
  const existingCount = await prisma.queueType.count({
    where: { userId },
  });

  // Only create defaults if user has no queue types
  if (existingCount === 0) {
    await prisma.queueType.createMany({
      data: defaultQueueTypes.map((qt) => ({
        ...qt,
        userId,
      })),
    });
  }
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
    scheduleConfig: QueueType['scheduleConfig'];
    color?: string;
    description?: string;
    isEnabled?: boolean;
    hashTagPresetId?: string | null;
  },
): Promise<QueueType> {
  if (queueTypeData.id) {
    // Update existing queue type
    const updateData: Prisma.QueueTypeUpdateInput = {
      name: queueTypeData.name.trim(),
      scheduleType: queueTypeData.scheduleType,
      scheduleConfig: queueTypeData.scheduleConfig as Prisma.InputJsonValue,
      color: queueTypeData.color,
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
      color: queueTypeData.color,
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
  queueTypeId: string,
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
 * @deprecated Use getQueueTypes instead
 * Legacy function for backward compatibility - returns just queue type names
 */
export async function getQueueType(userId: string): Promise<string[]> {
  const queueTypes = await getQueueTypes(userId);
  return queueTypes.map((qt) => qt.name);
}

/**
 * Gets a queue type by ID for a specific user
 */
export function getQueueTypeByIdForUser(
  userId: string,
  queueTypeId: string,
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
  queueTypeName: string,
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

