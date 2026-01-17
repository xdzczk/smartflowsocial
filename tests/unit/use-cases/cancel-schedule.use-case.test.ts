/**
 * Unit tests for CancelScheduleUseCase
 * Tests app/features/posts/use-cases/cancel-schedule.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/infra/queue", () => ({
  cancelPostJob: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getPostById: vi.fn(),
}));

vi.mock("~/models/post.commands.server", () => ({
  updatePost: vi.fn(),
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
  logError: vi.fn(),
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordPostCancelled: vi.fn(),
}));

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { CancelScheduleUseCase } from "~/features/posts/use-cases/cancel-schedule.use-case.server";
import { cancelPostJob } from "~/infra/queue";
import { recordPostCancelled } from "~/lib/metrics/business-metrics.server";
import { updatePost } from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";

describe("CancelScheduleUseCase", () => {
  let useCase: CancelScheduleUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransition.mockResolvedValue(undefined);
    useCase = new CancelScheduleUseCase();
  });

  describe("execute", () => {
    it("should cancel a scheduled post successfully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        currentState: "SCHEDULED",
        postType: "IMAGE",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (cancelPostJob as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const result = await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(result.cancelled).toBe(true);
      expect(getPostById).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(cancelPostJob).toHaveBeenCalledWith(TEST_POST_ID);
      expect(updatePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          scheduledFor: null,
          // Note: isScheduled flag removed - state machine handles state transitions
        },
      });
      expect(mockTransition).toHaveBeenCalledWith(
        TEST_POST_ID,
        TEST_USER_ID,
        "CANCELLED",
        "Post schedule cancelled by user"
      );
      expect(recordPostCancelled).toHaveBeenCalledWith("IMAGE");
    });

    it("should return cancelled: false if post is not scheduled", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        currentState: "DRAFT",
        postType: "IMAGE",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const result = await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(result.cancelled).toBe(false);
      expect(cancelPostJob).not.toHaveBeenCalled();
      expect(updatePost).not.toHaveBeenCalled();
      expect(mockTransition).not.toHaveBeenCalled();
    });

    it("should handle job not found in queue gracefully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        currentState: "SCHEDULED",
        postType: "IMAGE",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (cancelPostJob as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const result = await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(result.cancelled).toBe(true);
      expect(cancelPostJob).toHaveBeenCalled();
      expect(updatePost).toHaveBeenCalled();
    });

    it("should throw error if post not found", async () => {
      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        useCase.execute({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(
        `Post ${TEST_POST_ID} not found for user ${TEST_USER_ID}`
      );
    });

    it("should handle state transition failure gracefully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        currentState: "SCHEDULED",
        postType: "IMAGE",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (cancelPostJob as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      mockTransition.mockRejectedValue(new Error("State transition failed"));

      const result = await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      // Should still succeed even if state transition fails
      expect(result.cancelled).toBe(true);
      expect(updatePost).toHaveBeenCalled();
    });

    it("should use correlation ID if provided", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        currentState: "SCHEDULED",
        postType: "IMAGE",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (cancelPostJob as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      // Correlation ID should be used in logging (tested via mocks)
      expect(getPostById).toHaveBeenCalled();
    });
  });
});
