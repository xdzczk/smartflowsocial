import type {
  AuthorPage,
  AuthorStream,
  DiscoveredEvent,
  EventCountsSnapshot,
  EventLookup,
} from "~/features/nostrmash/parse";

export type { AuthorStream };

const STREAMS: AuthorStream[] = ["notes", "replies", "longform"];

export interface SyncState {
  nextCursor: string | null;
  backfillComplete: boolean;
  updatedAt: number;
}

export interface SnapshotTarget {
  userId: string;
  nostrEventId: string;
  postId: string | null;
}

export interface ObservationInput {
  userId: string;
  nostrEventId: string;
  postId: string | null;
  reactionCount: number | null;
  replyCount: number | null;
  repostCount: number | null;
  zapCount: number | null;
  zapMsats: bigint | null;
  missingFromIndex: boolean;
  checkedAt: Date;
}

export interface NostrMashAnalyticsClient {
  listAuthorPage(
    pubkey: string,
    stream: AuthorStream,
    cursor: string | null
  ): Promise<AuthorPage | null>;
  lookupEvent(eventId: string): Promise<EventLookup>;
  readCounts(eventId: string): Promise<EventCountsSnapshot | null>;
}

export interface AnalyticsDirectory {
  listCandidateUserIds(): Promise<string[]>;
  isCollectionActive(userId: string): Promise<boolean>;
  pubkeyHex(userId: string): Promise<string | null>;
  postIdForEvent(userId: string, nostrEventId: string): Promise<string | null>;
  getSync(userId: string, stream: AuthorStream): Promise<SyncState | null>;
  saveSync(
    userId: string,
    stream: AuthorStream,
    state: { nextCursor: string | null; backfillComplete: boolean }
  ): Promise<void>;
  upsertTracked(row: {
    userId: string;
    event: DiscoveredEvent;
    postId: string | null;
  }): Promise<void>;
  oldestForSnapshot(
    userIds: string[],
    limit: number
  ): Promise<SnapshotTarget[]>;
  appendObservation(row: ObservationInput): Promise<void>;
}

export interface SweepResult {
  candidates: number;
  activeUsers: number;
  discovered: number;
  snapshotted: number;
  misses: number;
  skipped: number;
}

export interface SweepOptions {
  batchSize: number;
  concurrency: number;
  now?: Date;
}

export function pickDiscovery(
  syncs: Partial<Record<AuthorStream, SyncState | null>>
): { stream: AuthorStream; cursor: string | null; refresh: boolean } {
  for (const stream of STREAMS) {
    const state = syncs[stream];
    if (!state?.backfillComplete) {
      return { stream, cursor: state?.nextCursor ?? null, refresh: false };
    }
  }
  let oldest: AuthorStream = "notes";
  let oldestAt = Number.POSITIVE_INFINITY;
  for (const stream of STREAMS) {
    const at = syncs[stream]?.updatedAt ?? 0;
    if (at < oldestAt) {
      oldestAt = at;
      oldest = stream;
    }
  }
  return { stream: oldest, cursor: null, refresh: true };
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        const item = items[current];
        if (item !== undefined) await fn(item);
      }
    }
  );
  await Promise.all(workers);
}

async function loadSyncs(
  directory: AnalyticsDirectory,
  userId: string
): Promise<Partial<Record<AuthorStream, SyncState | null>>> {
  const entries = await Promise.all(
    STREAMS.map(
      async (stream) =>
        [stream, await directory.getSync(userId, stream)] as const
    )
  );
  return Object.fromEntries(entries);
}

/**
 * When the next stream was last checked. Missing rows count as never checked.
 * This follows the same stream order as {@link pickDiscovery}, so a failed
 * notes check does not keep the profile ahead of one that has never been read.
 */
function incompleteStaleness(
  syncs: Partial<Record<AuthorStream, SyncState | null>>
): number | null {
  for (const stream of STREAMS) {
    if (syncs[stream]?.backfillComplete) continue;
    return syncs[stream]?.updatedAt ?? 0;
  }
  return null;
}

function refreshStaleness(
  syncs: Partial<Record<AuthorStream, SyncState | null>>
): number {
  let oldest = Number.POSITIVE_INFINITY;
  for (const stream of STREAMS) {
    const at = syncs[stream]?.updatedAt ?? 0;
    if (at < oldest) oldest = at;
  }
  return oldest;
}

