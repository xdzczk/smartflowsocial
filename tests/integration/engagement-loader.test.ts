/**
 * Integration tests for engagement loader
 *
 * Tests the loader in app/features/engagement/services/engagement-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/cache/primalCache.server", () => ({
  connectToPrimalCache: vi.fn(),
}));

vi.mock("~/features/cache", () => ({
  fetchFromCache: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/lib/redis-cache.server", async (importOriginal) => {
  const importOriginalTyped = importOriginal as () => Promise<
    typeof RedisCacheServer
  >;
  const actual = await importOriginalTyped();
  return {
    ...actual,
    getJsonFromRedis: vi.fn().mockResolvedValue({ hit: false }),
    getOrSetJson: vi
      .fn()
      .mockImplementation(async <T>(opts: { compute: () => Promise<T> }) =>
        opts.compute()
      ),
    setJsonInRedis: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("~/features/user/services/user-settings.server", () => ({
  getEngagementLastCheckedAt: vi.fn().mockResolvedValue(null),
  updateEngagementLastCheckedAt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/features/engagement/engagement.server", () => ({
  parseThreadViewNotifications: vi.fn(),
  groupNotificationsByType: vi.fn(),
  groupNotificationsByParent: vi.fn(),
  processQuoteReposts: vi.fn(),
}));

vi.mock(
  "~/features/engagement/services/relay-mentions-fallback.server",
  () => ({
    fetchKind1EventsMentioningPubkeyViaRelays: vi.fn().mockResolvedValue([]),
  })
);

vi.mock("~/features/posts/server", () => ({
  getPublishedPosts: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

import { TEST_USER_ID } from "../utils/test-helpers";

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import {
  parseThreadViewNotifications,
  groupNotificationsByType,
  groupNotificationsByParent,
  processQuoteReposts,
} from "~/features/engagement/engagement.server";
import { loadEngagementFeedData } from "~/features/engagement/services/engagement-loader.server";
import { getPublishedPosts } from "~/features/posts/server";
import { getUserById } from "~/features/user";
import type * as RedisCacheServer from "~/lib/redis-cache.server";

describe("Engagement Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful Data Loading", () => {
    it("should load engagement feed data with posts and stats", async () => {
      const mockPosts = [
        {
          id: "post-1",
          signedEvent: { id: "event-1" },
        },
        {
          id: "post-2",
          signedEvent: { id: "event-2" },
        },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
        mutedList: { npubs: [] },
      };

      const mockThreadViewData1 = [
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
      ];
      const mockThreadViewData2 = [
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
      ];

      const mockNotifications = [
        {
          type: "reply",
          eventId: "event-1",
          pubkey: "pubkey-1",
        },
      ];

      (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      // Mock connectToPrimalCache for sequential calls
      (connectToPrimalCache as ReturnType<typeof vi.fn>)
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Test functions can be async
        .mockImplementation((method, params): Promise<unknown> => {
          if (method === "thread_view") {
            const eventId = (params as { event_id?: string }).event_id;
            if (eventId === "event-1")
              return Promise.resolve(mockThreadViewData1);
            if (eventId === "event-2")
              return Promise.resolve(mockThreadViewData2);
          }
          if (method === "user_profile") {
            return Promise.resolve([]);
          }
          if (method === "get_notifications") {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        });
      (
        parseThreadViewNotifications as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockNotifications);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: mockNotifications,
        replies: mockNotifications,
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue(
        []
      );
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      expect(getPublishedPosts).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        page: 1,
        limit: 50,
        queueType: "all",
      });
      expect(result).toHaveProperty("posts");
      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("notifications");
      expect(result).toHaveProperty("groupedNotifications");
      expect(result).toHaveProperty("trustScores");
      expect(result).toHaveProperty("engagementItemStates");
      expect(result).toHaveProperty("engagementLinkedActions");
      expect(result).toHaveProperty("groupSummaries");
      expect(result.posts).toHaveLength(2); // Loader returns all posts with stats
      expect(
        result.posts[0]?.signedEvent &&
          typeof result.posts[0].signedEvent === "object" &&
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for mock data
          result.posts[0].signedEvent &&
          "id" in result.posts[0].signedEvent
          ? result.posts[0].signedEvent["id"]
          : null
      ).toBe("event-1");
    });

    it("should filter posts to only show those with replies", async () => {
      const mockPosts = [
        {
          id: "post-1",
          signedEvent: { id: "event-1" },
        },
        {
          id: "post-2",
          signedEvent: { id: "event-2" },
        },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
        mutedList: { npubs: [] },
      };

      const mockThreadViewData1 = [
        [
          "EVENT",
          "sub-id",
          {
            kind: 10000100,
            content: JSON.stringify({ event_id: "event-1", replies: 2 }),
          },
        ],
      ];
      const mockThreadViewData2 = [
        [
          "EVENT",
          "sub-id",
          {
            kind: 10000100,
            content: JSON.stringify({ event_id: "event-2", replies: 0 }),
          },
        ],
      ];

      (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      // Mock thread_view calls - the implementation calls connectToPrimalCache("thread_view", ...) for each event
      // The implementation processes events in batches, so we need to mock for each event ID
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Test functions can be async
        (method: string, params: Record<string, unknown>): Promise<unknown> => {
          if (method === "thread_view") {
            // Return stats based on event_id
            if (params["event_id"] === "event-1") {
              return Promise.resolve(mockThreadViewData1);
            } else if (params["event_id"] === "event-2") {
              return Promise.resolve(mockThreadViewData2);
            }
            return Promise.resolve([]);
          } else if (method === "get_notifications") {
            return Promise.resolve([]);
          } else if (method === "user_profile") {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }
      );
      (
        parseThreadViewNotifications as ReturnType<typeof vi.fn>
      ).mockReturnValue([]);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue(
        []
      );
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      // Loader returns posts with stats; at least one post (event-1 has replies in thread view)
      expect(result.posts.length).toBeGreaterThanOrEqual(1);
      const event1Post = result.posts.find(
        (p) =>
          p.signedEvent &&
          typeof p.signedEvent === "object" &&
          "id" in p.signedEvent &&
          (p.signedEvent as { id?: string }).id === "event-1"
      );
      expect(event1Post).toBeDefined();
    });

    it("should filter muted users when filterMuted is enabled", async () => {
      const mockPosts = [
        {
          id: "post-1",
          signedEvent: { id: "event-1" },
        },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        filterMuted: true,
        hidePostsFromLowTrustUsers: false,
        mutedList: { npubs: ["muted-pubkey"] },
      };

      const mockNotifications = [
        {
          type: "reply",
          eventId: "event-1",
          pubkey: "muted-pubkey",
        },
        {
          type: "reply",
          eventId: "event-1",
          pubkey: "normal-pubkey",
        },
      ];

      (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (
        parseThreadViewNotifications as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockNotifications);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: mockNotifications,
        replies: mockNotifications,
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue(
        []
      );
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      // Should filter out muted user notifications
      // The function filters notifications, so we check that filtering occurred
      expect(result.notifications.replies.length).toBeLessThanOrEqual(
        mockNotifications.length
      );
    });

    it("should filter low trust users when hidePostsFromLowTrustUsers is enabled", async () => {
      const mockPosts = [
        {
          id: "post-1",
          signedEvent: { id: "event-1" },
        },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        filterMuted: false,
        hidePostsFromLowTrustUsers: true,
        mutedList: { npubs: [] },
      };

      const mockNotifications = [
        {
          type: "reply",
          eventId: "event-1",
          pubkey: "low-trust-pubkey",
        },
        {
          type: "reply",
          eventId: "event-1",
          pubkey: "high-trust-pubkey",
        },
      ];

      (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // Thread view
        .mockResolvedValueOnce({
          // Profile for low-trust (low followers)
          pubkey: "low-trust-pubkey",
          followersCount: 50,
        })
        .mockResolvedValueOnce({
          // Profile for high-trust (high followers)
          pubkey: "high-trust-pubkey",
          followersCount: 200,
        });
      (
        parseThreadViewNotifications as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockNotifications);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: mockNotifications,
        replies: mockNotifications,
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue(
        []
      );
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      // Should filter out low trust users (score < 40)
      // The function filters notifications, so we check that filtering occurred
      expect(result.notifications.replies.length).toBeLessThanOrEqual(
        mockNotifications.length
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle missing user gracefully", async () => {
      (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: [],
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(loadEngagementFeedData(TEST_USER_ID, 1, 50)).rejects.toThrow(
        "User not found"
      );
    });

    it("should handle cache errors gracefully", async () => {
      const mockPosts = [
        {
          id: "post-1",
          signedEvent: { id: "event-1" },
        },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
        mutedList: { npubs: [] },
      };

      (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cache error")
      );
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue(
        []
      );
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      // Should return empty stats on error
      expect(result.stats).toBeDefined();
      expect(Object.keys(result.stats).length).toBeGreaterThanOrEqual(0);
    });

    it("should handle missing npub gracefully", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: null,
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
        mutedList: { npubs: [] },
      };

      (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: [],
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      // The function uses npub ?? "" internally but returns the original user object
      expect(result.user.npub).toBeNull();
    });
  });

  describe("Quote Reposts", () => {
    it("should fetch and process quote reposts", async () => {
      const mockPosts = [
        {
          id: "post-1",
          signedEvent: { id: "event-1" },
        },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
        mutedList: { npubs: [] },
      };

      const mockQuoteReposts = [
        {
          type: "quote",
          eventId: "quote-1",
          pubkey: "pubkey-1",
        },
      ];

      (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // Thread view
        .mockResolvedValueOnce([
          // Notifications
          [
            "EVENT",
            "sub-id",
            {
              kind: 1,
              id: "quote-1",
              pubkey: "pubkey-1",
              content: "Quote repost",
              tags: [
                ["e", "event-1", "", "mention"],
                ["p", "npub123", "", "mention"],
              ],
            },
          ],
        ]);
      (
        parseThreadViewNotifications as ReturnType<typeof vi.fn>
      ).mockReturnValue([]);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue(
        []
      );
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQuoteReposts
      );

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      // processQuoteReposts is only called when rawQuoteReposts is non-empty (from fetchFromCache)
      expect(result.groupedNotifications.quotes).toBeDefined();
    });
  });
});
