/**
 * Integration tests for post command operations
 * Tests app/models/post.commands.server.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env so ENABLE_NOSTR_DELETE_EVENTS can be set per test
vi.mock("~/lib/env.server", async (importOriginal) => {
  /* eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vi.mock factory needs module type */
  const mod = await importOriginal<typeof import("~/lib/env.server")>();
  const actual = mod;
  return {
    env: new Proxy(actual.env, {
      get(target, prop: string) {
        const envRecord = target as unknown as Record<string, unknown>;
        if (prop === "ENABLE_NOSTR_DELETE_EVENTS") {
          return process.env["ENABLE_NOSTR_DELETE_EVENTS"] ?? envRecord[prop];
        }
        return envRecord[prop];
      },
    }),
  };
});

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    $transaction: vi.fn(),
    post: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    outboxEvent: {
      create: vi.fn(),
    },
  },
}));

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { prisma } from "~/lib/prisma.server";
import {
  createPost,
  updatePost,
  reschedulePost,
  deletePost,
} from "~/models/post.commands.server";

describe("Post Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["ENABLE_NOSTR_DELETE_EVENTS"];

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mocked Prisma transaction returns callback promise
      (callback: (tx: typeof prisma) => Promise<unknown>) => {
        const tx: typeof prisma = {
          ...prisma,
          post: prisma.post,
          outboxEvent: prisma.outboxEvent,
        };
        return callback(tx);
      }
    );
  });

  describe("createPost", () => {
    it("should create a post with all fields", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
      };
      (prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const postData = {
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE" as const,
        tags: ["tag1", "tag2"],
        caption: "Test caption",
        // Note: isScheduled and isPosted flags removed - state determined by scheduledFor
      };

      const result = await createPost(postData);

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            content: "Test content",
            fileUrl: ["https://example.com/image.jpg"],
            postType: "IMAGE",
            tags: ["tag1", "tag2"],
            caption: "Test caption",
            currentState: "DRAFT", // State determined by scheduledFor (null = DRAFT)
            repost: false,
            isQuotedPost: false,
            isRecyclable: false,
            manual_override: false,
          }),
        })
      );
      expect(result).toEqual(mockPost);
    });

    it("should create a post with queue type connection", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      (prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const postData = {
        userId: TEST_USER_ID,
        content: "Test",
        fileUrl: [],
        postType: "TEXT" as const,
        tags: [],
        queueTypeId: "queue-123",
      };

      await createPost(postData);

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            queueType: {
              connect: { id: "queue-123" },
            },
          }),
        })
      );
    });

    it("should create a post with hashtag preset connection", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      (prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const postData = {
        userId: TEST_USER_ID,
        content: "Test",
        fileUrl: [],
        postType: "TEXT" as const,
        tags: [],
        hashTagPresetId: "preset-123",
      };

      await createPost(postData);

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            hashTagPreset: {
              connect: { id: "preset-123" },
            },
          }),
        })
      );
    });

    it("should handle scheduled post with scheduledFor", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      (prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const scheduledFor = new Date("2024-12-31T12:00:00Z");
      const scheduledForUnix = Math.floor(scheduledFor.getTime() / 1000);
      const postData = {
        userId: TEST_USER_ID,
        content: "Test",
        fileUrl: [],
        postType: "TEXT" as const,
        tags: [],
        scheduledFor: scheduledForUnix,
      };

      await createPost(postData);

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            scheduledAtUtc: scheduledFor,
            currentState: "SCHEDULED", // State determined by scheduledFor (non-null = SCHEDULED)
          }),
        })
      );
    });
  });

  // updatePostStatus was removed - state transitions now use PostStateMachine
  // Tests for state transitions should be in post-state-machine.integration.test.ts

  describe("reschedulePost", () => {
    it("should reschedule post with new time", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const result = await reschedulePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        newScheduledFor: "1234567890",
        overrideQueue: false,
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          scheduledAtUtc: new Date(1234567890 * 1000),
          manual_override: false,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          updatedAt: expect.any(Date),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          signedEvent: expect.anything(),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          nostrEvent: expect.anything(),
          nostrEventId: null,
        }),
      });
      expect(result).toEqual(mockPost);
    });

    it("should update signed events when provided", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
        sig: "sig-123",
      };
      const nostrEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
      };

      await reschedulePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        newScheduledFor: "1234567890",
        overrideQueue: true,
        signedEvent,
        nostrEvent,
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          signedEvent,
          nostrEvent,
          nostrEventId: "event-123",
        }),
      });
    });

    it("should connect queue type when queueTypeId is provided", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await reschedulePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        newScheduledFor: "1234567890",
        overrideQueue: false,
        queueTypeId: "queue-123",
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          queueType: {
            connect: { id: "queue-123" },
          },
        }),
      });
    });

    it("should disconnect queue type when queueTypeId is null", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await reschedulePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        newScheduledFor: "1234567890",
        overrideQueue: false,
        queueTypeId: null,
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          queueType: {
            disconnect: true,
          },
        }),
      });
    });
  });

  describe("updatePost", () => {
    it("should update post with partial data", async () => {
      const mockPost = { id: TEST_POST_ID, content: "Updated content" };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const result = await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          content: "Updated content",
          caption: "Updated caption",
        },
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          content: "Updated content",
          caption: "Updated caption",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          updatedAt: expect.any(Date),
        }),
      });
      expect(result).toEqual(mockPost);
    });

    it("should handle queue type connection", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          queueTypeId: "queue-123",
        },
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          queueType: {
            connect: { id: "queue-123" },
          },
        }),
      });
    });

    it("should handle queue type disconnection", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          queueTypeId: null as unknown as undefined, // Pass null explicitly
        },
      });

      // Check the call was made with correct structure
      expect(prisma.post.update).toHaveBeenCalled();
      const updateCall = (prisma.post.update as ReturnType<typeof vi.fn>).mock
        .calls[0];
      if (!updateCall?.[0]) {
        throw new Error("update was not called");
      }
      const callArg = updateCall[0] as {
        where?: { id: string; userId: string };
        data?: Record<string, unknown>;
      };
      expect(callArg.where).toEqual({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      // queueType disconnect should be in the data object
      expect(callArg.data).toBeDefined();
      // Check if queueType exists in data
      const queueType = (
        callArg.data as { queueType?: { disconnect: boolean } }
      ).queueType;
      expect(queueType).toEqual({ disconnect: true });
    });

    it("should handle hashtag preset connection", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          hashTagPresetId: "preset-123",
        },
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          hashTagPreset: {
            connect: { id: "preset-123" },
          },
        }),
      });
    });
  });

  describe("deletePost", () => {
    it("should delete a post", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        nostrEventId: "nostr-event-1",
        signedEvent: {
          id: "nostr-event-1",
          pubkey: "pubkey-1",
        },
        nostrEvent: null,
      };
      (prisma.post.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (prisma.outboxEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );

      const result = await deletePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(prisma.post.delete).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
      });
      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            eventType: "POST_DELETED",
            aggregateId: TEST_POST_ID,
          }),
        })
      );
      expect(result).toEqual(mockPost);
    });

    it("should emit POST_DELETE_REQUESTED when feature flag is enabled", async () => {
      process.env["ENABLE_NOSTR_DELETE_EVENTS"] = "true";
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        nostrEventId: "nostr-event-1",
        signedEvent: {
          id: "nostr-event-1",
          pubkey: "pubkey-1",
        },
        nostrEvent: null,
      };
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (prisma.post.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (prisma.outboxEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );

      await deletePost({ id: TEST_POST_ID, userId: TEST_USER_ID });

      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(2);
      expect(prisma.outboxEvent.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            eventType: "POST_DELETE_REQUESTED",
            aggregateId: TEST_POST_ID,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
            payload: expect.objectContaining({
              originalEventId: "nostr-event-1",
              originalEventPubkey: "pubkey-1",
            }),
          }),
        })
      );
    });
  });
});
