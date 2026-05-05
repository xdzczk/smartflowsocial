/**
 * Queue follow-ups attached to a parent scheduled item (`dependencyMode: attached`).
 * Used to nest follow-up actions under the parent's row menu instead of duplicating per row.
 */

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
  ScheduledDependencyMode,
} from "../types";

import { isRepostContent, isRepostPost } from "./content-helpers";

/** Resolves `dependencyMode` from the row or from `originalData` when loaders omit the top-level field. */
export function effectiveDependencyModeForContent(
  item: CombinedContent
): ScheduledDependencyMode | undefined {
  if (item.dependencyMode != null) return item.dependencyMode;
  const od = item.originalData as { dependencyMode?: ScheduledDependencyMode };
  return od.dependencyMode;
}

export function isAttachedFollowUpPost(post: PostData): boolean {
  if (
    post.parentScheduledActionId == null ||
    post.parentScheduledActionId === ""
  ) {
    return false;
  }
  return post.dependencyMode !== "standalone";
}

/** Repost rows that appear on their own in listings/tabs (excludes queue follow-ups nested under a parent). */
export function isStandaloneRepostPost(post: PostData): boolean {
  return isRepostPost(post) && !isAttachedFollowUpPost(post);
}

export function isAttachedFollowUpContent(item: CombinedContent): boolean {
  if (item.type !== "post") return false;
  const mode = effectiveDependencyModeForContent(item);
  if (mode === "standalone") return false;
  if (mode === "attached") return true;
  const hasParent =
    item.parentScheduledActionId != null && item.parentScheduledActionId !== "";
  if (!hasParent) return false;
  return true;
}

/** Combined-content repost that counts toward Repost tabs / Flow repost totals (not an attached follow-up). */
export function isStandaloneRepostContent(item: CombinedContent): boolean {
  return isRepostContent(item) && !isAttachedFollowUpContent(item);
}

/** Primary line for attached follow-up dropdown rows (e.g. `Follow-up repost 2`). */
export function attachedFollowUpMenuTitle(
  postKind: string | undefined | null,
  ordinal: number
): string {
  switch (postKind) {
    case "REPOST":
      return `Follow-up repost ${ordinal}`;
    case "QUOTE":
      return `Follow-up quote ${ordinal}`;
    case "REPLY":
      return `Follow-up reply ${ordinal}`;
    case "THREAD":
      return `Follow-up thread ${ordinal}`;
    default:
      return `Follow-up ${ordinal}`;
  }
}

export function postKindForAttachedMenuItem(
  item: CombinedContent
): string | undefined {
  if (item.type !== "post") return undefined;
  if (item.postKind) return item.postKind;
  return (item.originalData as PostData).postKind;
}

/**
 * Schedule/publish instant for nested follow-up rows. Prefer {@link CombinedContent.originalData}
 * so listing hydration cannot surface the parent row's timestamps on the child.
 */
export function effectiveScheduledOrPublishedAtForAttachedMenuItem(
  item: CombinedContent,
  listType: "scheduled" | "published"
): Date | undefined {
  const od = item.originalData;
  if (listType === "scheduled") {
    if (item.type === "post") {
      const p = od as PostData;
      const u = p.scheduledAtUtc ?? item.scheduledAtUtc;
      return u instanceof Date && !Number.isNaN(u.getTime()) ? u : undefined;
    }
    const lf = od as LongFormPostData;
    const u = lf.scheduledAtUtc ?? item.scheduledAtUtc;
    return u instanceof Date && !Number.isNaN(u.getTime()) ? u : undefined;
  }
  if (item.type === "post") {
    const p = od as PostData;
    const d = p.publishedAt ?? item.publishedAt;
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : undefined;
  }
  const lf = od as LongFormPostData;
  const d = lf.publishedAt ?? item.publishedAt;
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : undefined;
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
