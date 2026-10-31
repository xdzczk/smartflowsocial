import { describe, expect, it, vi, type Mock } from "vitest";

import { notePerformanceStatus } from "~/features/analytics/status";
import {
  pickDiscovery,
  runPostAnalyticsSweep,
  type AnalyticsDirectory,
  type NostrMashAnalyticsClient,
  type ObservationInput,
  type SnapshotTarget,
  type SyncState,
} from "~/features/analytics/sweep";
import type {
  AuthorPage,
  AuthorStream,
  DiscoveredEvent,
  EventCountsSnapshot,
} from "~/features/nostrmash/parse";

const EVENT_A = "a".repeat(64);
const EVENT_B = "b".repeat(64);
const PUBKEY = "c".repeat(64);

function event(id: string, kind = 1): DiscoveredEvent {
  return {
    nostrEventId: id,
    kind,
    eventCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    contentExcerpt: `note ${id.slice(0, 4)}`,
  };
}

function counts(reactionCount: number): EventCountsSnapshot {
  return {
    reactionCount,
    replyCount: 0,
    repostCount: 0,
    zapCount: 0,
    zapMsats: 0n,
  };
}

interface Memory {
  active: Set<string>;
  pubkeys: Map<string, string>;
  posts: Map<string, string>;
  syncs: Map<string, SyncState>;
  tracked: Map<string, SnapshotTarget & { excerpt: string }>;
  observations: ObservationInput[];
  clock: number;
}

function key(userId: string, eventId: string): string {
  return `${userId}:${eventId}`;
}

function syncKey(userId: string, stream: AuthorStream): string {
  return `${userId}:${stream}`;
}

function createDirectory(memory: Memory): AnalyticsDirectory {
  return {
    async listCandidateUserIds() {
      return [...memory.pubkeys.keys()];
    },
    async isCollectionActive(userId) {
      return memory.active.has(userId);
    },
    async pubkeyHex(userId) {
      return memory.pubkeys.get(userId) ?? null;
    },
    async postIdForEvent(userId, nostrEventId) {
      return memory.posts.get(key(userId, nostrEventId)) ?? null;
    },
    async getSync(userId, stream) {
      return memory.syncs.get(syncKey(userId, stream)) ?? null;
    },
    async saveSync(userId, stream, state) {
      memory.clock += 1;
      memory.syncs.set(syncKey(userId, stream), {
        ...state,
        updatedAt: memory.clock,
      });
    },
    async upsertTracked(row) {
      memory.tracked.set(key(row.userId, row.event.nostrEventId), {
        userId: row.userId,
        nostrEventId: row.event.nostrEventId,
        postId: row.postId,
        excerpt: row.event.contentExcerpt,
      });
    },
    async oldestForSnapshot(userIds, limit) {
      const latest = new Map<string, number>();
      memory.observations.forEach((row, index) => {
        latest.set(key(row.userId, row.nostrEventId), index);
      });
      return [...memory.tracked.values()]
        .filter((row) => userIds.includes(row.userId))
        .sort((left, right) => {
          const leftAt = latest.get(key(left.userId, left.nostrEventId));
          const rightAt = latest.get(key(right.userId, right.nostrEventId));
          if (leftAt === undefined && rightAt === undefined) return 0;
          if (leftAt === undefined) return -1;
          if (rightAt === undefined) return 1;
          return leftAt - rightAt;
        })
        .slice(0, limit)
        .map(({ userId, nostrEventId, postId }) => ({
          userId,
          nostrEventId,
          postId,
        }));
    },
    async appendObservation(row) {
      memory.observations.push(row);
      const tracked = memory.tracked.get(key(row.userId, row.nostrEventId));
      if (tracked) tracked.postId = row.postId;
    },
  };
}

function createClient(pages: AuthorPage[]): NostrMashAnalyticsClient & {
  listAuthorPage: Mock;
  lookupEvent: Mock;
  readCounts: Mock;
} {
  const listAuthorPage = vi.fn(
    async () => pages.shift() ?? { events: [], nextCursor: null }
  );
  const lookupEvent = vi.fn(async () => ({ status: "present" as const }));
  const readCounts = vi.fn(async () => counts(1));
  return { listAuthorPage, lookupEvent, readCounts };
}

