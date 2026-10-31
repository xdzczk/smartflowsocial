const HEX_64 = /^[0-9a-f]{64}$/i;
const EXCERPT_LIMIT = 280;

export type AuthorStream = "notes" | "replies" | "longform";

export interface DiscoveredEvent {
  nostrEventId: string;
  kind: number;
  eventCreatedAt: Date | null;
  contentExcerpt: string;
}

export interface AuthorPage {
  events: DiscoveredEvent[];
  nextCursor: string | null;
}

export type EventLookup =
  | { status: "present" }
  | { status: "missing" }
  | { status: "error" };

export interface EventCountsSnapshot {
  reactionCount: number;
  replyCount: number;
  repostCount: number;
  zapCount: number;
  zapMsats: bigint;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function hex64(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return HEX_64.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function contentExcerpt(content: unknown): string {
  if (typeof content !== "string") return "";
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= EXCERPT_LIMIT) return flat;
  return `${flat.slice(0, EXCERPT_LIMIT - 3)}...`;
}

function eventCreatedAt(value: unknown): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nostrEventRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return nostrEventRecord(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

function discoveredFromEvent(value: unknown): DiscoveredEvent | null {
  const event = nostrEventRecord(value);
  if (!event) return null;
  const nostrEventId = hex64(event["id"]);
  const kind = event["kind"];
  if (!nostrEventId || typeof kind !== "number" || !Number.isInteger(kind)) {
    return null;
  }
  if (kind !== 1 && kind !== 30023) return null;
  return {
    nostrEventId,
    kind,
    eventCreatedAt: eventCreatedAt(event["created_at"]),
    contentExcerpt: contentExcerpt(event["content"]),
  };
}

/**
 * Author note pages use `events`. The replies route uses `items`.
 * `next_cursor` is omitted when the walk is finished.
 */
export function parseAuthorPage(body: unknown): AuthorPage | null {
  const record = asRecord(body);
  if (!record) return null;
  const rawEvents = Array.isArray(record["events"])
    ? record["events"]
    : Array.isArray(record["items"])
      ? record["items"]
      : null;
  if (!rawEvents) return null;
  const events: DiscoveredEvent[] = [];
  const seen = new Set<string>();
  for (const item of rawEvents) {
    const event = discoveredFromEvent(item);
    if (!event || seen.has(event.nostrEventId)) continue;
    seen.add(event.nostrEventId);
    events.push(event);
  }
  const cursor = record["next_cursor"];
  const nextCursor =
    typeof cursor === "string" && cursor.trim().length > 0
      ? cursor.trim()
      : null;
  return { events, nextCursor };
}

/**
 * A missing note is HTTP 404 `error.code = not_found`.
 * Counts can still be non-zero for an id the index does not have, so a 200
 * from `/counts` is not an existence check.
 */
export function parseEventLookup(status: number, body: unknown): EventLookup {
  if (status === 404) {
    const code = asRecord(asRecord(body)?.["error"])?.["code"];
    return code === "not_found" ? { status: "missing" } : { status: "error" };
  }
  if (status !== 200) return { status: "error" };
  const event = nostrEventRecord(asRecord(body)?.["event"]);
  if (!event || !hex64(event["id"])) return { status: "error" };
  return { status: "present" };
}

function countField(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

export function parseCounts(body: unknown): EventCountsSnapshot | null {
  const record = asRecord(body);
  if (!record) return null;
  const reactionCount = countField(record, "reaction_count");
  const replyCount = countField(record, "reply_count");
  const repostCount = countField(record, "repost_count");
  const zapCount = countField(record, "zap_count");
  const zapMsats = countField(record, "zap_msats");
  if (
    reactionCount === null ||
    replyCount === null ||
    repostCount === null ||
    zapCount === null ||
    zapMsats === null
  ) {
    return null;
  }
  return {
    reactionCount,
    replyCount,
    repostCount,
    zapCount,
    zapMsats: BigInt(zapMsats),
  };
}

export function satsFromMsats(zapMsats: bigint | null): number {
  if (zapMsats === null) return 0;
  return Number(zapMsats / 1000n);
}

const PROFILE_KEYS = [
  "name",
  "display_name",
  "about",
  "picture",
  "banner",
  "nip05",
  "lud16",
  "lud06",
  "website",
  "website_url",
  "pronouns",
] as const;

/** Kind 0 content SmartFlow already parses. Drops index-only wrapper fields. */
export function profileMetadataContent(profile: unknown): string | null {
  if (typeof profile === "string") {
    const trimmed = profile.trim();
    if (!trimmed || trimmed === "null" || trimmed === "{}") return null;
    return trimmed;
  }
  const record = asRecord(profile);
  if (!record) return null;
  const picked: Record<string, string> = {};
  for (const key of PROFILE_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) picked[key] = value;
  }
  if (!picked["display_name"] && typeof record["displayName"] === "string") {
    const displayName = record["displayName"].trim();
    if (displayName) picked["display_name"] = displayName;
  }
  if (Object.keys(picked).length === 0) return null;
  return JSON.stringify(picked);
}
