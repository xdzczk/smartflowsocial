/**
 * Group scheduled/published thread segments so the earliest segment is the main row
 * and later segments are nested (dropdown), matching calendar/flow behavior.
 */

import { postToCombinedContent } from "~/features/posts/combined";

import type { CombinedContent, PostData } from "../types";

import { isAttachedFollowUpContent } from "./attached-follow-up-rows";

export interface ThreadListRow {
  root: CombinedContent;
  threadSegments: CombinedContent[];
}

export interface PostThreadRow {
  root: PostData;
  threadSegments: PostData[];
}

function listingTimeMs(
  item: CombinedContent,
  mode: "scheduled" | "published"
): number {
  if (mode === "scheduled") {
    const d = item.scheduledAtUtc;
    if (!d) return 0;
    const dt = d instanceof Date ? d : new Date(d);
    const t = dt.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  const p = item.publishedAt;
  if (!p) return 0;
  const dt = p instanceof Date ? p : new Date(p);
  const t = dt.getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Builds one row per thread (earliest segment = root) plus standalone posts/longform.
 * `sortedFlat` should be the full list in the desired primary order (e.g. after sort).
 */
export function buildThreadListRows(
  sortedFlat: CombinedContent[],
  listType: "scheduled" | "published" | "draft"
): ThreadListRow[] {
  if (listType === "draft") {
    return sortedFlat.map((root) => ({ root, threadSegments: [] }));
  }

  const mode = listType;
  const postIds = new Set(
    sortedFlat.filter((item) => item.type === "post").map((item) => item.id)
  );
  const isNestedAttachedFollowUp = (item: CombinedContent) =>
    isAttachedFollowUpContent(item) &&
    item.parentScheduledActionId != null &&
    postIds.has(item.parentScheduledActionId);

  /** Parent not in this listing (e.g. published while follow-up still scheduled): never merge into thread rows. */
  const isOrphanAttachedFollowUp = (item: CombinedContent) =>
    isAttachedFollowUpContent(item) &&
    item.parentScheduledActionId != null &&
    item.parentScheduledActionId !== "" &&
    !postIds.has(item.parentScheduledActionId);

  const groups = new Map<string, CombinedContent[]>();
  for (const item of sortedFlat) {
    if (item.type !== "post") continue;
    /** Queue follow-ups nest under a visible parent row; otherwise they need their own row. */
    if (isNestedAttachedFollowUp(item)) continue;
    /** Orphan follow-ups must not become thread segments of a sibling row. */
    if (isOrphanAttachedFollowUp(item)) continue;
    const gid = item.threadGroupId;
    if (!gid) continue;
    const arr = groups.get(gid) ?? [];
    arr.push(item);
    groups.set(gid, arr);
  }
  for (const [, arr] of groups) {
    arr.sort((a, b) => listingTimeMs(a, mode) - listingTimeMs(b, mode));
  }

  const emittedThread = new Set<string>();
  const rows: ThreadListRow[] = [];

  for (const item of sortedFlat) {
    if (item.type === "longform") {
      rows.push({ root: item, threadSegments: [] });
      continue;
    }
    // After the longform branch, `item` is the post branch of `CombinedContent`.
    if (isNestedAttachedFollowUp(item)) {
      continue;
    }
    if (isOrphanAttachedFollowUp(item)) {
      rows.push({ root: item, threadSegments: [] });
      continue;
    }
    if (!item.threadGroupId) {
      rows.push({ root: item, threadSegments: [] });
      continue;
    }
    const gid = item.threadGroupId;
    if (emittedThread.has(gid)) continue;
    emittedThread.add(gid);
    const g = groups.get(gid);
    if (!g?.length) continue;
    const root = g[0]!;
    rows.push({ root, threadSegments: g.slice(1) });
  }

  return rows;
}

export function threadListRowMatchesSearch(
  row: ThreadListRow,
  type: "scheduled" | "published" | "draft",
  matchesItem: (item: CombinedContent, t: typeof type) => boolean,
  /** Queue follow-ups nested under the parent row (not in `threadSegments`). */
  attachedForRoot: CombinedContent[] = []
): boolean {
  if (matchesItem(row.root, type)) return true;
  if (row.threadSegments.some((s) => matchesItem(s, type))) return true;
  return attachedForRoot.some((a) => matchesItem(a, type));
}

/** Include every post in a thread if any segment’s caption matches the search term. */
export function filterPostsBySearchWithThreads(
  posts: PostData[],
  searchTerm: string
): PostData[] {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return posts;
  const groupsWithMatch = new Set<string>();
  const parentIdsForAttachedMatch = new Set<string>();
  for (const p of posts) {
    if (p.caption?.toLowerCase().includes(term) && p.threadGroupId) {
      groupsWithMatch.add(p.threadGroupId);
    }
    if (
      p.dependencyMode !== "standalone" &&
      p.parentScheduledActionId &&
      p.caption?.toLowerCase().includes(term)
    ) {
      parentIdsForAttachedMatch.add(p.parentScheduledActionId);
    }
  }
  return posts.filter((p) => {
    if (p.caption?.toLowerCase().includes(term)) return true;
    if (p.threadGroupId && groupsWithMatch.has(p.threadGroupId)) return true;
    if (parentIdsForAttachedMatch.has(p.id)) return true;
    return false;
  });
}

export function buildPostThreadRows(
  posts: PostData[],
  mode: "scheduled" | "published"
): PostThreadRow[] {
  const combined = posts.map((p) => postToCombinedContent(p));
  const rows = buildThreadListRows(combined, mode);
  return rows.map((r) => ({
    root: r.root.originalData as PostData,
    threadSegments: r.threadSegments.map((s) => s.originalData as PostData),
  }));
}

export function selectableRootIdsFromPostRows(rows: PostThreadRow[]): string[] {
  return rows.map((r) => r.root.id);
}

/** Aligns with `useScheduledState` / scheduled posts table sorting. */
export function comparePostDataByScheduledSort(
  a: PostData,
  b: PostData,
  sortConfig: { key: string; direction: "asc" | "desc" }
): number {
  if (
    sortConfig.key === "scheduledAtUtc" ||
    sortConfig.key === "scheduledFor"
  ) {
    const dateA = a.scheduledAtUtc ? a.scheduledAtUtc.getTime() : 0;
    const dateB = b.scheduledAtUtc ? b.scheduledAtUtc.getTime() : 0;
    return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
  }
  const aValue = (a as unknown as Record<string, unknown>)[sortConfig.key];
  const bValue = (b as unknown as Record<string, unknown>)[sortConfig.key];
  if (aValue === undefined || bValue === undefined) return 0;
  const av =
    typeof aValue === "string" || typeof aValue === "number"
      ? aValue
      : String(aValue);
  const bv =
    typeof bValue === "string" || typeof bValue === "number"
      ? bValue
      : String(bValue);
  if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
  if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
  return 0;
}
