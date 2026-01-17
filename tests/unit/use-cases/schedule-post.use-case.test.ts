/**
 * Unit tests for SchedulePostUseCase
 * Tests app/features/posts/use-cases/schedule-post.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $transaction: vi.fn(),
    post: {
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/models/post.queries.server", () => ({
  getPostById: vi.fn(),
}));

vi.mock("~/infra/outbox/outbox.server", () => ({
  createOutboxEventInTransaction: vi.fn(),
}));

vi.mock("~/lib/idempotency.server", () => ({
  generateEnqueueIdempotencyKey: vi.fn(),
}));

const mockTransition = vi.fn();
vi.mock("~/features/posts/state-machine/post-state-machine.server", () => ({
  PostStateMachine: class {
    transition = mockTransition;
  },
}));

vi.mock("~/lib/correlation-context.server", () => ({
  getCorrelationId: vi.fn((id) => id ?? "test-correlation-id"),
}));

vi.mock("~/lib/error-logger.server", () => ({
  logInfo: vi.fn(),
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordPostScheduled: vi.fn(),
}));

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { SchedulePostUseCase } from "~/features/posts/use-cases/schedule-post.use-case.server";
import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { recordPostScheduled } from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";
import { fromDate } from "~/lib/temporal";
import { getPostById } from "~/models/post.queries.server";

describe("SchedulePostUseCase", () => {
  let useCase: SchedulePostUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransition.mockResolvedValue(undefined);
    useCase = new SchedulePostUseCase();
  });

  describe("execute", () => {
    it("should schedule a post successfully", async () => {
      const scheduledAtUtc = fromDate(new Date(Date.now() + 3600000), "UTC");
      const scheduledForUnix = Math.floor(
        Number(scheduledAtUtc.epochNanoseconds) / 1_000_000_000
      );
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "IMAGE",
        currentState: "DRAFT",
      };

      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: scheduledForUnix,
        kind: 1,
        content: "test",
        tags: [],
        sig: "test-sig",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (
        generateEnqueueIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("enqueue-key-1");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            post: {
              update: vi.fn().mockResolvedValue(mockPost),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Mock transaction callback
          return await callback(tx);
        }
      );
      (
        createOutboxEventInTransaction as ReturnType<typeof vi.fn>
      ).mockResolvedValue(undefined);

      await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        scheduledAtUtc,
        signedEvent,
      });

      expect(getPostById).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(createOutboxEventInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining returns any type
          post: expect.objectContaining({
            update: expect.any(Function) as unknown as (
              args: unknown
            ) => Promise<unknown>,
          }),
        }),
        "POST_SCHEDULED",
        TEST_POST_ID,
        "Post",
        expect.objectContaining({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          signedEvent,

          scheduledFor: expect.any(Number) as number, // Can be float from Temporal conversion
          schemaVersion: "1.0",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any returns any type
          correlationId: expect.any(String),
        }),

        expect.any(Date), // scheduledAtUtcDate (converted from Temporal)
        "enqueue-key-1",

        expect.any(String) // correlationId
      );
      expect(mockTransition).toHaveBeenCalledWith(
        TEST_POST_ID,
        TEST_USER_ID,
        "SCHEDULED",
        expect.stringContaining("Post scheduled for")
      );
      expect(recordPostScheduled).toHaveBeenCalledWith("IMAGE");
    });

    it("should throw error if post not found", async () => {
      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        useCase.execute({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          scheduledAtUtc: fromDate(new Date(), "UTC"),
          signedEvent: {
            id: "event-123",
            pubkey: "test-pubkey",
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            content: "test",
            tags: [],
            sig: "test-sig",
          },
        })
      ).rejects.toThrow(
        `Post ${TEST_POST_ID} not found for user ${TEST_USER_ID}`
      );
    });

    it("should use correlation ID if provided", async () => {
      const { fromDate } = await import("~/lib/temporal");
      const scheduledAtUtc = fromDate(new Date(Date.now() + 3600000), "UTC");
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "TEXT",
        currentState: "DRAFT",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (
        generateEnqueueIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("enqueue-key-1");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            post: {
              update: vi.fn().mockResolvedValue(mockPost),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Mock transaction callback
          return await callback(tx);
        }
      );
      (
        createOutboxEventInTransaction as ReturnType<typeof vi.fn>
      ).mockResolvedValue(undefined);

      await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        scheduledAtUtc,
        signedEvent: {
          id: "event-123",
          pubkey: "test-pubkey",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
        correlationId: "custom-correlation-id",
      });

      expect(createOutboxEventInTransaction).toHaveBeenCalledWith(
        expect.any(Object),
        "POST_SCHEDULED",
        TEST_POST_ID,
        "Post",
        expect.objectContaining({
          correlationId: "custom-correlation-id",
        }),
        expect.any(Date), // scheduledAtUtcDate (converted from Temporal)
        "enqueue-key-1",
        "custom-correlation-id"
      );
    });

    it("should handle state transition failure", async () => {
      const scheduledAtUtc = fromDate(new Date(Date.now() + 3600000), "UTC");
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "TEXT",
        currentState: "DRAFT",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (
        generateEnqueueIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("enqueue-key-1");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            post: {
              update: vi.fn().mockResolvedValue(mockPost),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Mock transaction callback
          return await callback(tx);
        }
      );
      (
        createOutboxEventInTransaction as ReturnType<typeof vi.fn>
      ).mockResolvedValue(undefined);
      mockTransition.mockRejectedValue(new Error("State transition failed"));

      await expect(
        useCase.execute({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          scheduledAtUtc,
          signedEvent: {
            id: "event-123",
            pubkey: "test-pubkey",
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            content: "test",
            tags: [],
            sig: "test-sig",
          },
        })
      ).rejects.toThrow("State transition failed");
    });
  });
});
