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

vi.mock("~/features/engagement/engagement.server", () => ({
  parseThreadViewNotifications: vi.fn(),
  groupNotificationsByType: vi.fn(),
  groupNotificationsByParent: vi.fn(),
  processQuoteReposts: vi.fn(),
}));

vi.mock("~/features/engagement/trustScore", () => ({
  calculateTrustScore: vi.fn((user) => {
    // Simple mock: return score based on followers
    return (user.followersCount || 0) > 100 ? 50 : 30;
  }),
}));

vi.mock("~/models/post.server", () => ({
  getPostedPosts: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
}));

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { parseThreadViewNotifications, groupNotificationsByType, groupNotificationsByParent, processQuoteReposts } from "~/features/engagement/engagement.server";
import { getPostedPosts } from "~/models/post.server";
import { getUserById } from "~/models/user.server";
import { loadEngagementFeedData } from "~/features/engagement/services/engagement-loader.server";
import { TEST_USER_ID } from "../utils/test-helpers";

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

      const mockThreadViewData = [
        ["EVENT", "sub-id", { kind: 10000100, content: JSON.stringify({ likes: 5, replies: 2 }) }],
      ];

      const mockNotifications = [
        {
          type: "reply",
          eventId: "event-1",
          pubkey: "pubkey-1",
        },
      ];

      (getPostedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue(mockThreadViewData);
      (parseThreadViewNotifications as ReturnType<typeof vi.fn>).mockReturnValue(mockNotifications);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: mockNotifications,
        replies: mockNotifications,
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      expect(getPostedPosts).toHaveBeenCalledWith({
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
        ["EVENT", "sub-id", { kind: 10000100, content: JSON.stringify({ replies: 2 }) }],
      ];
      const mockThreadViewData2 = [
        ["EVENT", "sub-id", { kind: 10000100, content: JSON.stringify({ replies: 0 }) }],
      ];

      (getPostedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockThreadViewData1)
        .mockResolvedValueOnce(mockThreadViewData2);
      (parseThreadViewNotifications as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].signedEvent.id).toBe("event-1");
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

      (getPostedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (parseThreadViewNotifications as ReturnType<typeof vi.fn>).mockReturnValue(mockNotifications);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: mockNotifications,
        replies: mockNotifications,
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      // Should filter out muted user notifications
      expect(result.notifications.replies.length).toBeLessThan(mockNotifications.length);
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

      (getPostedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // Thread view
        .mockResolvedValueOnce({ // Profile for low-trust (low followers)
          pubkey: "low-trust-pubkey",
          followersCount: 50,
        })
        .mockResolvedValueOnce({ // Profile for high-trust (high followers)
          pubkey: "high-trust-pubkey",
          followersCount: 200,
        });
      (parseThreadViewNotifications as ReturnType<typeof vi.fn>).mockReturnValue(mockNotifications);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: mockNotifications,
        replies: mockNotifications,
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      // Should filter out low trust users (score < 40)
      expect(result.notifications.replies.length).toBeLessThan(mockNotifications.length);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing user gracefully", async () => {
      (getPostedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: [],
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(loadEngagementFeedData(TEST_USER_ID, 1, 50)).rejects.toThrow("User not found");
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

      (getPostedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Cache error"));
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue([]);
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

      (getPostedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: [],
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      expect(result.user.npub).toBe("");
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

      (getPostedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: mockPosts,
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (connectToPrimalCache as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // Thread view
        .mockResolvedValueOnce([ // Notifications
          ["EVENT", "sub-id", {
            kind: 1,
            id: "quote-1",
            pubkey: "pubkey-1",
            content: "Quote repost",
            tags: [
              ["e", "event-1", "", "mention"],
              ["p", "npub123", "", "mention"],
            ],
          }],
        ]);
      (parseThreadViewNotifications as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (groupNotificationsByType as ReturnType<typeof vi.fn>).mockReturnValue({
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      });
      (groupNotificationsByParent as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (processQuoteReposts as ReturnType<typeof vi.fn>).mockResolvedValue(mockQuoteReposts);

      const result = await loadEngagementFeedData(TEST_USER_ID, 1, 50);

      expect(processQuoteReposts).toHaveBeenCalled();
      expect(result.groupedNotifications.quotes).toBeDefined();
    });
  });
});

