/**
 * Server actions for engagement item state (mark as done, replied from app).
 */

import {
  findEngagementItemStatesByEventIds,
  upsertEngagementItemState,
} from "./repositories/engagement-item-state.server";

export interface MarkEngagementStateInput {
  eventId: string;
  repliedFromApp?: boolean;
}

/**
 * Upsert engagement item state for the current user.
 * Used when user marks an item as done or when they reply from the app.
 */
export async function markEngagementItemState(
  userId: string,
  input: MarkEngagementStateInput
): Promise<{ success: boolean; error?: string }> {
  const { eventId, repliedFromApp = false } = input;

  if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
    return { success: false, error: "eventId is required" };
  }

  try {
    await upsertEngagementItemState(userId, eventId.trim(), repliedFromApp);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update state",
    };
  }
}

/**
 * Load engagement item states for a set of event IDs and user.
 * Returns a record eventId -> { state: 'handled', repliedFromApp?: boolean }.
 */
export async function getEngagementItemStates(
  userId: string,
  eventIds: string[]
): Promise<Record<string, { state: "handled"; repliedFromApp: boolean }>> {
  if (eventIds.length === 0) {
    return {};
  }

  const uniqueIds = [...new Set(eventIds)];
  const rows = await findEngagementItemStatesByEventIds(userId, uniqueIds);

  const result: Record<string, { state: "handled"; repliedFromApp: boolean }> =
    {};
  for (const row of rows) {
    result[row.eventId] = {
      state: "handled",
      repliedFromApp: row.repliedFromApp,
    };
  }
  return result;
}
