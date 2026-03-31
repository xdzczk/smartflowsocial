import { countFutureScheduledItemsForUser } from "~/features/posts/repositories/entitlement-counts.server";

/**
 * Counts posts and longform posts scheduled for a future time (Free plan cap applies to this total).
 */
export async function countFutureScheduledItems(
  userId: string
): Promise<number> {
  return countFutureScheduledItemsForUser(userId);
}