async function discoverAuthorPage(
  client: NostrMashAnalyticsClient,
  directory: AnalyticsDirectory,
  userId: string,
  checkedAt: Date,
  forced?: { stream: AuthorStream; cursor: string | null }
): Promise<
  | { ok: false; reason: "no_pubkey" | "unavailable" }
  | { ok: true; events: DiscoveredEvent[]; snapshotted: number }
> {
  const pubkey = await directory.pubkeyHex(userId);
  if (!pubkey) return { ok: false, reason: "no_pubkey" };
  const syncs = await loadSyncs(directory, userId);
  const pick = forced
    ? { stream: forced.stream, cursor: forced.cursor, refresh: false }
    : pickDiscovery(syncs);
  const page = await client.listAuthorPage(pubkey, pick.stream, pick.cursor);
  const previous = syncs[pick.stream];
  if (!page) {
    await directory.saveSync(userId, pick.stream, {
      nextCursor: previous?.nextCursor ?? null,
      backfillComplete: previous?.backfillComplete ?? false,
    });
    return { ok: false, reason: "unavailable" };
  }
  const events: DiscoveredEvent[] = [];
  let snapshotted = 0;
  for (const event of page.events) {
    const postId = await directory.postIdForEvent(userId, event.nostrEventId);
    await directory.upsertTracked({ userId, event, postId });
    events.push(event);
    if (!event.counts) continue;
    await directory.appendObservation({
      userId,
      nostrEventId: event.nostrEventId,
      postId,
      reactionCount: event.counts.reactionCount,
      replyCount: event.counts.replyCount,
      repostCount: event.counts.repostCount,
      zapCount: event.counts.zapCount,
      zapMsats: event.counts.zapMsats,
      missingFromIndex: false,
      checkedAt,
    });
    snapshotted += 1;
  }
  const backfillComplete = pick.refresh ? true : page.nextCursor === null;
  await directory.saveSync(userId, pick.stream, {
    nextCursor: backfillComplete ? null : page.nextCursor,
    backfillComplete,
  });
  return { ok: true, events, snapshotted };
}

async function snapshotOne(
  client: NostrMashAnalyticsClient,
  directory: AnalyticsDirectory,
  target: SnapshotTarget,
  checkedAt: Date
): Promise<"miss" | "snapshot" | "skip"> {
  const lookup = await client.lookupEvent(target.nostrEventId);
  if (lookup.status === "error") return "skip";
  if (lookup.status === "missing") {
    await directory.appendObservation({
      userId: target.userId,
      nostrEventId: target.nostrEventId,
      postId: target.postId,
      reactionCount: null,
      replyCount: null,
      repostCount: null,
      zapCount: null,
      zapMsats: null,
      missingFromIndex: true,
      checkedAt,
    });
    return "miss";
  }
  const counts = await client.readCounts(target.nostrEventId);
  if (!counts) return "skip";
  await directory.appendObservation({
    userId: target.userId,
    nostrEventId: target.nostrEventId,
    postId: target.postId,
    reactionCount: counts.reactionCount,
    replyCount: counts.replyCount,
    repostCount: counts.repostCount,
    zapCount: counts.zapCount,
    zapMsats: counts.zapMsats,
    missingFromIndex: false,
    checkedAt,
  });
  return "snapshot";
}

/**
 * Index one NostrMash page for a single paid profile and snapshot the newest
 * notes from that page. Used when the viewer opens an empty analytics catalog.
 */
