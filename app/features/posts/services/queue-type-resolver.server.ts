/**
 * Queue Type Resolver
 * 
 * Business logic for resolving queue type IDs from names.
 * This handles the lookup logic that was previously in the model layer.
 */

import { prisma } from "~/lib/prisma.server";
/**
 * Resolve queue type ID from name or ID
 * 
 * If queueTypeId is provided, returns it directly.
 * If queueType (name) is provided, looks up the ID.
 * Returns null if queueType is "unassigned" or not found.
 */
export function resolveQueueTypeId(
  userId: string,
  queueTypeId?: string | null,
  queueType?: string | null,
): Promise<string | null> {
  // Use provided queue type ID directly
  if (queueTypeId) {
    return queueTypeId;
  }

  // If no queueType name provided or it's "unassigned", return null
  if (!queueType || queueType === "unassigned") {
    return null;
  }

  // Lookup queue type by name
  const queueTypeRecord = await prisma.queueType.findFirst({
    where: {
      userId,
      name: queueType,
    },
    select: {
      id: true,
    },
  });

  return queueTypeRecord?.id ?? null;
}





