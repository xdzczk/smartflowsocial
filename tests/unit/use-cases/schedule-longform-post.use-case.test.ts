/**
 * Unit tests for ScheduleLongFormPostUseCase
 * Tests app/features/posts/use-cases/schedule-longform-post.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $transaction: vi.fn(),
    longFormPost: {
      update: vi.fn(),
      findUnique: vi.fn(), // Add findUnique for post lookup
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/models/longformpost.server", () => ({
  getLongFormPost: vi.fn(),
}));

vi.mock("~/infra/outbox/outbox.server", () => ({
  createOutboxEventInTransaction: vi.fn(),
}));

vi.mock("~/lib/idempotency.server", () => ({
  generateEnqueueIdempotencyKey: vi.fn(),
}));

const mockTransition = vi.fn();
vi.mock(
  "~/features/posts/state-machine/longform-post-state-machine.server",
  () => ({
    LongFormPostStateMachine: class {
      transition = mockTransition;
    },
  })
);

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { ScheduleLongFormPostUseCase } from "~/features/posts/use-cases/schedule-longform-post.use-case.server";
import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { prisma } from "~/lib/prisma.server";
import { fromDate } from "~/lib/temporal";
import { getLongFormPost } from "~/models/longformpost.server";

describe("ScheduleLongFormPostUseCase", () => {
  let useCase: ScheduleLongFormPostUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransition.mockResolvedValue(undefined);
    (
      mockPrisma.longFormPost.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: TEST_POST_ID,
      userId: TEST_USER_ID,
      currentState: "DRAFT",
    });
    useCase = new ScheduleLongFormPostUseCase();
  });

  describe("execute", () => {
    it("should schedule a longform post successfully", async () => {
      const scheduledAtUtc = fromDate(new Date(Date.now() + 3600000), "UTC");
      const scheduledForUnix = Math.floor(
        Number(scheduledAtUtc.epochNanoseconds) / 1_000_000_000
      );
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
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

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (
        generateEnqueueIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("enqueue-key-1");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            longFormPost: {
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
        // correlationId not provided - should be undefined
      });

      expect(getLongFormPost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(createOutboxEventInTransaction).toHaveBeenCalledWith(
        expect.any(Object), // tx (transaction client)
        "LONGFORM_SCHEDULED",
        TEST_POST_ID,
        "LongFormPost",
        expect.objectContaining({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          signedEvent,

          scheduledFor: expect.any(Number) as number, // Can be decimal from Temporal conversion
          schemaVersion: "1.0",
        }),
        expect.any(Date), // scheduledAtUtcDate (converted from Temporal)
        "enqueue-key-1",
        undefined // correlationId (not provided in this test)
      );
    });

    it("should throw error if post not found", async () => {
      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(null);

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
        `Long form post ${TEST_POST_ID} not found for user ${TEST_USER_ID}`
      );
    });

    it("should use correlation ID if provided", async () => {
      const scheduledAtUtc = fromDate(new Date(Date.now() + 3600000), "UTC");
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        currentState: "DRAFT",
      };

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (
        generateEnqueueIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("enqueue-key-1");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            longFormPost: {
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
        expect.any(Object), // tx (transaction client)
        "LONGFORM_SCHEDULED",
        TEST_POST_ID,
        "LongFormPost",
        expect.objectContaining({
          correlationId: "custom-correlation-id",
        }),
        expect.any(Date), // scheduledAtUtcDate (converted from Temporal)
        "enqueue-key-1",
        "custom-correlation-id" // correlationId is also passed as separate argument
      );
    });
  });
});
