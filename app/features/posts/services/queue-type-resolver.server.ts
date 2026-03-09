/**
 * Queue Type Resolver
 *
 * Business logic for resolving queue type IDs from names.
 * This handles the lookup logic that was previously in the model layer.
 */

import { findQueueTypeByUserAndName } from "../repositories/queue-type-resolver-data.server";

/**
 * Resolve queue type ID from name or ID
 *
 * If queueTypeId is provided, returns it directly.
 * If queueType (name) is provided, looks up the ID.
 * Returns null if queueType is "unassigned" or not found.
 */
export async function resolveQueueTypeId(
  userId: string,
  queueTypeId?: string | null,
  queueType?: string | null
): Promise<string | null> {
  if (queueTypeId && queueTypeId.trim() !== "") {
    return Promise.resolve(queueTypeId);
  }

  const normalized = queueType?.toLowerCase();
  if (!queueType || normalized === "unassigned") {
    return Promise.resolve(null);
  }

  const queueTypeRecord = await findQueueTypeByUserAndName(userId, queueType);
  return queueTypeRecord?.id ?? null;
}
