/**
 * Extract direct kind-1 replies to a parent event from Primal `thread_view` / merged cache payloads.
 */

/** Max top-level replies returned on initial search load. */
export const SEARCH_THREAD_ROOT_REPLIES_MAX = 200;

/** Max replies fetched per expanded branch (lazy `thread_view` per parent). */
export const SEARCH_THREAD_BRANCH_REPLIES_MAX = 150;

export interface LooseNostrEvent {
  id?: string;
  event_id?: string;
  pubkey?: string;
  kind?: number;
  event_kind?: number;
  content?: string;
  created_at?: number;
  tags?: string[][];
}

function flattenPayload(raw: unknown): LooseNostrEvent[] {
  if (typeof raw === "string") {
    try {
      return flattenPayload(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (e): e is LooseNostrEvent => e != null && typeof e === "object"
    );
  }
  const obj = raw as Record<string, unknown>;
  const ev = obj["event"];
  if (ev != null && typeof ev === "object") {
    return [ev];
  }
  const data = obj["data"];
  const events = obj["events"];
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(events)
      ? events
      : null;
  if (arr) {
    return (arr as unknown[]).filter(
      (e): e is LooseNostrEvent => e != null && typeof e === "object"
    );
  }
  if (data != null && typeof data === "object" && !Array.isArray(data)) {
    return [data];
  }
  if (events != null && typeof events === "object" && !Array.isArray(events)) {
    return [events];
  }
  return [raw];
}

/**
 * Flatten Primal cache `EVENT` tuples into nostr-shaped event objects.
 */
export function collectCandidatesFromPrimalResponses(
  responses: unknown
): LooseNostrEvent[] {
  if (!Array.isArray(responses)) return [];
  return (responses as unknown[])
    .filter(
      (res): res is [string, string, unknown] =>
        Array.isArray(res) && res[0] === "EVENT" && res[2] != null
    )
    .flatMap((res) => flattenPayload(res[2]))
    .filter((ev): ev is LooseNostrEvent => typeof ev === "object");
}

export function getEvId(ev: LooseNostrEvent): string {
  return (
    (typeof ev.id === "string" ? ev.id : "") ||
    (typeof ev.event_id === "string" ? ev.event_id : "") ||
    ""
  ).toLowerCase();
}

export function getEvKind(ev: LooseNostrEvent): number {
  return ev.kind ?? ev.event_kind ?? 0;
}

function getCreatedAt(ev: LooseNostrEvent): number {
  return typeof ev.created_at === "number" ? ev.created_at : 0;
}

/**
 * True if any `e` tag points at the given event id (case-insensitive hex).
 */
export function replyEtagReferencesTarget(
  ev: LooseNostrEvent,
  targetIdNorm: string
): boolean {
  const tags = Array.isArray(ev.tags) ? ev.tags : [];
  return tags.some(
    (t) =>
      Array.isArray(t) &&
      t[0] === "e" &&
      typeof t[1] === "string" &&
      t[1].toLowerCase() === targetIdNorm
  );
}

/** @deprecated Use replyEtagReferencesTarget */
export function replyHasRootEtag(
  ev: LooseNostrEvent,
  rootIdNorm: string
): boolean {
  return replyEtagReferencesTarget(ev, rootIdNorm);
}

/**
 * Kind-1 notes that reference `parentEventId` in an `e` tag and are not the parent itself.
 * Sorted oldest → newest. Deduped by event id.
 */
export function extractDirectRepliesToParent(
  candidates: LooseNostrEvent[],
  parentEventId: string,
  options?: { max?: number }
): LooseNostrEvent[] {
  const parentNorm = parentEventId.toLowerCase();
  const max = options?.max ?? SEARCH_THREAD_BRANCH_REPLIES_MAX;
  const seen = new Set<string>();
  const out: LooseNostrEvent[] = [];

  for (const ev of candidates) {
    if (getEvKind(ev) !== 1) continue;
    const id = getEvId(ev);
    if (!id || id === parentNorm) continue;
    if (!replyEtagReferencesTarget(ev, parentNorm)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(ev);
  }

  out.sort((a, b) => getCreatedAt(a) - getCreatedAt(b));
  return out.slice(0, max);
}

/**
 * Direct replies to the thread root (same as `extractDirectRepliesToParent` with root id).
 */
export function extractDirectRepliesToRoot(
  candidates: LooseNostrEvent[],
  rootEventId: string,
  options?: { max?: number }
): LooseNostrEvent[] {
  return extractDirectRepliesToParent(candidates, rootEventId, {
    max: options?.max ?? SEARCH_THREAD_ROOT_REPLIES_MAX,
  });
}
