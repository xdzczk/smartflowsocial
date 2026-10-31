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

  const incomplete: string[] = [];
  for (const userId of active) {
    const syncs = await loadSyncs(directory, userId);
    if (STREAMS.some((stream) => !syncs[stream]?.backfillComplete)) {
      incomplete.push(userId);
    }
  }
  let discoverBudget = Math.floor(batchSize / 2);
  if (incomplete.length > 0) discoverBudget = Math.max(discoverBudget, 1);
  if (batchSize === 1 && incomplete.length > 0) discoverBudget = 1;
  const discoverUsers = (incomplete.length > 0 ? incomplete : active).slice(
    0,
    discoverBudget
  );

  await mapPool(discoverUsers, options.concurrency, async (userId) => {
    try {
      const pubkey = await directory.pubkeyHex(userId);
      if (!pubkey) {
        result.skipped += 1;
        return;
      }
      const syncs = await loadSyncs(directory, userId);
      const pick = pickDiscovery(syncs);
      const page = await client.listAuthorPage(
        pubkey,
        pick.stream,
        pick.cursor
      );
      const previous = syncs[pick.stream];
      if (!page) {
        await directory.saveSync(userId, pick.stream, {
          nextCursor: previous?.nextCursor ?? null,
          backfillComplete: previous?.backfillComplete ?? false,
        });
        result.skipped += 1;
        return;
      }
      for (const event of page.events) {
        const postId = await directory.postIdForEvent(
          userId,
          event.nostrEventId
        );
        await directory.upsertTracked({ userId, event, postId });
        result.discovered += 1;
      }
      const backfillComplete = pick.refresh ? true : page.nextCursor === null;
      await directory.saveSync(userId, pick.stream, {
        nextCursor: backfillComplete ? null : page.nextCursor,
        backfillComplete,
      });
    } catch {
      result.skipped += 1;
    }
  });

  const snapshotBudget = Math.max(0, batchSize - discoverUsers.length);
  if (snapshotBudget === 0) return result;
  const targets = await directory.oldestForSnapshot(active, snapshotBudget);
  await mapPool(targets, options.concurrency, async (target) => {
    try {
      const lookup = await client.lookupEvent(target.nostrEventId);
      if (lookup.status === "error") {
        result.skipped += 1;
        return;
      }
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
        result.misses += 1;
        return;
      }
      const counts = await client.readCounts(target.nostrEventId);
      if (!counts) {
        result.skipped += 1;
        return;
      }
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
      result.snapshotted += 1;
    } catch {
      result.skipped += 1;
    }
  });

  return result;
}
