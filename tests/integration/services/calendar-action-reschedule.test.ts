/**
 * Integration tests for Calendar Action Reschedule
 * Tests app/features/posts/services/calendar-action.server.ts reschedule handlers
 * that use CancelScheduleUseCase
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies - use vi.hoisted to allow top-level variables in mocks
const { mockSchedulePostExecute } = vi.hoisted(() => {
  const mockSchedulePostExecute = vi.fn();
  return { mockSchedulePostExecute };
});

vi.mock("~/features/posts/scheduling/index.server", () => ({
  SchedulePostUseCase: class {
    execute = mockSchedulePostExecute;
  },
}));

vi.mock("~/models/post.queries.server", () => ({
  getPostById: vi.fn(),
}));

vi.mock("~/models/post.commands.server", () => ({
  reschedulePost: vi.fn(),
}));

vi.mock("~/lib/validation", () => ({
  calendarRescheduleSchema: {},
  validateFormDataOrRespond: vi.fn(),
}));

// CancelScheduleUseCase is mocked above
import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { handleCalendarReschedule } from "~/features/posts/calendar/index.server";
import { validateFormDataOrRespond } from "~/lib/validation";
import { reschedulePost } from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";

const TEST_SESSION_PUBKEY = "pk-123";

describe("Calendar Action Reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchedulePostExecute.mockResolvedValue(undefined);
  });

  describe("handleCalendarReschedule", () => {
    it("should reschedule a post using CancelScheduleUseCase", async () => {
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

      (validateFormDataOrRespond as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: {
          postId: TEST_POST_ID,
          newTime: "1704110400", // 2024-01-01T12:00:00Z
          overrideQueue: false,
          signedEvent: JSON.stringify({
            id: "event-123",
            pubkey: "pk-123",
            created_at: 1704110400,
            kind: 1,
            content: "test",
            tags: [],
            sig: "sig-123",
          }),
          nostrEvent: JSON.stringify({
            id: "event-123",
            pubkey: "pk-123",
            created_at: 1704110400,
            kind: 1,
            content: "test",
            tags: [],
          }),
        },
      });

      const formData = new FormData();
      formData.append("postId", TEST_POST_ID);
      formData.append("newTime", "1704110400");

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(getPostById).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(reschedulePost).toHaveBeenCalled();
      expect(mockSchedulePostExecute).toHaveBeenCalled();

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
    });

    it("should return error if post not found", async () => {
      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      (validateFormDataOrRespond as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: {
          postId: TEST_POST_ID,
          newTime: "1704110400",
          overrideQueue: false,
        },
      });

      const formData = new FormData();
      formData.append("postId", TEST_POST_ID);
      formData.append("newTime", "1704110400");

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

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
      expect(mockSchedulePostExecute).not.toHaveBeenCalled();
    });

    it("should return validation error for invalid form data", async () => {
      (validateFormDataOrRespond as ReturnType<typeof vi.fn>).mockReturnValue({
        success: false,
        response: new Response(JSON.stringify({ error: "Validation failed" }), {
          status: 400,
        }),
      });

      const formData = new FormData();
      // Missing required fields

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(result).toBeInstanceOf(Response);
      const responseObj = result;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.error).toBe("Validation failed");
      expect(mockSchedulePostExecute).not.toHaveBeenCalled();
    });

    it("should handle missing signed events gracefully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isScheduled: true,
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (reschedulePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      (validateFormDataOrRespond as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: {
          postId: TEST_POST_ID,
          newTime: "1704110400",
          overrideQueue: false,
          // No signedEvent or nostrEvent
        },
      });

      const formData = new FormData();
      formData.append("postId", TEST_POST_ID);
      formData.append("newTime", "1704110400");

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(mockSchedulePostExecute).not.toHaveBeenCalled();
      expect(reschedulePost).toHaveBeenCalled();
      expect(mockSchedulePostExecute).not.toHaveBeenCalled(); // No signed event, so no scheduling

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
    });
  });
});
