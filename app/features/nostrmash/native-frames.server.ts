import { nostrmashRead } from "./api.server";
import {
  asRecord,
  hex64,
  parseCounts,
  parseEventLookup,
  profileMetadataContent,
} from "./parse";

type CacheParams = Record<string, unknown>;

const MAX_BATCH = 100;
const MAX_COUNT_LOOKUPS = 20;

function nativeSubId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `nm${suffix}`;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hexList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const hex = hex64(item);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= max) break;
  }
  return out;
}

function bounded(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(value));
}

function kindContentEvent(
  kind: number,
  content: unknown,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const event: Record<string, unknown> = {
    id: "",
    pubkey: "",
    created_at: 0,
    kind,
    tags: [],
    content: typeof content === "string" ? content : JSON.stringify(content),
    sig: "",
  };
  if (extra) Object.assign(event, extra);
  return event;
}

function eventFrame(subId: string, event: Record<string, unknown>): unknown[] {
  return ["EVENT", subId, event];
}

function eoseFrame(subId: string): unknown[] {
  return ["EOSE", subId];
}

function finish(
  subId: string,
  events: Array<Record<string, unknown>>
): unknown[] | null {
  if (events.length === 0) return null;
  return [...events.map((event) => eventFrame(subId, event)), eoseFrame(subId)];
}

function kind0Event(
  pubkey: string,
  profile: unknown,
  metadataEventId: unknown,
  createdAt: unknown
): Record<string, unknown> | null {
  const content = profileMetadataContent(profile);
  if (!content) return null;
  return kindContentEvent(0, content, {
    id: typeof metadataEventId === "string" ? metadataEventId : "",
    pubkey,
    created_at: num(createdAt),
  });
}

function userStatsEvent(
  pubkey: string,
  stats: Record<string, unknown>
): Record<string, unknown> {
  return kindContentEvent(
    10000105,
    {
      pubkey,
      follows_count: num(stats["following_count"]),
      followers_count: num(stats["follower_count"]),
      note_count: num(stats["note_count"]),
      long_form_note_count: num(stats["long_form_note_count"]),
      reply_count: num(stats["reply_count"]),
      time_joined: num(stats["time_joined"]),
      relay_count: 0,
      total_zap_count: num(stats["zap_received_count"]),
      total_satszapped: num(stats["sats_zapped"]),
      media_count: num(stats["media_count"]),
      content_zap_count: num(stats["content_zap_count"]),
    },
    { pubkey }
  );
}

function noteStatsEvent(
  eventId: string,
  counts: EventCountsLike
): Record<string, unknown> {
  return kindContentEvent(10000100, {
    event_id: eventId,
    likes: counts.reactionCount,
    replies: counts.replyCount,
    mentions: 0,
    reposts: counts.repostCount,
    zaps: counts.zapCount,
    satszapped: Number(counts.zapMsats / 1000n),
    score: 0,
    score24h: 0,
    bookmarks: 0,
  });
}

interface EventCountsLike {
  reactionCount: number;
  replyCount: number;
  repostCount: number;
  zapCount: number;
  zapMsats: bigint;
}

function nostrEvent(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return nostrEvent(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  const record = asRecord(value);
  if (!record) return null;
  if (typeof record["kind"] === "number" || typeof record["id"] === "string") {
    return record;
  }
  return null;
}

async function queryUserProfile(
  params: CacheParams | undefined
): Promise<unknown[] | null> {
  const pubkey = hex64(params?.["pubkey"]);
  if (!pubkey) return null;
  const response = await nostrmashRead(
    `/api/v1/users/${encodeURIComponent(pubkey)}/summary`
  );
  if (response?.status !== 200) return null;
  const body = asRecord(response.body);
  if (!body) return null;
  const stats = asRecord(body["stats"]);
  const profile = kind0Event(
    pubkey,
    body["profile"],
    body["metadata_event_id"],
    body["metadata_created_at"]
  );
  if (!profile && !stats) return null;
  const events: Array<Record<string, unknown>> = [];
  if (profile) events.push(profile);
  if (stats) events.push(userStatsEvent(pubkey, stats));
  return finish(nativeSubId(), events);
}

async function queryUserInfos(
  params: CacheParams | undefined
): Promise<unknown[] | null> {
  const pubkeys = hexList(params?.["pubkeys"], MAX_BATCH);
  if (pubkeys.length === 0) return null;
  const response = await nostrmashRead("/api/v1/profiles/batch", {
    method: "POST",
    body: JSON.stringify({ pubkeys }),
  });
  if (response?.status !== 200) return null;
  const rows = asRecord(response.body)?.["profiles"];
  if (!Array.isArray(rows)) return null;
  const events: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const pubkey = hex64(record["pubkey"]);
    if (!pubkey) continue;
    const profile = kind0Event(
      pubkey,
      record["profile"],
      record["metadata_event_id"],
      record["metadata_created_at"]
    );
    if (profile) events.push(profile);
  }
  return finish(nativeSubId(), events);
}

