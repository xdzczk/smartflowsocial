/**
 * Integration tests for Scheduled Posts Service Action Handlers
 * Tests app/features/posts/services/scheduled-posts.server.ts action handlers
 * that use use cases (reschedule, edit)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies - use vi.hoisted to allow top-level variables in mocks
const { mockScheduleExecute } = vi.hoisted(() => {
  const mockScheduleExecute = vi.fn();
  return { mockScheduleExecute };
});

vi.mock("~/features/posts/scheduling/index.server", () => ({
  SchedulePostUseCase: class {
    execute = mockScheduleExecute;
  },
}));

vi.mock("~/models/post.queries.server", () => ({
  getPostById: vi.fn(),
}));

vi.mock("~/models/post.commands.server", () => ({
  reschedulePost: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock("~/models/longformpost.server", () => ({
  getLongFormPost: vi.fn(),
  updateLongFormPost: vi.fn(),
}));

const mockCancelLongFormExecute = vi.fn();
const mockScheduleLongFormExecute = vi.fn();

vi.mock("~/features/posts/server", () => ({
  CancelScheduleLongFormUseCase: class {
    execute = mockCancelLongFormExecute;
  },
  ScheduleLongFormPostUseCase: class {
    execute = mockScheduleLongFormExecute;
  },
}));

// Use cases are mocked above
import {
  TEST_USER_ID,
  TEST_POST_ID,
  TEST_LONGFORM_ID,
} from "../../utils/test-helpers";

import { handleScheduledPostAction } from "~/features/posts/server";
import {
  getLongFormPost,
  updateLongFormPost,
} from "~/models/longformpost.server";
import { reschedulePost, updatePost } from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";

describe("Scheduled Posts Service Action Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScheduleExecute.mockResolvedValue(undefined);
    mockCancelLongFormExecute.mockResolvedValue({ cancelled: true });
    mockScheduleLongFormExecute.mockResolvedValue(undefined);
  });

  describe("handleReschedule", () => {
    it("should reschedule a post using CancelScheduleUseCase and SchedulePostUseCase", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isScheduled: true,
      };

      const mockUpdatedPost = {
        ...mockPost,
        scheduledAtUtc: new Date("2024-01-01T12:00:00Z"),
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (reschedulePost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdatedPost
      );

      const formData = new FormData();
      formData.append("_action", "reschedule");
      formData.append("postId", TEST_POST_ID);
      formData.append("newTime", "1704110400"); // 2024-01-01T12:00:00Z
      formData.append(
        "signedEvent",
        JSON.stringify({
          id: "event-123",
          pubkey: "pk-123",
          created_at: 1704110400,
          kind: 1,
          content: "test",
          tags: [],
          sig: "sig-123",
        })
      );
      formData.append(
        "nostrEvent",
        JSON.stringify({
          id: "event-123",
          pubkey: "pk-123",
          created_at: 1704110400,
          kind: 1,
          content: "test",
          tags: [],
          sig: "sig-123",
        })
      );

      const result = await handleScheduledPostAction(formData, TEST_USER_ID);

      expect(getPostById).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(reschedulePost).toHaveBeenCalled();
      expect(mockScheduleExecute).toHaveBeenCalled();

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.signed).toBe(true);
    });

    it("should return needsSigning if signedEvent is missing", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isScheduled: true,
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (reschedulePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const formData = new FormData();
      formData.append("_action", "reschedule");
      formData.append("postId", TEST_POST_ID);
      formData.append("newTime", "1704110400");

      const result = await handleScheduledPostAction(formData, TEST_USER_ID);

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.needsSigning).toBe(true);
      expect(mockScheduleExecute).not.toHaveBeenCalled(); // No signed event, so no schedule
    });

    it("should return error if post not found", async () => {
      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const formData = new FormData();
      formData.append("_action", "reschedule");
      formData.append("postId", TEST_POST_ID);
      formData.append("newTime", "1704110400");

      const result = await handleScheduledPostAction(formData, TEST_USER_ID);

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      if (jsonResult.error && typeof jsonResult.error === "string") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
        expect(jsonResult.error).toContain("not found");
      }
    });

    it("should return error if required fields are missing", async () => {
      const formData = new FormData();
      formData.append("_action", "reschedule");
      formData.append("postId", TEST_POST_ID);
      // Missing newTime

      const result = await handleScheduledPostAction(formData, TEST_USER_ID);

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.error).toContain("Missing required fields");
    });
  });

  describe("handleEditPost", () => {
    it("should edit a post using CancelScheduleUseCase and SchedulePostUseCase when scheduledFor and signedEvent are provided", async () => {
      const mockUpdatedPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Updated content",
      };

      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdatedPost
      );

      const formData = new FormData();
      formData.append("_action", "editPost");
      formData.append("postId", TEST_POST_ID);
      formData.append("caption", "Updated content");
      formData.append("scheduledFor", "1704110400");
      formData.append(
        "signedEvent",
        JSON.stringify({
          id: "event-123",
          pubkey: "pk-123",
          created_at: 1704110400,
          kind: 1,
          content: "test",
          tags: [],
          sig: "sig-123",
        })
      );
      formData.append(
        "nostrEvent",
        JSON.stringify({
          id: "event-123",
          pubkey: "pk-123",
          created_at: 1704110400,
          kind: 1,
          content: "test",
          tags: [],
          sig: "sig-123",
        })
      );

      const result = await handleScheduledPostAction(formData, TEST_USER_ID);

      expect(updatePost).toHaveBeenCalled();
      expect(mockScheduleExecute).toHaveBeenCalled();

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
    });

    it("should edit a post without using use cases if scheduledFor is not provided", async () => {
      const mockUpdatedPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Updated content",
      };

      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdatedPost
      );

      const formData = new FormData();
      formData.append("_action", "editPost");
      formData.append("postId", TEST_POST_ID);
      formData.append("caption", "Updated content");
      // No scheduledFor

      const result = await handleScheduledPostAction(formData, TEST_USER_ID);

      expect(updatePost).toHaveBeenCalled();
      expect(mockScheduleExecute).not.toHaveBeenCalled();

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
    });

    it("should return error if postId is missing", async () => {
      const formData = new FormData();
      formData.append("_action", "editPost");
      // Missing postId

      const result = await handleScheduledPostAction(formData, TEST_USER_ID);

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.error).toContain("Missing postId");
    });
  });

  describe("handleRescheduleLongform", () => {
    it("should reschedule a longform post using ScheduleLongFormPostUseCase", async () => {
      const mockLongformPost = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        isScheduled: true,
      };

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongformPost
      );
      (updateLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongformPost
      );

      const formData = new FormData();
      formData.append("_action", "rescheduleLongform");
      formData.append("postId", TEST_LONGFORM_ID);
      formData.append("newTime", "1704110400");
      formData.append(
        "signedEvent",
        JSON.stringify({
          id: "event-123",
          pubkey: "pk-123",
          created_at: 1704110400,
          kind: 1,
          content: "test",
          tags: [],
          sig: "sig-123",
        })
      );
      formData.append(
        "nostrEvent",
        JSON.stringify({
          id: "event-123",
          pubkey: "pk-123",
          created_at: 1704110400,
          kind: 1,
          content: "test",
          tags: [],
          sig: "sig-123",
        })
      );

      const result = await handleScheduledPostAction(formData, TEST_USER_ID);

      expect(getLongFormPost).toHaveBeenCalledWith({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });
      // handleRescheduleLongform doesn't cancel first, it just schedules
      expect(mockScheduleLongFormExecute).toHaveBeenCalled();
      expect(updateLongFormPost).toHaveBeenCalled();

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.signed).toBe(true);
    });
  });
});
