/**
 * Server helpers for humanized giveaway display: scope summary, queue name resolution.
 */

import {
  findQueueTypeNameByIdAndUser,
  findQueueTypesByIdsAndUser,
} from "./repositories/giveaway-display-data.server";

export type GiveawayScopeType =
  | "PERIOD"
  | "SINGLE_POST"
  | "QUEUE"
  | "FOLLOWERS"
  | "FOLLOWING";

/**
 * Resolve queue id from scopeReference to queue name for display.
 * Returns null if queue was deleted.
 */
export async function resolveGiveawayQueueName(
  userId: string,
  scopeReference: Record<string, unknown>
): Promise<string | null> {
  const queueId = scopeReference["queueId"];
  if (typeof queueId !== "string") return null;
  return findQueueTypeNameByIdAndUser(userId, queueId);
}

/**
 * Batch-resolve queue ids to names for the given user. Returns a map of queueId -> name (or null if deleted).
 */
export async function getQueueNamesByIds(
  userId: string,
  queueIds: string[]
): Promise<Record<string, string | null>> {
  if (queueIds.length === 0) return {};
  const queues = await findQueueTypesByIdsAndUser(userId, queueIds);
  const map: Record<string, string | null> = {};
  for (const id of queueIds) {
    map[id] = queues.find((q) => q.id === id)?.name ?? null;
  }
  return map;
}

/**
 * Humanized scope summary for list and detail.
 * PERIOD: "Last 7 days" or "Mar 1 – Mar 7" when from/to set.
 * SINGLE_POST: "Single post".
 * QUEUE: "Queue: {queueName}" or "Queue" if name unresolved.
 */
export function formatScopeSummaryLabel(
  scopeType: GiveawayScopeType,
  scopeReference: Record<string, unknown>,
  queueName?: string | null
): string {
  switch (scopeType) {
    case "PERIOD": {
      const from = scopeReference["from"];
      const to = scopeReference["to"];
      const days = scopeReference["days"];
      if (from && to && typeof from === "string" && typeof to === "string") {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const base = `${fromDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${toDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        return queueName ? `${base} · Queue: ${queueName}` : base;
      }
      const d = typeof days === "number" ? days : 7;
      const base = `Last ${d} days`;
      return queueName ? `${base} · Queue: ${queueName}` : base;
    }
    case "SINGLE_POST":
      return "Single post";
    case "QUEUE":
      return queueName ? `Queue: ${queueName}` : "Queue";
    case "FOLLOWERS":
      return "Followers";
    case "FOLLOWING":
      return "Following";
    default:
      return String(scopeType);
  }
}

/**
 * Humanized status label for list and detail.
 */
export function formatStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PREVIEWED":
      return "Preview";
    case "LOCKED":
      return "Locked";
    case "PAID_OUT":
      return "Paid out";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}