export async function collectUserPostAnalytics(
  client: NostrMashAnalyticsClient,
  directory: AnalyticsDirectory,
  userId: string,
  options: {
    snapshotLimit: number;
    concurrency?: number;
    now?: Date;
    /** Read this stream from the start, ignoring a finished or later stream. */
    stream?: AuthorStream;
  }
): Promise<{
  discovered: number;
  snapshotted: number;
  unavailable: boolean;
}> {
  if (!(await directory.isCollectionActive(userId))) {
    return { discovered: 0, snapshotted: 0, unavailable: false };
  }
  const checkedAt = options.now ?? new Date();
  const discovered = await discoverAuthorPage(
    client,
    directory,
    userId,
    checkedAt,
    options.stream ? { stream: options.stream, cursor: null } : undefined
  );
  if (!discovered.ok) {
    return {
      discovered: 0,
      snapshotted: 0,
      unavailable: discovered.reason === "unavailable",
    };
  }
  if (discovered.events.length === 0) {
    return {
      discovered: 0,
      snapshotted: discovered.snapshotted,
      unavailable: false,
    };
  }
  const limit = Math.max(0, Math.floor(options.snapshotLimit));
  let snapshotted = discovered.snapshotted;
  await mapPool(
    discovered.events.filter((event) => !event.counts).slice(0, limit),
    options.concurrency ?? 4,
    async (event) => {
      const postId = await directory.postIdForEvent(userId, event.nostrEventId);
      const outcome = await snapshotOne(
        client,
        directory,
        { userId, nostrEventId: event.nostrEventId, postId },
        checkedAt
      );
      if (outcome === "snapshot") snapshotted += 1;
    }
  );
  return {
    discovered: discovered.events.length,
    snapshotted,
    unavailable: false,
  };
}

/**
 * Catalog paid profiles from NostrMash and append count snapshots.
 * Users who fail the paid gate are skipped. Stored rows are never deleted here.
 */
export async function runPostAnalyticsSweep(
  client: NostrMashAnalyticsClient,
  directory: AnalyticsDirectory,
  options: SweepOptions
): Promise<SweepResult> {
  const result: SweepResult = {
    candidates: 0,
    activeUsers: 0,
    discovered: 0,
    snapshotted: 0,
    misses: 0,
    skipped: 0,
  };
  const batchSize = Math.max(1, Math.floor(options.batchSize));
  const checkedAt = options.now ?? new Date();
  const candidates = await directory.listCandidateUserIds();
  result.candidates = candidates.length;

  const active: string[] = [];
  for (const userId of candidates) {
    try {
      if (await directory.isCollectionActive(userId)) active.push(userId);
    } catch {
      result.skipped += 1;
    }
  }
  result.activeUsers = active.length;
  if (active.length === 0) return result;

  const ranked: Array<{
    userId: string;
    staleness: number;
    incomplete: boolean;
  }> = [];
  for (const userId of active) {
    const syncs = await loadSyncs(directory, userId);
    const unfinished = incompleteStaleness(syncs);
    ranked.push({
      userId,
      staleness: unfinished ?? refreshStaleness(syncs),
      incomplete: unfinished !== null,
    });
  }
  const byStaleness = (
    left: { staleness: number; userId: string },
    right: { staleness: number; userId: string }
  ) =>
    left.staleness - right.staleness || left.userId.localeCompare(right.userId);
  const incomplete = ranked.filter((row) => row.incomplete).sort(byStaleness);
  const refreshed = ranked.filter((row) => !row.incomplete).sort(byStaleness);
  let discoverBudget = Math.floor(batchSize / 2);
  if (incomplete.length > 0) discoverBudget = Math.max(discoverBudget, 1);
  if (batchSize === 1 && incomplete.length > 0) discoverBudget = 1;
  const discoverUsers = (incomplete.length > 0 ? incomplete : refreshed)
    .slice(0, discoverBudget)
    .map((row) => row.userId);

  await mapPool(discoverUsers, options.concurrency, async (userId) => {
    try {
      const discovered = await discoverAuthorPage(
        client,
        directory,
        userId,
        checkedAt
      );
      if (!discovered.ok) {
        result.skipped += 1;
        return;
      }
      result.discovered += discovered.events.length;
      result.snapshotted += discovered.snapshotted;
    } catch {
      result.skipped += 1;
    }
  });

  const snapshotBudget = Math.max(0, batchSize - discoverUsers.length);
  if (snapshotBudget === 0) return result;
  const targets = await directory.oldestForSnapshot(active, snapshotBudget);
  await mapPool(targets, options.concurrency, async (target) => {
    try {
      const outcome = await snapshotOne(client, directory, target, checkedAt);
      if (outcome === "miss") result.misses += 1;
      else if (outcome === "snapshot") result.snapshotted += 1;
      else result.skipped += 1;
    } catch {
      result.skipped += 1;
    }
  });

  return result;
}
