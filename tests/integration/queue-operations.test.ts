/**
 * Integration tests for queue operations
 *
 * Tests the queue operations in app/infra/queue/queue-operations.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/infra/queue/queue-client.server", () => ({
  queueClient: {
    enqueue: vi.fn(),
    cancelByData: vi.fn(),
  },
}));

import type { SignedEvent } from "~/features/nostr/types";
import { queueClient } from "~/infra/queue/queue-client.server";
import {
  enqueuePostJob,
  cancelPostJob,
  enqueueLongFormPostJob,
  cancelLongFormPostJob,
  enqueuePostCheckerJob,
} from "~/infra/queue/queue-operations.server";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("Queue Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Post Job Operations", () => {
    it("should enqueue post job with scheduled timestamp", async () => {
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const mockSignedEvent: SignedEvent = {
        id: "event-123",
        kind: 1,
        pubkey: "test-pubkey",
        created_at: Date.now(),
        tags: [],
        content: "",
        sig: "test-sig",
      };

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueuePostJob(
        "post-123",
        TEST_USER_ID,
        mockSignedEvent,
        scheduledFor,
      );

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-posts",
        "publish-post",
        {
          postId: "post-123",
          userId: TEST_USER_ID,
          signedEvent: mockSignedEvent,
        },
        { scheduledFor },
      );
    });

    it("should enqueue post job with immediate processing (delay: 0)", async () => {
      const mockSignedEvent: SignedEvent = {
        id: "event-123",
        kind: 1,
        pubkey: "test-pubkey",
        created_at: Date.now(),
        tags: [],
        content: "",
        sig: "test-sig",
      };

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueuePostJob("post-123", TEST_USER_ID, mockSignedEvent, 0);

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-posts",
        "publish-post",
        {
          postId: "post-123",
          userId: TEST_USER_ID,
          signedEvent: mockSignedEvent,
        },
        { delay: 0 },
      );
    });

    it("should throw error when enqueue fails", async () => {
      const mockSignedEvent: SignedEvent = {
        id: "event-123",
        kind: 1,
        pubkey: "test-pubkey",
        created_at: Date.now(),
        tags: [],
        content: "",
        sig: "test-sig",
      };

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Queue error",
      });

      await expect(
        enqueuePostJob("post-123", TEST_USER_ID, mockSignedEvent, 0),
      ).rejects.toThrow("Queue error");
    });

    it("should cancel post job by postId", async () => {
      (queueClient.cancelByData as ReturnType<typeof vi.fn>).mockResolvedValue(
        true,
      );

      const result = await cancelPostJob("post-123");

      expect(queueClient.cancelByData).toHaveBeenCalledWith(
        "scheduled-posts",
        "postId",
        "post-123",
      );
      expect(result).toBe(true);
    });

    it("should return false when post job not found", async () => {
      (queueClient.cancelByData as ReturnType<typeof vi.fn>).mockResolvedValue(
        false,
      );

      const result = await cancelPostJob("post-123");

      expect(result).toBe(false);
    });
  });

  describe("Longform Post Job Operations", () => {
    it("should enqueue longform post job with scheduled timestamp", async () => {
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600;
      const mockSignedEvent: SignedEvent = {
        id: "event-123",
        kind: 30023,
        pubkey: "test-pubkey",
        created_at: Date.now(),
        tags: [],
        content: "",
        sig: "test-sig",
      } as unknown as SignedEvent;

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueueLongFormPostJob(
        "longform-123",
        TEST_USER_ID,
        mockSignedEvent,
        scheduledFor,
      );

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        "publish-longform-post",
        {
          postId: "longform-123",
          userId: TEST_USER_ID,
          signedEvent: mockSignedEvent,
        },
        { scheduledFor },
      );
    });

    it("should enqueue longform post job with immediate processing", async () => {
      const mockSignedEvent: SignedEvent = {
        id: "event-123",
        kind: 30023,
        pubkey: "test-pubkey",
        created_at: Date.now(),
        tags: [],
        content: "",
        sig: "test-sig",
      } as unknown as SignedEvent;

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        jobId: "job-123",
      });

      await enqueueLongFormPostJob(
        "longform-123",
        TEST_USER_ID,
        mockSignedEvent,
        0,
      );

      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        "publish-longform-post",
        {
          postId: "longform-123",
          userId: TEST_USER_ID,
          signedEvent: mockSignedEvent,
        },
        { delay: 0 },
      );
    });

    it("should throw error when longform enqueue fails", async () => {
      const mockSignedEvent: SignedEvent = {
        id: "event-123",
        kind: 30023,
        pubkey: "test-pubkey",
        created_at: Date.now(),
        tags: [],
        content: "",
        sig: "test-sig",
      } as unknown as SignedEvent;

      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Queue error",
      });

      await expect(
        enqueueLongFormPostJob(
          "longform-123",
          TEST_USER_ID,
          mockSignedEvent,
          0,
        ),
      ).rejects.toThrow("Queue error");
    });

    it("should cancel longform post job by postId", async () => {
      (queueClient.cancelByData as ReturnType<typeof vi.fn>).mockResolvedValue(
        true,
      );

      const result = await cancelLongFormPostJob("longform-123");

      expect(queueClient.cancelByData).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        "postId",
        "longform-123",
      );
      expect(result).toBe(true);
    });

    it("should return false when longform post job not found", async () => {
      (queueClient.cancelByData as ReturnType<typeof vi.fn>).mockResolvedValue(
        false,
      );

      const result = await cancelLongFormPostJob("longform-123");

      expect(result).toBe(false);
    });
  });

  describe("Post Checker Job Operations", () => {
    it("should enqueue post checker job with default delay", async () => {
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any returns any type
          signedEvent: expect.any(Object),
        }),
        { delay: 0 },
      );
    });

    it("should enqueue post checker job with custom delay", async () => {
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any returns any type
          signedEvent: expect.any(Object),
        }),
        { delay: 5000 },
      );
    });

    it("should throw error when post checker enqueue fails", async () => {
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Queue error",
      });

      await expect(enqueuePostCheckerJob()).rejects.toThrow("Queue error");
    });
  });
});
