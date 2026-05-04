import type {
  QueueStatus,
  QueueType,
  ScheduleType,
} from "../data/user-prisma-types.server";
import {
  deleteQueueType as deleteQueueTypeRow,
  findQueueTypeByIdAndUserId,
  findQueueTypeIdByNameAndUserId,
  findQueueTypesByUserId,
  setQueueTypeEnabledForUser as setQueueTypeEnabledForUserRow,
  setQueueTypeStatusForUser as setQueueTypeStatusForUserRow,
  updateQueueType as updateQueueTypeRow,
} from "../repositories/queue-types-data.server";

export type QueueTypeWithPresetRelation = Awaited<
  ReturnType<typeof findQueueTypesByUserId>
>[number];

/**
 * Creates default queue types for a new user.
 * We no longer create an "Unassigned" queue - unassigned is represented by null queueTypeId.
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
    status?: QueueStatus;
    hashTagPresetId?: string | null;
    includeHashtagsInNoteBody?: boolean;
  }
): Promise<QueueType> {
  return updateQueueTypeRow(userId, queueTypeData);
}

/**
 * Deletes a queue type
 */
export function deleteQueueType(
  userId: string,
  queueTypeId: string
): Promise<void> {
  return deleteQueueTypeRow(userId, queueTypeId);
}

/**
 * Gets all queue types for a user
 * Ensures default queue types exist before returning
 */
export async function getQueueTypes(
  userId: string
): Promise<QueueTypeWithPresetRelation[]> {
  await createDefaultQueueTypes(userId);
  return findQueueTypesByUserId(userId);
}

/**
 * Gets a queue type by ID for a specific user
 */
export function getQueueTypeByIdForUser(
  userId: string,
  queueTypeId: string
): Promise<QueueType | null> {
  return findQueueTypeByIdAndUserId(userId, queueTypeId);
}

export function setQueueTypeEnabledForUser(
  userId: string,
  queueTypeId: string,
  isEnabled: boolean
): Promise<QueueType> {
  return setQueueTypeEnabledForUserRow(userId, queueTypeId, isEnabled);
}

export function setQueueTypeStatusForUser(
  userId: string,
  queueTypeId: string,
  status: QueueStatus
): Promise<QueueType> {
  return setQueueTypeStatusForUserRow(userId, queueTypeId, status);
}

/**
 * Gets a queue type by name for a specific user
 */
export function getQueueTypeByNameForUser(
  userId: string,
  queueTypeName: string
): Promise<{ id: string } | null> {
  return findQueueTypeIdByNameAndUserId(userId, queueTypeName);
}
