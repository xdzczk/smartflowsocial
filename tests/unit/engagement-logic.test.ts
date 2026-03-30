/**
 * Unit tests for engagement grouping and filtering logic
 * Tests real exported functions from:
 * - app/features/engagement/engagement.server.ts
 * - app/features/engagement/trustScore.ts
 *
 * Migrated from tests/e2e/unit/engagement-logic.cy.ts
 */

import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma to prevent database connection attempts
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

import {
  doesEventMentionUser,
  groupNotificationsByType,
  inferThreadRootEventIdFromTags,
  isStructuredThreadReplyKind1,
  parseThreadViewNotifications,
  shouldExcludeKind1FromGlobalMentionInbox,
  type Notification,
} from "~/features/engagement/engagement.server";
import {
  calculateTrustScore,
  getTrustLevel,
  getTrustScoreBadgeColor,
  getAccountAgeInDays,
  type User,
} from "~/features/engagement/trust-score";

describe("Engagement Logic Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("groupNotificationsByType", () => {
    it("should correctly categorize reply notifications", () => {
      const notifications = [
        {
          type: "reply",
          id: "1",
          content: "reply content",
          eventId: "e1",
          createdAt: 1000,
          pubkey: "p1",
          originalEventId: "o1",
        },
        {
          type: "mention",
          id: "2",
          content: "mention content",
          eventId: "e2",
          createdAt: 1000,
          pubkey: "p2",
          originalEventId: "o1",
        },
        {
          type: "zap",
          id: "3",
          content: "",
          eventId: "e3",
          createdAt: 1000,
          senderPubkey: "p3",
          receiverPubkey: "p4",
          amountSats: 100,
          originalEventId: "o1",
        },
      ] as Notification[];

      const grouped = groupNotificationsByType(notifications);

      expect(grouped.all.length).toBe(3);
      expect(grouped.replies.length).toBe(1);
      expect(grouped.replies[0]?.["id"]).toBe("1");
    });

    it("should correctly categorize mention notifications", () => {
      const notifications = [
        {
          type: "mention",
          id: "1",
          content: "tagged you",
          eventId: "e1",
          createdAt: 1000,
          pubkey: "p1",
          originalEventId: "o1",
        },
        {
          type: "mention",
          id: "2",
          content: "also tagged you",
          eventId: "e2",
          createdAt: 1000,
          pubkey: "p2",
          originalEventId: "o1",
        },
      ] as Notification[];

      const grouped = groupNotificationsByType(notifications);

      expect(grouped.mentions.length).toBe(2);
    });

    it("should correctly categorize zap notifications", () => {
      const notifications = [
        {
          type: "zap",
          id: "1",
          content: "",
          eventId: "e1",
          createdAt: 1000,
          senderPubkey: "abc123",
          receiverPubkey: "p1",
          amountSats: 1000,
          originalEventId: "o1",
        },
        {
          type: "zap",
          id: "2",
          content: "",
          eventId: "e2",
          createdAt: 1000,
          senderPubkey: "def456",
          receiverPubkey: "p1",
          amountSats: 5000,
          originalEventId: "o1",
        },
      ] as Notification[];

      const grouped = groupNotificationsByType(notifications);

      expect(grouped.zaps.length).toBe(2);
    });

    it("should correctly categorize quote reposts", () => {
      const notifications = [
        {
          type: "quote",
          id: "1",
          content: "quoted your post",
          eventId: "e1",
          createdAt: 1000,
          pubkey: "p1",
          originalEventId: "o1",
        },
      ] as Notification[];

      const grouped = groupNotificationsByType(notifications);

      expect(grouped.quotes.length).toBe(1);
    });

    it("should handle empty notifications array", () => {
      const notifications: Notification[] = [];

      const grouped = groupNotificationsByType(notifications);

      expect(grouped.all.length).toBe(0);
      expect(grouped.replies.length).toBe(0);
      expect(grouped.mentions.length).toBe(0);
      expect(grouped.zaps.length).toBe(0);
      expect(grouped.quotes.length).toBe(0);
    });
  });

  describe("inferThreadRootEventIdFromTags", () => {
    it("prefers e-tag with root marker", () => {
      const root = "a".repeat(64);
      const reply = "b".repeat(64);
      expect(
        inferThreadRootEventIdFromTags(
          [
            ["e", root, "", "root"],
            ["e", reply, "", "reply"],
          ],
          "c".repeat(64)
        )
      ).toBe(root);
    });

    it("falls back to first e-tag", () => {
      const first = "d".repeat(64);
      expect(
        inferThreadRootEventIdFromTags(
          [["e", first, "wss://x"]],
          "e".repeat(64)
        )
      ).toBe(first);
    });

    it("prefers first e-tag over reply when root marker is absent (NIP-10 order)", () => {
      const threadRoot = "1".repeat(64);
      const immediateParent = "2".repeat(64);
      expect(
        inferThreadRootEventIdFromTags(
          [
            ["e", threadRoot, ""],
            ["e", immediateParent, "", "reply"],
          ],
          "3".repeat(64)
        )
      ).toBe(threadRoot);
    });

    it("uses second e-tag as root when both tags are unmarked (NIP-10 reply-then-root)", () => {
      const immediateParent = "2".repeat(64);
      const threadRoot = "1".repeat(64);
      expect(
        inferThreadRootEventIdFromTags(
          [
            ["e", immediateParent, ""],
            ["e", threadRoot, ""],
          ],
          "3".repeat(64)
        )
      ).toBe(threadRoot);
    });

    it("falls back to note id when no e-tags", () => {
      const id = "f".repeat(64);
      expect(inferThreadRootEventIdFromTags([], id)).toBe(id);
    });
  });

  describe("global mention inbox exclusion (thread replies vs real mentions)", () => {
    it("treats NIP-10 reply as structured thread reply", () => {
      expect(
        isStructuredThreadReplyKind1([
          ["e", "a".repeat(64), "", "reply"],
          ["p", "b".repeat(64)],
        ])
      ).toBe(true);
    });

    it("does not treat quote (mention marker) as structured thread reply", () => {
      expect(
        isStructuredThreadReplyKind1([["e", "a".repeat(64), "", "mention"]])
      ).toBe(false);
    });

    it("excludes thread reply even when #p matches the parent author", () => {
      const myPost = "c".repeat(64);
      const published = new Set([myPost]);
      expect(
        shouldExcludeKind1FromGlobalMentionInbox(
          [
            ["e", myPost, "", "reply"],
            ["p", "d".repeat(64)],
          ],
          published
        )
      ).toBe(true);
    });

    it("keeps standalone @mention with no thread e-tags", () => {
      expect(
        shouldExcludeKind1FromGlobalMentionInbox(
          [["p", "e".repeat(64)]],
          new Set(["f".repeat(64)])
        )
      ).toBe(false);
    });
  });

  describe("doesEventMentionUser", () => {
    it("detects p tag hex match", () => {
      const me = "ab".repeat(32);
      expect(doesEventMentionUser("hi", [["p", me, "wss://r"]], me)).toBe(true);
    });

    it("returns false when no p tag or nip-27 ref", () => {
      expect(doesEventMentionUser("hello world", [], "ab".repeat(32))).toBe(
        false
      );
    });
  });

  describe("parseThreadViewNotifications (NIP-27 mentions)", () => {
    it("detects nostr:npub in content without p tag as mention", () => {
      const mySk = generateSecretKey();
      const me = getPublicKey(mySk);
      const otherSk = generateSecretKey();
      const other = getPublicKey(otherSk);
      const npub = nip19.npubEncode(me);

      const parentEventId = "a".repeat(64);
      const noteId = "b".repeat(64);

      const thread = [
        [
          "EVENT",
          "",
          {
            kind: 1,
            id: noteId,
            pubkey: other,
            content: `hello nostr:${npub} check this`,
            tags: [],
            created_at: 100,
          },
        ],
      ];

      const notifications = parseThreadViewNotifications(
        thread,
        parentEventId,
        me
      );
      const mentions = notifications.filter((n) => n.type === "mention");

      expect(mentions.length).toBe(1);
      expect(mentions[0]?.eventId).toBe(noteId);
      expect(mentions[0]?.originalEventId).toBe(parentEventId);
    });

    it("classifies reply with embedded parent note and empty e-tag marker as reply, not mention", () => {
      const otherSk = generateSecretKey();
      const other = getPublicKey(otherSk);
      const mySk = generateSecretKey();
      const me = getPublicKey(mySk);

      const parentEventId = "ab".repeat(32);
      const replyNoteId = "cd".repeat(32);
      const noteRef = nip19.noteEncode(parentEventId);

      const thread = [
        [
          "EVENT",
          "",
          {
            kind: 1,
            id: replyNoteId,
            pubkey: other,
            content: `Keep on nostr:${noteRef}`,
            tags: [["e", parentEventId, "wss://relay.example.com"]],
            created_at: 100,
          },
        ],
      ];

      const notifications = parseThreadViewNotifications(
        thread,
        parentEventId,
        me
      );
      const replies = notifications.filter((n) => n.type === "reply");
      const mentions = notifications.filter((n) => n.type === "mention");

      expect(replies.length).toBe(1);
      expect(replies[0]?.eventId).toBe(replyNoteId);
      expect(mentions.length).toBe(0);
    });

    it("classifies e-tag marker mention + nostr ref as mention (quote)", () => {
      const otherSk = generateSecretKey();
      const other = getPublicKey(otherSk);
      const mySk = generateSecretKey();
      const me = getPublicKey(mySk);

      const parentEventId = "ef".repeat(32);
      const quoteNoteId = "12".repeat(32);
      const noteRef = nip19.noteEncode(parentEventId);

      const thread = [
        [
          "EVENT",
          "",
          {
            kind: 1,
            id: quoteNoteId,
            pubkey: other,
            content: `Quoted nostr:${noteRef}`,
            tags: [["e", parentEventId, "wss://relay.example.com", "mention"]],
            created_at: 100,
          },
        ],
      ];

      const notifications = parseThreadViewNotifications(
        thread,
        parentEventId,
        me
      );
      const mentions = notifications.filter((n) => n.type === "mention");

      expect(mentions.length).toBe(1);
      expect(mentions[0]?.eventId).toBe(quoteNoteId);
    });
  });

  describe("calculateTrustScore", () => {
    it("should return 0 for minimal user profile", () => {
      const minimalUser: User = {
        pubkey: "test-pubkey-1",
        name: "",
        displayName: "",
        about: "",
        picture: "",
        nip05: "",
        timeJoined: 0,
        followersCount: 0,
        followsCount: 0,
        noteCount: 0,
        replyCount: 0,
        lud16: "",
        zapCount: 0,
        totalSatsZapped: 0,
        mediaCount: 0,
      };

      const score = calculateTrustScore(minimalUser);

      expect(score).toBe(0);
    });

    it("should increase score with profile completeness", () => {
      const user: User = {
        pubkey: "test-pubkey-2",
        name: "TestUser",
        displayName: "Test User",
        about:
          "This is a meaningful about section with more than 20 characters",
        picture: "https://example.com/pic.jpg",
        nip05: "test@example.com",
        timeJoined: 0,
        followersCount: 0,
        followsCount: 0,
        noteCount: 0,
        replyCount: 0,
        lud16: "",
        zapCount: 0,
        totalSatsZapped: 0,
        mediaCount: 0,
      };

      const score = calculateTrustScore(user);

      // With full profile but no other engagement, score should be 25% (profile portion only)
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(30); // Profile completeness portion
    });

    it("should give higher score for older accounts", () => {
      // Create user with account that's 400 days old
      const now = Math.floor(Date.now() / 1000);
      const fourHundredDaysAgo = now - 400 * 24 * 60 * 60;

      const newUser: User = {
        pubkey: "new-user-pubkey",
        name: "NewUser",
        displayName: "New User",
        about: "",
        picture: "",
        nip05: "",
        timeJoined: now, // Just created
        followersCount: 0,
        followsCount: 0,
        noteCount: 0,
        replyCount: 0,
        lud16: "",
        zapCount: 0,
        totalSatsZapped: 0,
        mediaCount: 0,
      };

      const oldUser: User = {
        pubkey: "old-user-pubkey",
        name: "OldUser",
        displayName: "Old User",
        about: "",
        picture: "",
        nip05: "",
        timeJoined: fourHundredDaysAgo,
        followersCount: 0,
        followsCount: 0,
        noteCount: 0,
        replyCount: 0,
        lud16: "",
        zapCount: 0,
        totalSatsZapped: 0,
        mediaCount: 0,
      };

      const newScore = calculateTrustScore(newUser);
      const oldScore = calculateTrustScore(oldUser);

      expect(oldScore).toBeGreaterThan(newScore);
    });

    it("should calculate account age in days correctly", () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const timeJoined = Math.floor(thirtyDaysAgo.getTime() / 1000);

      const accountAge = getAccountAgeInDays(timeJoined);

      expect(accountAge).toBeCloseTo(30, 0);
    });

    it("should return 0 for timeJoined of 0", () => {
      const accountAge = getAccountAgeInDays(0);

      expect(accountAge).toBe(0);
    });
  });

  describe("getTrustLevel", () => {
    it("should return 'Highly Trusted' for scores >= 80", () => {
      const testScores = [80, 85, 90, 95, 100];

      testScores.forEach((score) => {
        const result = getTrustLevel(score);
        expect(result.level).toBe("Highly Trusted");
      });
    });

    it("should return 'Trusted' for scores 60-79", () => {
      const testScores = [60, 65, 70, 75, 79];

      testScores.forEach((score) => {
        const result = getTrustLevel(score);
        expect(result.level).toBe("Trusted");
      });
    });

    it("should return 'Developing' for scores 40-59", () => {
      const testScores = [40, 45, 50, 55, 59];

      testScores.forEach((score) => {
        const result = getTrustLevel(score);
        expect(result.level).toBe("Developing");
      });
    });

    it("should return 'New' for scores 20-39", () => {
      const testScores = [20, 25, 30, 35, 39];

      testScores.forEach((score) => {
        const result = getTrustLevel(score);
        expect(result.level).toBe("New");
      });
    });

    it("should return 'Unverified' for scores < 20", () => {
      const testScores = [0, 5, 10, 15, 19];

      testScores.forEach((score) => {
        const result = getTrustLevel(score);
        expect(result.level).toBe("Unverified");
      });
    });
  });

  describe("getTrustScoreBadgeColor", () => {
    it("should return success classes for scores >= 80", () => {
      expect(getTrustScoreBadgeColor(80)).toContain("success");
      expect(getTrustScoreBadgeColor(100)).toContain("success");
    });

    it("should return muted/foreground classes for scores 60-79", () => {
      expect(getTrustScoreBadgeColor(60)).toContain("muted");
      expect(getTrustScoreBadgeColor(79)).toContain("muted");
    });

    it("should return yellow classes for scores 40-59", () => {
      expect(getTrustScoreBadgeColor(40)).toContain("yellow");
      expect(getTrustScoreBadgeColor(59)).toContain("yellow");
    });

    it("should return muted classes for scores 20-39", () => {
      expect(getTrustScoreBadgeColor(20)).toContain("muted");
      expect(getTrustScoreBadgeColor(39)).toContain("muted");
    });

    it("should return gray classes for scores < 20", () => {
      expect(getTrustScoreBadgeColor(0)).toContain("gray");
      expect(getTrustScoreBadgeColor(19)).toContain("gray");
    });
  });
});
