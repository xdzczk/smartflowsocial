import type { CombinedContent } from "~/features/posts/types";

/**
 * Removes extra thread segments so each `threadGroupId` appears at most once.
 * **Input must be sorted in chronological order** (ascending go-live): the first
 * segment in time is kept; later segments in the same thread are dropped.
 */
export function dedupeFlowItemsByThreadGroup(
  items: CombinedContent[]
): CombinedContent[] {
  const seenThreadGroups = new Set<string>();
  const out: CombinedContent[] = [];
  for (const item of items) {
    if (item.type !== "post") {
      out.push(item);
      continue;
    }
    const gid = item.threadGroupId;
    if (typeof gid === "string" && gid.length > 0) {
      if (seenThreadGroups.has(gid)) continue;
      seenThreadGroups.add(gid);
    }
    out.push(item);
  }
  return out;
}
