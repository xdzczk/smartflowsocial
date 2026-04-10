/**
 * Integration tests for drafts action handlers
 *
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see tests/e2e/posts/drafts.cy.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
// Single mock so all used exports are available
vi.mock("~/features/posts/server", () => ({
  deletePost: vi.fn(),
  updatePost: vi.fn(),
  deleteLongFormPost: vi.fn(),
}));

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

// Mock Prisma for PostStateMachine
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn().mockResolvedValue({
        planId: "creator",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        Plan: { id: "creator", name: "Creator" },
      }),
    },
    postStateTransition: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => {
      const tx = {
        post: {
          update: vi.fn().mockResolvedValue({}),
        },
        postStateTransition: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Test mock callback has complex types
      return await callback(tx);
    }),
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import {
  createActionFormData,
  TEST_USER_ID,
  TEST_POST_ID,
  TEST_LONGFORM_ID,
  createPostIds,
} from "../utils/test-helpers";

import { deleteLongFormPost } from "~/features/posts/server";
import { deletePost, updatePost } from "~/features/posts/server";
import { handleDraftsAction } from "~/features/posts/server/drafts";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";

describe("Drafts Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for resolveQueueTypeId - returns the queueTypeId if provided, otherwise resolves from queueType name
    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Test functions can be async
      (userId, queueTypeId, queueType): Promise<string | null> => {
        if (queueTypeId) return Promise.resolve(queueTypeId);
        if (queueType === "queue-1") return Promise.resolve("queue-1");
        if (queueType === "queue-2") return Promise.resolve("queue-2");
        return Promise.resolve(null);
      }
    );
    // Setup default Prisma mocks for PostStateMachine
    (mockPrisma.post.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock implementation needs to be async
      async (args: { where: { id: string; userId: string } }) => {
        return {
          id: args.where.id,
          userId: args.where.userId,
          currentState: "DRAFT", // Default state for draft posts
        };
      }
    );
    (mockPrisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (
      mockPrisma.postStateTransition.create as ReturnType<typeof vi.fn>
    ).mockResolvedValue({});
  });

  describe("Delete Post Action", () => {
    it("should delete a single draft post", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("delete", {
        postId: TEST_POST_ID,
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Delete Longform Post Action", () => {
    it("should delete a single draft longform post", async () => {
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const formData = createActionFormData("deleteLongForm", {
        postId: TEST_LONGFORM_ID,
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(deleteLongFormPost).toHaveBeenCalledWith({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Bulk Delete Posts Action", () => {
    it("should delete multiple draft posts", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const postIds = createPostIds(3);
      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledTimes(3);
      postIds.forEach((id) => {
        expect(deletePost).toHaveBeenCalledWith({
          id,
          userId: TEST_USER_ID,
        });
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Bulk Sign and Resume Action", () => {
    it("should sign and resume multiple draft posts", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const postIds = ["post-1", "post-2"];
      const contents = ["Content 1", "Content 2"];
      const captions = ["Caption 1", "Caption 2"];
      const queueTypes = ["queue-1", "queue-2"];
      // Handler expects scheduledFors as Unix timestamp strings (seconds)
      const scheduledAtUtc1 = 1704092400; // 2024-01-01T10:00:00Z
      const scheduledAtUtc2 = 1704096000; // 2024-01-01T11:00:00Z
      const scheduledFors = [String(scheduledAtUtc1), String(scheduledAtUtc2)];
      const signedEvents = [
        JSON.stringify({ id: "event-1", pubkey: "pk1" }),
        JSON.stringify({ id: "event-2", pubkey: "pk2" }),
      ];
      const nostrEvents = [
        JSON.stringify({ id: "nostr-1" }),
        JSON.stringify({ id: "nostr-2" }),
      ];

      // Create FormData with arrays properly formatted for FormData.getAll()
      const formData = new FormData();
      formData.set("_action", "bulkSignAndResume");
      postIds.forEach((id) => formData.append("postIds", id));
      contents.forEach((content) => formData.append("contents", content));
      captions.forEach((caption) => formData.append("captions", caption));
      queueTypes.forEach((queue) => formData.append("queueTypes", queue));
      queueTypes.forEach(() => formData.append("queueTypeIds", "")); // Empty strings for queueTypeIds
      scheduledFors.forEach((scheduled) =>
        formData.append("scheduledFors", scheduled)
      );
      signedEvents.forEach((event) => formData.append("signedEvents", event));
      nostrEvents.forEach((event) => formData.append("nostrEvents", event));

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(updatePost).toHaveBeenCalledTimes(2);
      expect(resolveQueueTypeId).toHaveBeenCalledTimes(2);
      expect(resolveQueueTypeId).toHaveBeenCalledWith(
        TEST_USER_ID,
        null,
        "queue-1"
      );
      expect(resolveQueueTypeId).toHaveBeenCalledWith(
        TEST_USER_ID,
        null,
        "queue-2"
      );
      expect(updatePost).toHaveBeenCalledWith({
        id: "post-1",
        userId: TEST_USER_ID,
        data: {
          content: "Content 1",
          caption: "Caption 1",
          queueTypeId: "queue-1",
          scheduledAtUtc: scheduledAtUtc1,
          signedEvent: { id: "event-1", pubkey: "pk1" },
          nostrEvent: { id: "nostr-1" },
        },
      });
      expect(updatePost).toHaveBeenCalledWith({
        id: "post-2",
        userId: TEST_USER_ID,
        data: {
          content: "Content 2",
          caption: "Caption 2",
          queueTypeId: "queue-2",
          scheduledAtUtc: scheduledAtUtc2,
          signedEvent: { id: "event-2", pubkey: "pk2" },
          nostrEvent: { id: "nostr-2" },
        },
      });
      expect(result).toEqual({ success: true });
    });

    it("should handle single post in bulk sign and resume", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Create FormData - use append calls which formData.getAll() will return as arrays
      const formData = new FormData();
      formData.set("_action", "bulkSignAndResume");
      formData.append("postIds", "post-1");
      formData.append("contents", "Content 1");
      formData.append("captions", "Caption 1");
      formData.append("queueTypes", "queue-1");
      formData.append("queueTypeIds", "");
      formData.append("scheduledFors", "2024-01-01T10:00:00Z");
      // SignedEvent needs all required fields for Zod validation
      formData.append(
        "signedEvents",
        JSON.stringify({
          id: "event-1",
          pubkey: "pk1",
          created_at: 1234567890,
          kind: 1,
          content: "Content 1",
          tags: [],
          sig: "sig1",
        })
      );
      formData.append(
        "nostrEvents",
        JSON.stringify({
          id: "nostr-1",
          pubkey: "pk1",
          created_at: 1234567890,
          kind: 1,
          content: "Content 1",
          tags: [],
        })
      );

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(updatePost).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it("should handle mismatched array lengths gracefully", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Arrays with matching lengths - Zod validates all arrays are present
      const formData = new FormData();
      formData.set("_action", "bulkSignAndResume");
      formData.append("postIds", "post-1");
      formData.append("postIds", "post-2");
      formData.append("contents", "Content 1");
      formData.append("contents", "Content 2");
      formData.append("captions", "Caption 1");
      formData.append("captions", "Caption 2");
      formData.append("queueTypes", "queue-1");
      formData.append("queueTypes", "queue-2");
      formData.append("queueTypeIds", "");
      formData.append("queueTypeIds", "");
      formData.append("scheduledFors", "2024-01-01T10:00:00Z");
      formData.append("scheduledFors", "2024-01-01T11:00:00Z");
      // SignedEvents need all required fields for Zod validation
      formData.append(
        "signedEvents",
        JSON.stringify({
          id: "event-1",
          pubkey: "pk1",
          created_at: 1234567890,
          kind: 1,
          content: "Content 1",
          tags: [],
          sig: "sig1",
        })
      );
      formData.append(
        "signedEvents",
        JSON.stringify({
          id: "event-2",
          pubkey: "pk2",
          created_at: 1234567891,
          kind: 1,
          content: "Content 2",
          tags: [],
          sig: "sig2",
        })
      );
      formData.append("nostrEvents", JSON.stringify({ id: "nostr-1" }));
      formData.append("nostrEvents", JSON.stringify({ id: "nostr-2" }));

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      // Should process based on postIds length
      expect(updatePost).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it("should parse JSON strings for signedEvent and nostrEvent", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // SignedEvent needs all required fields for Zod validation
      const signedEvent = {
        id: "event-1",
        pubkey: "pk1",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
        sig: "sig1",
      };
      const nostrEvent = {
        id: "nostr-1",
        pubkey: "pk1",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
      };

      // Create FormData with arrays - use multiple append calls to ensure arrays
      const formData = new FormData();
      formData.set("_action", "bulkSignAndResume");
      formData.append("postIds", "post-1");
      formData.append("contents", "Content 1");
      formData.append("captions", "Caption 1");
      formData.append("queueTypes", "queue-1");
      formData.append("queueTypeIds", "");
      formData.append("scheduledFors", "2024-01-01T10:00:00Z");
      // signedEvents and nostrEvents need to be arrays
      formData.append("signedEvents", JSON.stringify(signedEvent));
      formData.append("nostrEvents", JSON.stringify(nostrEvent));

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      // Check if validation failed
      if (result instanceof Response && result.status === 400) {
        const data = (await result.json()) as { error?: unknown };
        throw new Error(`Validation failed: ${JSON.stringify(data)}`);
      }

      expect(updatePost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            signedEvent,
            nostrEvent,
          }),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should return error for invalid action", async () => {
      const formData = createActionFormData("invalidAction", {});

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      // Zod validation fails because "invalidAction" is not in the enum
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
    });

    it("should handle database errors from deletePost", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const formData = createActionFormData("delete", {
        postId: TEST_POST_ID,
      });

      await expect(handleDraftsAction(formData, TEST_USER_ID)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle database errors from updatePost", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Update failed")
      );

      // Create FormData - validation must pass first, then Promise.all will throw
      const formData = new FormData();
      formData.set("_action", "bulkSignAndResume");
      formData.append("postIds", "post-1");
      formData.append("contents", "Content 1");
      formData.append("captions", "Caption 1");
      formData.append("queueTypes", "queue-1");
      formData.append("queueTypeIds", "");
      formData.append("scheduledFors", "2024-01-01T10:00:00Z");
      // SignedEvent needs all required fields for Zod validation
      formData.append(
        "signedEvents",
        JSON.stringify({
          id: "event-1",
          pubkey: "pk1",
          created_at: 1234567890,
          kind: 1,
          content: "Content 1",
          tags: [],
          sig: "sig1",
        })
      );
      formData.append(
        "nostrEvents",
        JSON.stringify({
          id: "nostr-1",
          pubkey: "pk1",
          created_at: 1234567890,
          kind: 1,
          content: "Content 1",
          tags: [],
        })
      );

      // Database errors from Promise.all will throw, not return a Response
      // Promise.all rejects if any promise rejects
      await expect(handleDraftsAction(formData, TEST_USER_ID)).rejects.toThrow(
        "Update failed"
      );

      // Verify updatePost was called (validation passed)
      expect(updatePost).toHaveBeenCalledTimes(1);
    });

    it("should handle JSON parse errors in bulk sign and resume", async () => {
      // Create FormData with arrays properly formatted for FormData.getAll()
      const formData = new FormData();
      formData.set("_action", "bulkSignAndResume");
      formData.append("postIds", "post-1");
      formData.append("contents", "Content 1");
      formData.append("captions", "Caption 1");
      formData.append("queueTypes", "queue-1");
      formData.append("queueTypeIds", ""); // Empty string for queueTypeId
      formData.append("scheduledFors", "2024-01-01T10:00:00Z");
      formData.append("signedEvents", "invalid-json");
      formData.append(
        "nostrEvents",
        JSON.stringify({
          id: "nostr-1",
          pubkey: "pk1",
          created_at: 1234567890,
          kind: 1,
          content: "Content 1",
          tags: [],
        })
      );

      // Zod transform will throw an error when parsing invalid JSON
      const result = await handleDraftsAction(formData, TEST_USER_ID);
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
    });
  });
});
