/**
 * Integration tests for queue operations
 * Tests app/infra/queue/queue-operations.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock queue client
vi.mock("~/infra/queue/queue-client.server", () => ({
  queueClient: {
    enqueue: vi.fn(),
    cancelByJobId: vi.fn(),
  },
}));

import {
  TEST_USER_ID,
  TEST_POST_ID,
  TEST_LONGFORM_ID,
} from "../../utils/test-helpers";

import { queueClient } from "~/infra/queue/queue-client.server";
import {
  enqueuePostJob,
  cancelPostJob,
  enqueueLongFormPostJob,
  cancelLongFormPostJob,
  enqueuePostCheckerJob,
} from "~/infra/queue/queue-operations.server";

describe("Queue Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueuePostJob", () => {
    it("should enqueue a post job with scheduled time", async () => {
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
        sig: "sig-123",
      };
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueuePostJob(
        TEST_POST_ID,
        TEST_USER_ID,
        signedEvent,
        scheduledFor
      );

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-posts",
        "publish-post",
        { postId: TEST_POST_ID, userId: TEST_USER_ID, signedEvent },
        { scheduledFor, jobId: TEST_POST_ID }
      );
    });

    it("should enqueue a post job with immediate scheduling", async () => {
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
        sig: "sig-123",
      };

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueuePostJob(TEST_POST_ID, TEST_USER_ID, signedEvent, 0);

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-posts",
        "publish-post",
        { postId: TEST_POST_ID, userId: TEST_USER_ID, signedEvent },
        { delay: 0, jobId: TEST_POST_ID }
      );
    });

    it("should throw error if enqueue fails", async () => {
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
        sig: "sig-123",
      };

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Queue error",
      });

      await expect(
        enqueuePostJob(
          TEST_POST_ID,
          TEST_USER_ID,
          signedEvent,
          Math.floor(Date.now() / 1000) + 3600
        )
      ).rejects.toThrow("Queue error");
    });
  });

  describe("cancelPostJob", () => {
    it("should cancel a post job", async () => {
      (queueClient.cancelByJobId as ReturnType<typeof vi.fn>).mockResolvedValue(
        true
      );

      const result = await cancelPostJob(TEST_POST_ID);

      expect(queueClient.cancelByJobId).toHaveBeenCalledWith(
        "scheduled-posts",
        TEST_POST_ID
      );
      expect(result).toBe(true);
    });

    it("should return false if job not found", async () => {
      (queueClient.cancelByJobId as ReturnType<typeof vi.fn>).mockResolvedValue(
        false
      );

      const result = await cancelPostJob(TEST_POST_ID);

      expect(result).toBe(false);
    });
  });

  describe("enqueueLongFormPostJob", () => {
    it("should enqueue a longform post job", async () => {
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 30023,
        content: "test",
        tags: [],
        sig: "sig-123",
      };
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600;

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueueLongFormPostJob(
        TEST_LONGFORM_ID,
        TEST_USER_ID,
        signedEvent,
        scheduledFor
      );

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        "publish-longform-post",
        { postId: TEST_LONGFORM_ID, userId: TEST_USER_ID, signedEvent },
        { scheduledFor, jobId: TEST_LONGFORM_ID }
      );
    });

    it("should handle immediate scheduling for longform posts", async () => {
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 30023,
        content: "test",
        tags: [],
        sig: "sig-123",
      };

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueueLongFormPostJob(
        TEST_LONGFORM_ID,
        TEST_USER_ID,
        signedEvent,
        0
      );

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        "publish-longform-post",
        { postId: TEST_LONGFORM_ID, userId: TEST_USER_ID, signedEvent },
        { delay: 0, jobId: TEST_LONGFORM_ID }
      );
    });
  });

  describe("cancelLongFormPostJob", () => {
    it("should cancel a longform post job", async () => {
      (queueClient.cancelByJobId as ReturnType<typeof vi.fn>).mockResolvedValue(
        true
      );

      const result = await cancelLongFormPostJob(TEST_LONGFORM_ID);

      expect(queueClient.cancelByJobId).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        TEST_LONGFORM_ID
      );
      expect(result).toBe(true);
    });
  });

  describe("enqueuePostCheckerJob", () => {
    it("should enqueue a post checker job", async () => {
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueuePostCheckerJob();

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "post-checker",
        "check-due-posts",
        expect.objectContaining({
          postId: "",
          userId: "",
        }),
        { delay: 0 }
      );
    });

    it("should enqueue a post checker job with delay", async () => {
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueuePostCheckerJob(5000);

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "post-checker",
        "check-due-posts",
        expect.objectContaining({
          postId: "",
          userId: "",
        }),
        { delay: 5000 }
      );
    });

    it("should throw error if enqueue fails", async () => {
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Queue error",
      });

      await expect(enqueuePostCheckerJob()).rejects.toThrow("Queue error");
    });
  });
});
