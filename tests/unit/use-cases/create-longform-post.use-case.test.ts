/**
 * Unit tests for CreateLongFormPostUseCase
 * Tests app/features/posts/use-cases/create-longform-post.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockLongFormPostUpdate = vi.fn().mockResolvedValue({});
  const mockLongFormPostStateTransitionCreate = vi.fn().mockResolvedValue({});
  const mockPrisma = {
    longFormPost: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: mockLongFormPostUpdate,
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        longFormPost: { update: mockLongFormPostUpdate },
        longFormPostStateTransition: {
          create: mockLongFormPostStateTransitionCreate,
        },
      };
      return fn(tx);
    }),
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/models/longformpost.server", () => ({
  createLongFormPost: vi.fn(),
}));

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

vi.mock("~/infra/outbox/outbox.server", () => ({
  createOutboxEventInTransaction: vi.fn(),
}));

vi.mock("~/lib/idempotency.server", () => ({
  generateEnqueueIdempotencyKey: vi.fn(),
}));

// Use case imports state machine from this path; mock so we don't need a full tx for isPublished path
const mockTransition = vi.fn();
vi.mock(
  "~/features/posts/longform/state-machine/longform-post-state-machine.server",
  () => ({
    LongFormPostStateMachine: class {
      transition = mockTransition;
    },
  })
);
vi.mock("~/features/posts/server", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- importOriginal type
    ...(actual ?? {}),
    calculateLongFormStatus: vi.fn(),
  };
});

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { calculateLongFormStatus } from "~/features/posts/server";
import { CreateLongFormPostUseCase } from "~/features/posts/server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { prisma } from "~/lib/prisma.server";
import { createLongFormPost } from "~/models/longformpost.server";

describe("CreateLongFormPostUseCase", () => {
  let useCase: CreateLongFormPostUseCase;

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
    useCase = new CreateLongFormPostUseCase();
  });

  describe("execute", () => {
    it("should create a draft longform post successfully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
        currentState: "DRAFT",
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (createLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const result = await useCase.execute({
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
      });

      expect(result.post).toEqual(mockPost);
      expect(result.needsScheduling).toBe(false);
      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          title: "Test Title",
          content: "Test content",
        })
      );
    });

    it("should create a scheduled longform post with outbox event", async () => {
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600;
      const scheduledAtUtc = new Date(scheduledFor * 1000);
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
        currentState: "SCHEDULED",
        status: "SCHEDULED",
        scheduledAtUtc,
        scheduledFor: scheduledFor.toString(),
      };

      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: scheduledFor,
        kind: 1,
        content: "test",
        tags: [],
        sig: "test-sig",
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (calculateLongFormStatus as ReturnType<typeof vi.fn>).mockReturnValue({
        status: "SCHEDULED",
        isScheduled: true,
        isDraft: false,
        publishedAt: null,
        nostrEventId: null,
        finalScheduledFor: scheduledFor.toString(),
      });
      (
        generateEnqueueIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("enqueue-key-1");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            longFormPost: {
              create: vi.fn().mockResolvedValue(mockPost),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Mock transaction callback
          return callback(tx);
        }
      );
      (
        createOutboxEventInTransaction as ReturnType<typeof vi.fn>
      ).mockResolvedValue(undefined);

      const result = await useCase.execute({
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
        scheduledFor,
        signedEvent,
      });

      expect(result.post).toEqual(mockPost);
      expect(result.needsScheduling).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(createOutboxEventInTransaction).toHaveBeenCalledWith(
        expect.any(Object),
        "LONGFORM_SCHEDULED",
        TEST_POST_ID,
        "LongFormPost",
        expect.objectContaining({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          signedEvent,
          scheduledFor,
          schemaVersion: "1.0",
        }),
        scheduledAtUtc,
        "enqueue-key-1"
      );
    });

    it("should resolve queue type when queueType name is provided", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
        currentState: "DRAFT",
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (createLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await useCase.execute({
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
        queueType: "posts",
      });

      expect(resolveQueueTypeId).toHaveBeenCalledWith(
        TEST_USER_ID,
        undefined,
        "posts"
      );
    });

    it("should not create outbox event if isPublished is true", async () => {
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600;
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
        currentState: "PUBLISHED",
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (createLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const result = await useCase.execute({
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
        scheduledFor,
        signedEvent: {
          id: "event-123",
          pubkey: "test-pubkey",
          created_at: scheduledFor,
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
        isPublished: true,
      });

      expect(result.needsScheduling).toBe(false);
      // State machine is mocked (mockTransition); real runTransaction not used for this path
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(createOutboxEventInTransaction).not.toHaveBeenCalled();
    });
  });
});