describe("paid post analytics sweep", () => {
  it("collects a paid profile and skips an expired one", async () => {
    const memory: Memory = {
      active: new Set(["paid"]),
      pubkeys: new Map([
        ["paid", PUBKEY],
        ["expired", "d".repeat(64)],
      ]),
      posts: new Map(),
      syncs: new Map(),
      tracked: new Map(),
      observations: [],
      clock: 0,
    };
    const client = createClient([
      { events: [event(EVENT_A)], nextCursor: null },
    ]);
    const result = await runPostAnalyticsSweep(
      client,
      createDirectory(memory),
      {
        batchSize: 10,
        concurrency: 1,
      }
    );

    expect(result.activeUsers).toBe(1);
    expect(result.candidates).toBe(2);
    expect(client.listAuthorPage).toHaveBeenCalledTimes(1);
    expect(client.listAuthorPage).toHaveBeenCalledWith(PUBKEY, "notes", null);
    expect(memory.observations).toHaveLength(1);
    expect(memory.observations[0]?.userId).toBe("paid");
  });

  it("links a SmartFlow post and keeps an external note without one", async () => {
    const memory: Memory = {
      active: new Set(["paid"]),
      pubkeys: new Map([["paid", PUBKEY]]),
      posts: new Map([[key("paid", EVENT_A), "post-1"]]),
      syncs: new Map(),
      tracked: new Map(),
      observations: [],
      clock: 0,
    };
    const client = createClient([
      { events: [event(EVENT_A), event(EVENT_B)], nextCursor: null },
    ]);
    await runPostAnalyticsSweep(client, createDirectory(memory), {
      batchSize: 10,
      concurrency: 1,
    });

    const linked = memory.observations.find(
      (row) => row.nostrEventId === EVENT_A
    );
    const external = memory.observations.find(
      (row) => row.nostrEventId === EVENT_B
    );
    expect(linked?.postId).toBe("post-1");
    expect(external?.postId).toBeNull();
    expect(external?.missingFromIndex).toBe(false);
  });

  it("stores a miss with null counts instead of zeros", async () => {
    const memory: Memory = {
      active: new Set(["paid"]),
      pubkeys: new Map([["paid", PUBKEY]]),
      posts: new Map(),
      syncs: new Map(),
      tracked: new Map(),
      observations: [],
      clock: 0,
    };
    const client = createClient([
      { events: [event(EVENT_A)], nextCursor: null },
    ]);
    client.lookupEvent.mockResolvedValue({ status: "missing" });
    await runPostAnalyticsSweep(client, createDirectory(memory), {
      batchSize: 10,
      concurrency: 1,
    });

    expect(client.readCounts).not.toHaveBeenCalled();
    expect(memory.observations).toEqual([
      expect.objectContaining({
        nostrEventId: EVENT_A,
        missingFromIndex: true,
        reactionCount: null,
        replyCount: null,
        repostCount: null,
        zapCount: null,
        zapMsats: null,
      }),
    ]);
    expect(
      notePerformanceStatus({
        missingFromIndex: true,
        reactionCount: null,
        replyCount: null,
        repostCount: null,
        zapCount: null,
        zapMsats: null,
      })
    ).toBe("missing");
  });

  it("appends a second observation and points the latest counts at it", async () => {
    const memory: Memory = {
      active: new Set(["paid"]),
      pubkeys: new Map([["paid", PUBKEY]]),
      posts: new Map(),
      syncs: new Map(),
      tracked: new Map(),
      observations: [],
      clock: 0,
    };
    const directory = createDirectory(memory);
    const first = createClient([
      { events: [event(EVENT_A)], nextCursor: null },
    ]);
    first.readCounts.mockResolvedValue(counts(2));
    await runPostAnalyticsSweep(first, directory, {
      batchSize: 10,
      concurrency: 1,
    });

    const second = createClient([
      { events: [event(EVENT_A)], nextCursor: null },
    ]);
    second.readCounts.mockResolvedValue(counts(9));
    await runPostAnalyticsSweep(second, directory, {
      batchSize: 10,
      concurrency: 1,
    });

    expect(memory.observations.map((row) => row.reactionCount)).toEqual([2, 9]);
    const latest = memory.observations[memory.observations.length - 1];
    expect(latest?.reactionCount).toBe(9);
    expect(memory.observations[0]?.reactionCount).toBe(2);
    expect(
      notePerformanceStatus({
        missingFromIndex: false,
        reactionCount: 0,
        replyCount: 0,
        repostCount: 0,
        zapCount: 0,
        zapMsats: 0n,
      })
    ).toBe("zero");
  });

  it("keeps history after the subscription lapses", async () => {
    const memory: Memory = {
      active: new Set(["paid"]),
      pubkeys: new Map([["paid", PUBKEY]]),
      posts: new Map(),
      syncs: new Map(),
      tracked: new Map(),
      observations: [],
      clock: 0,
    };
    const directory = createDirectory(memory);
    await runPostAnalyticsSweep(
      createClient([{ events: [event(EVENT_A)], nextCursor: null }]),
      directory,
      { batchSize: 10, concurrency: 1 }
    );
    memory.active.delete("paid");
    const client = createClient([
      { events: [event(EVENT_B)], nextCursor: null },
    ]);
    const result = await runPostAnalyticsSweep(client, directory, {
      batchSize: 10,
      concurrency: 1,
    });

    expect(result.activeUsers).toBe(0);
    expect(client.listAuthorPage).not.toHaveBeenCalled();
    expect(memory.observations).toHaveLength(1);
    expect(memory.tracked.size).toBe(1);
  });

  it("continues a notes walk with the saved cursor", async () => {
    const memory: Memory = {
      active: new Set(["paid"]),
      pubkeys: new Map([["paid", PUBKEY]]),
      posts: new Map(),
      syncs: new Map(),
      tracked: new Map(),
      observations: [],
      clock: 0,
    };
    const directory = createDirectory(memory);
    const first = createClient([
      { events: [event(EVENT_A)], nextCursor: "cursor-1" },
    ]);
    await runPostAnalyticsSweep(first, directory, {
      batchSize: 4,
      concurrency: 1,
    });
    const second = createClient([
      { events: [event(EVENT_B)], nextCursor: null },
    ]);
    await runPostAnalyticsSweep(second, directory, {
      batchSize: 4,
      concurrency: 1,
    });

    expect(second.listAuthorPage).toHaveBeenCalledWith(
      PUBKEY,
      "notes",
      "cursor-1"
    );
    expect(memory.tracked.size).toBe(2);
  });
});

describe("pickDiscovery", () => {
  it("refreshes the stalest finished stream from the first page", () => {
    expect(
      pickDiscovery({
        notes: { nextCursor: null, backfillComplete: true, updatedAt: 5 },
        replies: { nextCursor: null, backfillComplete: true, updatedAt: 1 },
        longform: { nextCursor: null, backfillComplete: true, updatedAt: 4 },
      })
    ).toEqual({ stream: "replies", cursor: null, refresh: true });
  });
});
