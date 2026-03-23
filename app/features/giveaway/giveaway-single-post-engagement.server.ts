/**
 * Single-post giveaways: count only engagement on the selected root note, not nested
 * thread replies. thread_view returns the whole tree; many kind-1 notes include a
 * "root" e-tag pointing at the parent note while their "reply" parent is a child note.
 */

import type { RelatedEvent } from "./types";

function getKind1ReplyParentEventId(event: RelatedEvent): string | null {
  const tags = event.tags;
  if (!Array.isArray(tags)) return null;
  const eTags = tags.filter(
    (t): t is string[] =>
      Array.isArray(t) &&
      t[0] === "e" &&
      typeof t[1] === "string" &&
      t[1] !== ""
  );
  if (eTags.length === 0) return null;
  const replyMarked = eTags.find((t) => t.length > 3 && t[3] === "reply");
  if (replyMarked) return replyMarked[1] ?? null;
  return eTags[0]![1] ?? null;
}

/** True when this kind 1 is a direct reply to rootEventId (NIP-10 reply / deprecated first-e). */
export function kind1IsDirectReplyToRootEvent(
  event: RelatedEvent,
  rootEventId: string
): boolean {
  if (event.kind !== 1) return false;
  const parent = getKind1ReplyParentEventId(event);
  return parent === rootEventId;
}

export function kind9735TargetsEventId(
  event: RelatedEvent,
  targetEventId: string
): boolean {
  if (event.kind !== 9735) return false;
  const tags = event.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some(
    (t): t is string[] =>
      Array.isArray(t) && t[0] === "e" && t[1] === targetEventId
  );
}

/**
 * Keep likes/reposts from event_actions (already for root id), kind-1 only if
 * directly replying to the root, and zaps whose e-tag targets the root.
 */
export function filterRelatedEventsToRootNoteEngagementOnly(
  events: RelatedEvent[],
  rootEventId: string
): RelatedEvent[] {
  return events.filter((e) => {
    if (e.kind === 7 || e.kind === 6) return true;
    if (e.kind === 1) return kind1IsDirectReplyToRootEvent(e, rootEventId);
    if (e.kind === 9735) return kind9735TargetsEventId(e, rootEventId);
    return false;
  });
}
