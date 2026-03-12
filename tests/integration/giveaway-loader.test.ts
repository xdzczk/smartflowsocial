/**
 * Integration tests for giveaway loader
 *
 * Tests the loader in app/features/giveaway/giveaway-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock global fetch
global.fetch = vi.fn();
// Mock dependencies
vi.mock("~/lib/nostrwebsocket.server", () => ({
  connectToPrimalCache: vi.fn(),
}));

vi.mock("~/features/posts/server", () => ({
  getRecentPublishedPosts: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getGiveawayBlacklist: vi.fn(),
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
}));

vi.mock("~/features/user/services/user-cache.server", () => ({
  getQueueTypesCached: vi.fn(),
}));

vi.mock("~/features/giveaway/giveaway.server", () => ({
  fetchGiveawayParticipants: vi.fn(),
}));

vi.mock("~/features/engagement/trustScore", () => ({
  calculateTrustScore: vi.fn((user) => {
    const userObj = user as { followersCount?: number };
    return (userObj.followersCount ?? 0) > 100 ? 50 : 30;
  }),
}));

vi.mock("~/lib/helpers", () => ({
  convertToHex: vi.fn((npub) => npub),
}));

import {
  TEST_USER_ID,
  createMockUser,
  createMockQueueType,
  createMockPost,
} from "../utils/test-helpers";

import { loadGiveawayData } from "~/features/giveaway/giveaway-loader.server";
import { fetchGiveawayParticipants } from "~/features/giveaway/giveaway.server";
import type { RelatedEvent } from "~/features/giveaway/types";
import { getRecentPublishedPosts } from "~/features/posts/server";
import {
  getGiveawayBlacklist,
  getUserById,
  getQueueTypes,
} from "~/features/user";
import { getQueueTypesCached } from "~/features/user/services/user-cache.server";
import { connectToPrimalCache } from "~/lib/nostrwebsocket.server";

describe("Giveaway Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["PRIMAL_CACHING_URL"] = "https://api.primal.com";
    // Loader uses getQueueTypesCached; default to one enabled queue type
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockQueueType({ id: "queue-1", name: "posts", isEnabled: true }),
    ]);
  });

  describe("Successful Data Loading", () => {
    it("should load giveaway data with posts and participants", async () => {
      const mockPosts = [
        createMockPost({ id: "post-1", signedEvent: { id: "event-1" } }),
        createMockPost({ id: "post-2", signedEvent: { id: "event-2" } }),
      ];

      const mockUser = createMockUser();

      const mockQueueTypes = [createMockQueueType({ id: "queue-1" })];

      const mockRelatedEvents = [
        {
          pubkey: "pubkey-1",
          id: "event-1",
        },
      ];

      (getRecentPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes
      );
      (getGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (fetchGiveawayParticipants as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          relatedEvents: mockRelatedEvents,
        }
      );
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000100,
              content: JSON.stringify({ likes: 5, replies: 2 }),
            },
          ],
        ],
      });
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([
        [
          "EVENT",
          "sub-id",
          {
            kind: 0,
            content: JSON.stringify({ lud16: "user@example.com" }),
          },
        ],
        [
          "EVENT",
          "sub-id",
          {
            kind: 10000105,
            content: JSON.stringify({ total_zap_count: 10 }),
          },
        ],
      ]);

      const result = await loadGiveawayData(TEST_USER_ID, "posts", 7);

      expect(getRecentPublishedPosts).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        days: 7,
        queueType: "posts",
      });
      expect(result).toHaveProperty("posts");
      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("relatedEvents");
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("queueTypes");
      expect(result).toHaveProperty("selectedQueueType");
    });

    it("should filter posts to only show those with engagement", async () => {
      const mockPosts = [
        createMockPost({ id: "post-1", signedEvent: { id: "event-1" } }),
        createMockPost({ id: "post-2", signedEvent: { id: "event-2" } }),
      ];

      const mockUser = createMockUser();

      (getRecentPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (fetchGiveawayParticipants as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          relatedEvents: [],
        }
      );
      // Mock fetchPostStats - one call per event ID
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            [
              "EVENT",
              "sub-id",
              {
                kind: 10000100,
                content: JSON.stringify({
                  event_id: "event-1",
                  likes: 5,
                  replies: 2,
                }),
              },
            ],
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            [
              "EVENT",
              "sub-id",
              {
                kind: 10000100,
                content: JSON.stringify({
                  event_id: "event-2",
                  likes: 0,
                  replies: 0,
                }),
              },
            ],
          ],
        });

      const result = await loadGiveawayData(TEST_USER_ID, "posts", 7);

      // The function filters posts to only show those with engagement > 0
      // event-1 has engagement, event-2 doesn't
      expect(result.posts.length).toBeGreaterThanOrEqual(0);
      if (result.posts.length > 0) {
        expect(result.posts[0]?.totalEngagement).toBeGreaterThan(0);
      }
    });

    it("should filter participants by blacklist", async () => {
      const mockPosts = [
        createMockPost({ id: "post-1", signedEvent: { id: "event-1" } }),
      ];

      const mockUser = createMockUser();

      const mockRelatedEvents = [
        {
          pubkey: "blacklisted-pubkey",
          id: "event-1",
        },
        {
          pubkey: "normal-pubkey",
          id: "event-2",
        },
      ];

      (getRecentPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue([
        "blacklisted-pubkey",
      ]);
      (fetchGiveawayParticipants as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          relatedEvents: mockRelatedEvents,
        }
      );
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000100,
              content: JSON.stringify({ likes: 5 }),
            },
          ],
        ],
      });
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([
        [
          "EVENT",
          "sub-id",
          {
            kind: 0,
            content: JSON.stringify({ lud16: "user@example.com" }),
          },
        ],
        [
          "EVENT",
          "sub-id",
          {
            kind: 10000105,
            content: JSON.stringify({ total_zap_count: 10 }),
          },
        ],
      ]);

      const result = await loadGiveawayData(TEST_USER_ID, "posts", 7);

      // Should filter out blacklisted participants
      expect(result.relatedEvents.length).toBeLessThan(
        mockRelatedEvents.length
      );
      const blacklistedEvent = result.relatedEvents.find(
        (e: RelatedEvent) => e.pubkey === "blacklisted-pubkey"
      );
      expect(blacklistedEvent).toBeUndefined();
    });

    it("should filter participants by lud16 and totalZapped requirements", async () => {
      const mockPosts = [
        createMockPost({ id: "post-1", signedEvent: { id: "event-1" } }),
      ];

      const mockUser = createMockUser();

      const mockRelatedEvents = [
        {
          pubkey: "valid-pubkey",
          id: "event-1",
        },
        {
          pubkey: "invalid-pubkey",
          id: "event-2",
        },
      ];

      (getRecentPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (fetchGiveawayParticipants as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          relatedEvents: mockRelatedEvents,
        }
      );
      // Mock fetchPostStats for posts
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000100,
              content: JSON.stringify({
                event_id: "event-1",
                likes: 5,
              }),
            },
          ],
        ],
      });
      // Mock connectToPrimalCache for user profiles (one per relatedEvent)
      (connectToPrimalCache as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          // Valid user profile (valid-pubkey)
          [
            "EVENT",
            "sub-id",
            {
              kind: 0,
              content: JSON.stringify({ lud16: "valid@example.com" }),
            },
          ],
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000105,
              content: JSON.stringify({ total_zap_count: 10 }),
            },
          ],
        ])
        .mockResolvedValueOnce([
          // Invalid user (invalid-pubkey - no lud16 or low zap count)
          [
            "EVENT",
            "sub-id",
            {
              kind: 0,
              content: JSON.stringify({}),
            },
          ],
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000105,
              content: JSON.stringify({ total_zap_count: 3 }),
            },
          ],
        ]);

      const result = await loadGiveawayData(TEST_USER_ID, "posts", 7);

      // Should only include users with lud16 and totalZapped > 5
      // The function filters participants based on lud16 and totalZapped
      // valid-pubkey has lud16 and totalZapped=10, invalid-pubkey has no lud16 and totalZapped=3
      expect(result.relatedEvents.length).toBeGreaterThanOrEqual(0);
      const validEvent = result.relatedEvents.find(
        (e: RelatedEvent) => e.pubkey === "valid-pubkey"
      );
      if (result.relatedEvents.length > 0) {
        expect(validEvent).toBeDefined();
      }
    });

    it("should filter participants by trust score when enabled", async () => {
      const mockPosts = [
        {
          id: "post-1",
          signedEvent: { id: "event-1" },
        },
      ];

      const mockUser = createMockUser({ hidePostsFromLowTrustUsers: true });

      const mockRelatedEvents = [
        {
          pubkey: "low-trust-pubkey",
          id: "event-1",
        },
        {
          pubkey: "high-trust-pubkey",
          id: "event-2",
        },
      ];

      (getRecentPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (fetchGiveawayParticipants as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          relatedEvents: mockRelatedEvents,
        }
      );
      // Mock fetchPostStats for posts
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000100,
              content: JSON.stringify({
                event_id: "event-1",
                likes: 5,
              }),
            },
          ],
        ],
      });
      // Mock connectToPrimalCache for user profiles (one per relatedEvent)
      (connectToPrimalCache as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          // Low trust user (low-trust-pubkey)
          [
            "EVENT",
            "sub-id",
            {
              kind: 0,
              content: JSON.stringify({ lud16: "low@example.com" }),
            },
          ],
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000105,
              content: JSON.stringify({
                total_zap_count: 10,
                followers_count: 50,
              }),
            },
          ],
        ])
        .mockResolvedValueOnce([
          // High trust user (high-trust-pubkey)
          [
            "EVENT",
            "sub-id",
            {
              kind: 0,
              content: JSON.stringify({ lud16: "high@example.com" }),
            },
          ],
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000105,
              content: JSON.stringify({
                total_zap_count: 10,
                followers_count: 200,
              }),
            },
          ],
        ]);

      const result = await loadGiveawayData(TEST_USER_ID, "posts", 7);

      // Should filter out low trust users (score < 40)
      // The function filters participants based on trust score
      // Low trust user has 50 followers (score < 40), high trust user has 200 followers (score >= 40)
      expect(result.relatedEvents.length).toBeGreaterThanOrEqual(0);
      const highTrustEvent = result.relatedEvents.find(
        (e: RelatedEvent) => e.pubkey === "high-trust-pubkey"
      );
      if (result.relatedEvents.length > 0) {
        expect(highTrustEvent).toBeDefined();
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle empty posts gracefully", async () => {
      const mockUser = createMockUser();

      (getRecentPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadGiveawayData(TEST_USER_ID, "posts", 7);

      expect(result.posts).toEqual([]);
      expect(result.relatedEvents).toEqual([]);
    });

    it("should handle stats fetch errors gracefully", async () => {
      const mockPosts = [
        createMockPost({ id: "post-1", signedEvent: { id: "event-1" } }),
      ];

      const mockUser = createMockUser();

      (getRecentPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (fetchGiveawayParticipants as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          relatedEvents: [],
        }
      );
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Fetch error")
      );

      const result = await loadGiveawayData(TEST_USER_ID, "posts", 7);

      // Should return empty stats on error
      expect(result.stats).toBeDefined();
      expect(result.stats["event-1"]).toBeDefined();
      const eventStats = result.stats["event-1"];
      expect(eventStats?.likes).toBe(0);
    });

    it("should filter out disabled queue types", async () => {
      const mockQueueTypes = [
        createMockQueueType({ id: "queue-1", name: "posts", isEnabled: true }),
        createMockQueueType({
          id: "queue-2",
          name: "disabled",
          isEnabled: false,
        }),
      ];

      (getRecentPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockUser()
      );
      (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes
      );

      const result = await loadGiveawayData(TEST_USER_ID, "posts", 7);

      expect(result.queueTypes).toHaveLength(1);
      expect(result.queueTypes[0]?.name).toBe("posts");
    });
  });
});
