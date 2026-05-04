/**
 * Queue follow-ups attached to a parent scheduled item (`dependencyMode: attached`).
 * Used to nest follow-up actions under the parent's row menu instead of duplicating per row.
 */

import type { CombinedContent, PostData } from "../types";

export function isAttachedFollowUpPost(post: PostData): boolean {
  return post.dependencyMode === "attached";
}

export function isAttachedFollowUpContent(item: CombinedContent): boolean {
  return item.type === "post" && item.dependencyMode === "attached";
}

function sortByScheduledTime(a: PostData, b: PostData): number {
  const ta = a.scheduledAtUtc ? a.scheduledAtUtc.getTime() : 0;
  const tb = b.scheduledAtUtc ? b.scheduledAtUtc.getTime() : 0;
  return ta - tb;
}

/** Scheduled posts only; parents keyed by `Post.id` (parent scheduled action id). */
export function attachedPostsByParentId(
  posts: PostData[]
): Map<string, PostData[]> {
  const m = new Map<string, PostData[]>();
  for (const p of posts) {
    if (p.dependencyMode !== "attached") continue;
    const pid = p.parentScheduledActionId;
    if (pid == null || pid === "") continue;
    const arr = m.get(pid) ?? [];
    arr.push(p);
    m.set(pid, arr);
  }
  for (const [, arr] of m) {
    arr.sort(sortByScheduledTime);
  }
  return m;
}

function combinedScheduledMs(c: CombinedContent): number {
  if (!(c.scheduledAtUtc instanceof Date)) return 0;
  const t = c.scheduledAtUtc.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function attachedCombinedByParentId(
  items: CombinedContent[]
): Map<string, CombinedContent[]> {
  const m = new Map<string, CombinedContent[]>();
  for (const item of items) {
    if (item.type !== "post" || item.dependencyMode !== "attached") continue;
    const pid = item.parentScheduledActionId;
    if (pid == null || pid === "") continue;
    const arr = m.get(pid) ?? [];
    arr.push(item);
    m.set(pid, arr);
  }
  for (const [, arr] of m) {
    arr.sort((a, b) => combinedScheduledMs(a) - combinedScheduledMs(b));
  }
  return m;
}
