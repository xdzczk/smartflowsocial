/**
 * Unit tests for giveaway.server (fetchGiveawayParticipants, zap amount via aggregation).
 * Tests app/features/giveaway/giveaway.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConnectToPrimalCache = vi.fn();

vi.mock("~/features/cache/primalCache.server", () => ({
  connectToPrimalCache: (...args: unknown[]) =>
    mockConnectToPrimalCache(...args),
}));

vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

import { fetchGiveawayParticipants } from "~/features/giveaway/giveaway.server";
import type { PrimalEvent, RelatedEvent } from "~/features/giveaway/types";

function primalEvent(ev: RelatedEvent): PrimalEvent {
  return ["EVENT", "", ev] as PrimalEvent;
}

describe("giveaway-server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchGiveawayParticipants", () => {
    it("throws when no event IDs provided", async () => {
      await expect(fetchGiveawayParticipants([])).rejects.toThrow(
        "At least one event ID is required"
      );
      expect(mockConnectToPrimalCache).not.toHaveBeenCalled();
    });

    it("accepts single event ID string", async () => {
      mockConnectToPrimalCache
        .mockResolvedValueOnce([]) // thread_view
        .mockResolvedValueOnce([]) // event_actions likes
        .mockResolvedValueOnce([]); // event_actions reposts
      const result = await fetchGiveawayParticipants("event-1");
      expect(result.count).toBe(0);
      expect(result.relatedEvents).toEqual([]);
      expect(result.stats).toEqual({
        likes: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
        total: 0,
      });
    });

    it("aggregates likes from event_actions kind 7", async () => {
      const likeEv: RelatedEvent = {
        id: "like-1",
        pubkey: "pk1",
        created_at: 1,
        kind: 7,
      };
      mockConnectToPrimalCache
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([primalEvent(likeEv)])
        .mockResolvedValueOnce([]);
      const result = await fetchGiveawayParticipants("ev1");
      expect(result.relatedEvents).toHaveLength(1);
      expect(result.relatedEvents[0]?.kind).toBe(7);
      expect(result.stats.total).toBe(1);
    });

    it("aggregates reposts from event_actions kind 6", async () => {
      const repostEv: RelatedEvent = {
        id: "repost-1",
        pubkey: "pk1",
        created_at: 1,
        kind: 6,
      };
      mockConnectToPrimalCache
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([primalEvent(repostEv)]);
      const result = await fetchGiveawayParticipants("ev1");
      expect(result.relatedEvents).toHaveLength(1);
      expect(result.relatedEvents[0]?.kind).toBe(6);
    });

    it("aggregates zaps and sats from thread_view kind 9735 with amount tag", async () => {
      const zapEv: RelatedEvent = {
        id: "zap-1",
        pubkey: "pk1",
        created_at: 1,
        kind: 9735,
        tags: [
          [
            "description",
            JSON.stringify({
              tags: [["amount", "5000"]],
            }),
          ],
        ],
      };
      mockConnectToPrimalCache
        .mockResolvedValueOnce([primalEvent(zapEv)])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await fetchGiveawayParticipants("ev1");
      expect(result.relatedEvents).toHaveLength(1);
      expect(result.relatedEvents[0]?.kind).toBe(9735);
      expect(result.stats.satszapped).toBe(5);
    });

    it("returns 0 sats for zap with missing or invalid description tag", async () => {
      const zapNoAmount: RelatedEvent = {
        id: "zap-1",
        pubkey: "pk1",
        created_at: 1,
        kind: 9735,
        tags: [["description", "not-json"]],
      };
      mockConnectToPrimalCache
        .mockResolvedValueOnce([primalEvent(zapNoAmount)])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await fetchGiveawayParticipants("ev1");
      expect(result.stats.satszapped).toBe(0);
    });

    it("aggregates stats from kind 10000100 content", async () => {
      const statsEv: RelatedEvent = {
        id: "stats-1",
        pubkey: "pk1",
        created_at: 1,
        kind: 10000100,
        content: JSON.stringify({
          event_id: "ev1",
          likes: 10,
          reposts: 2,
          zaps: 3,
        }),
      };
      mockConnectToPrimalCache
        .mockResolvedValueOnce([primalEvent(statsEv)])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await fetchGiveawayParticipants("ev1");
      expect(result.stats.likes).toBe(10);
      expect(result.stats.reposts).toBe(2);
      expect(result.stats.zaps).toBe(3);
    });

    it("combines multiple event IDs", async () => {
      mockConnectToPrimalCache
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([]);
      const result = await fetchGiveawayParticipants(["ev1", "ev2"]);
      expect(mockConnectToPrimalCache).toHaveBeenCalled();
      expect(result.relatedEvents).toEqual([]);
      expect(result.count).toBe(0);
    });
  });
});
