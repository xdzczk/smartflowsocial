/**
 * Integration tests for longform post queries
 * Tests app/models/longformpost.server.ts query functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    longFormPost: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock calculateLongFormStatus
vi.mock("~/features/posts", () => ({
  calculateLongFormStatus: vi.fn(
    (params: {
      isPublished?: boolean;
      scheduledFor?: string | null;
      signedEvent?: { id?: string } | null;
    }) => ({
      status: params.isPublished
        ? "ACTIVE"
        : params.scheduledFor
          ? "SCHEDULED"
          : "DRAFT",
      isScheduled: Boolean(params.scheduledFor && !params.isPublished),
      isDraft: !params.isPublished && !params.scheduledFor,
      publishedAt: params.isPublished ? new Date() : null,
      nostrEventId: params.signedEvent?.id ?? null,
      finalScheduledFor: params.scheduledFor ?? null,
    }),
  ),
}));

import { prisma } from "~/lib/prisma.server";
import {
  getLongFormPost,
  getLongFormPostByEventId,
} from "~/models/longformpost.server";

import { TEST_USER_ID, TEST_LONGFORM_ID } from "../../utils/test-helpers";

describe("Longform Post Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLongFormPost", () => {
    it("should get longform post by ID", async () => {
      const mockPost = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        title: "Test Post",
        queueType: { id: "queue-1", name: "Test Queue" },
      };
      (
        prisma.longFormPost.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPost);

      const result = await getLongFormPost({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });

      expect(prisma.longFormPost.findFirst).toHaveBeenCalledWith({
        where: {
          id: TEST_LONGFORM_ID,
          userId: TEST_USER_ID,
        },
        include: {
          queueType: true,
        },
      });
      expect(result).toEqual(mockPost);
    });

    it("should return null if post not found", async () => {
      (
        prisma.longFormPost.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getLongFormPost({
        id: "nonexistent",
        userId: TEST_USER_ID,
      });

      expect(result).toBeNull();
    });
  });

  describe("getLongFormPostByEventId", () => {
    it("should get longform post by Nostr event ID", async () => {
      const mockPost = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        nostrEventId: "event-123",
        title: "Test Post",
      };
      (
        prisma.longFormPost.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPost);

      const result = await getLongFormPostByEventId({
        nostrEventId: "event-123",
        userId: TEST_USER_ID,
      });

      const callArgs = (
        prisma.longFormPost.findFirst as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as
        | { where?: { nostrEventId?: string; userId?: string } }
        | undefined;
      expect(callArgs?.where?.nostrEventId).toBe("event-123");
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockPost);
    });

    it("should return null if post not found", async () => {
      (
        prisma.longFormPost.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getLongFormPostByEventId({
        nostrEventId: "nonexistent",
        userId: TEST_USER_ID,
      });

      expect(result).toBeNull();
    });
  });
});
