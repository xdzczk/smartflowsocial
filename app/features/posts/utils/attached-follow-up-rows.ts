/**
 * Queue follow-ups attached to a parent scheduled item (`dependencyMode: attached`).
 * Used to nest follow-up actions under the parent's row menu instead of duplicating per row.
 */

import type { CombinedContent, PostData } from "../types";

export function isAttachedFollowUpPost(post: PostData): boolean {
  if (
    post.parentScheduledActionId == null ||
    post.parentScheduledActionId === ""
  ) {
    return false;
  }
  return post.dependencyMode !== "standalone";
}

export function isAttachedFollowUpContent(item: CombinedContent): boolean {
  if (item.type !== "post") return false;
  if (
    item.parentScheduledActionId == null ||
    item.parentScheduledActionId === ""
  ) {
    return false;
  }
  return item.dependencyMode !== "standalone";
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
    const pid = p.parentScheduledActionId;
    if (pid == null || pid === "") continue;
    /** Parent link implies nested listing; skip explicit standalone (orphan parent ref). */
    if (p.dependencyMode === "standalone") continue;
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
    if (item.type !== "post") continue;
    const pid = item.parentScheduledActionId;
    if (pid == null || pid === "") continue;
    if (item.dependencyMode === "standalone") continue;
    const arr = m.get(pid) ?? [];
    arr.push(item);
    m.set(pid, arr);
  }
  for (const [, arr] of m) {
    arr.sort((a, b) => combinedScheduledMs(a) - combinedScheduledMs(b));
  }
  return m;
}

/**
 * Follow-ups are keyed by their immediate parent's post id. Listing rows use one row per
 * Nostr thread with the earliest segment as root; merge children hanging off the root or
 * any later segment into that row.
 */
export function attachedPostsForThreadRow(
  byParent: Map<string, PostData[]>,
  row: { root: PostData; threadSegments: PostData[] }
): PostData[] {
  const seen = new Set<string>();
  const out: PostData[] = [];
  const take = (id: string) => {
    const list = byParent.get(id);
    if (!list) return;
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  };
  take(row.root.id);
  for (const seg of row.threadSegments) {
    take(seg.id);
  }
  out.sort(sortByScheduledTime);
  return out;
}

export function attachedCombinedForThreadRow(
  byParent: Map<string, CombinedContent[]>,
  row: { root: CombinedContent; threadSegments: CombinedContent[] }
): CombinedContent[] {
  const seen = new Set<string>();
  const out: CombinedContent[] = [];
  const take = (id: string) => {
    const list = byParent.get(id);
    if (!list) return;
    for (const c of list) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  };
  take(row.root.id);
  for (const seg of row.threadSegments) {
    take(seg.id);
  }
  out.sort((a, b) => combinedScheduledMs(a) - combinedScheduledMs(b));
  return out;
}