async function queryEvents(
  params: CacheParams | undefined
): Promise<unknown[] | null> {
  const ids = hexList(params?.["event_ids"], MAX_BATCH);
  if (ids.length === 0) return null;
  const response = await nostrmashRead("/api/v1/events/batch", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  if (response?.status !== 200) return null;
  const events = (
    Array.isArray(asRecord(response.body)?.["events"])
      ? (asRecord(response.body)?.["events"] as unknown[])
      : []
  )
    .map((item) => nostrEvent(item))
    .filter((event): event is Record<string, unknown> => event !== null);
  return finish(nativeSubId(), events);
}

function unknownItems(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const items: unknown[] = [];
  for (const item of value) items.push(item);
  return items;
}

function threadNotes(body: Record<string, unknown>): {
  notes: Array<Record<string, unknown>>;
  seen: Set<string>;
} {
  const notes: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const items = [
    body["event"],
    ...unknownItems(body["ancestors"]),
    ...unknownItems(body["replies"]),
  ];
  for (const item of items) {
    const event = nostrEvent(item);
    const id = event ? hex64(event["id"]) : null;
    if (!event || (id && seen.has(id))) continue;
    if (id) seen.add(id);
    notes.push(event);
  }
  return { notes, seen };
}

function profileEvents(body: unknown): Array<Record<string, unknown>> {
  const rows = asRecord(body)?.["profiles"];
  const events: Array<Record<string, unknown>> = [];
  if (!Array.isArray(rows)) return events;
  for (const row of rows) {
    const record = asRecord(row);
    const pubkey = record ? hex64(record["pubkey"]) : null;
    if (!record || !pubkey) continue;
    const profile = kind0Event(
      pubkey,
      record["profile"],
      record["metadata_event_id"],
      record["metadata_created_at"]
    );
    if (profile) events.push(profile);
  }
  return events;
}

async function queryThread(
  params: CacheParams | undefined
): Promise<unknown[] | null> {
  const eventId = hex64(params?.["event_id"]);
  if (!eventId) return null;
  const limit = bounded(params?.["limit"], 100, 100);
  const [eventRes, countsRes] = await Promise.all([
    nostrmashRead(`/api/v1/events/${encodeURIComponent(eventId)}`),
    nostrmashRead(`/api/v1/events/${encodeURIComponent(eventId)}/counts`),
  ]);
  const lookup = eventRes
    ? parseEventLookup(eventRes.status, eventRes.body)
    : null;
  const focalCounts =
    countsRes?.status === 200 ? parseCounts(countsRes.body) : null;
  if (
    lookup?.status !== "present" ||
    !focalCounts ||
    focalCounts.zapCount > 0
  ) {
    return null;
  }

  const threadRes = await nostrmashRead(
    `/api/v1/threads/${encodeURIComponent(eventId)}?limit=${limit}&max_depth=${limit}`
  );
  const body = threadRes?.status === 200 ? asRecord(threadRes.body) : null;
  if (!body) return null;
  const { notes, seen } = threadNotes(body);
  if (!seen.has(eventId)) return null;

  const pubkeys = hexList(
    notes.map((event) => event["pubkey"]),
    MAX_BATCH
  );
  const extraIds = [...seen]
    .filter((id) => id !== eventId)
    .slice(0, MAX_COUNT_LOOKUPS - 1);
  const [profileRes, ...countResponses] = await Promise.all([
    pubkeys.length === 0
      ? Promise.resolve(null)
      : nostrmashRead("/api/v1/profiles/batch", {
          method: "POST",
          body: JSON.stringify({ pubkeys }),
        }),
    ...extraIds.map((id) =>
      nostrmashRead(`/api/v1/events/${encodeURIComponent(id)}/counts`)
    ),
  ]);

  const events = [...notes];
  if (profileRes?.status === 200) {
    events.push(...profileEvents(profileRes.body));
  }
  events.push(noteStatsEvent(eventId, focalCounts));
  countResponses.forEach((response, index) => {
    const id = extraIds[index];
    const counts = response?.status === 200 ? parseCounts(response.body) : null;
    if (id && counts) events.push(noteStatsEvent(id, counts));
  });
  return finish(nativeSubId(), events);
}

/**
 * NostrMash `/api/v1` shaped as the Primal EVENT page existing callers parse.
 * Returns null when the native read cannot answer, including zapped threads,
 * so the Primal compatibility socket can run.
 */
export async function tryNativePrimalFrames(
  requestType: string,
  params: CacheParams | undefined
): Promise<unknown[] | null> {
  switch (requestType) {
    case "user_profile":
      return queryUserProfile(params);
    case "user_infos":
      return queryUserInfos(params);
    case "events":
      return queryEvents(params);
    case "thread_view":
      return queryThread(params);
    default:
      return null;
  }
}
