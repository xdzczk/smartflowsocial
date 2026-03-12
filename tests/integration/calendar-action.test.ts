/**
 * Integration tests for calendar action handlers
 * Tests app/features/posts/services/calendar-action.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockSchedulePostExecute, mockScheduleLongFormExecute } = vi.hoisted(
  () => {
    const mockSchedulePostExecute = vi.fn();
    const mockScheduleLongFormExecute = vi.fn();
    return { mockSchedulePostExecute, mockScheduleLongFormExecute };
  }
);

vi.mock("~/features/posts/scheduling/index.server", () => ({
  SchedulePostUseCase: class {
    execute = mockSchedulePostExecute;
  },
}));

vi.mock("~/lib/error-logger.server", () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

// Handler imports from ~/features/posts/server and ~/features/posts/server/longform
vi.mock("~/features/posts/server", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getLongFormPost: vi.fn(),
    updateLongFormPost: vi.fn(),
    reschedulePost: vi.fn(),
    getPostById: vi.fn(),
  };
});

vi.mock("~/features/posts/server/longform", () => ({
  ScheduleLongFormPostUseCase: class {
    execute = mockScheduleLongFormExecute;
  },
}));

import {
  createFormData,
  TEST_USER_ID,
  TEST_POST_ID,
  TEST_LONGFORM_ID,
} from "../utils/test-helpers";

import {
  handleCalendarAction,
  handleCalendarReschedule,
  handleCalendarRescheduleLongform,
} from "~/features/posts/calendar/index.server";
import { getLongFormPost, updateLongFormPost } from "~/features/posts/server";
import { reschedulePost } from "~/features/posts/server";
import { getPostById } from "~/features/posts/server";

const TEST_SESSION_PUBKEY = "pk-123";

describe("Calendar Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleCalendarAction", () => {
    it("should route to handleCalendarReschedule for 'reschedule' action", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (reschedulePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const formData = createFormData({
        action: "reschedule",
        postId: TEST_POST_ID,
        newTime: String(Math.floor(Date.now() / 1000) + 3600),
      });

      const result = await handleCalendarAction(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(getPostById).toHaveBeenCalled();
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.success).toBe(true);
    });

    it("should route to handleCalendarRescheduleLongform for 'rescheduleLongform' action", async () => {
      const mockLongFormPost = { id: TEST_LONGFORM_ID, userId: TEST_USER_ID };
      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongFormPost
      );
      (updateLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongFormPost
      );

      const formData = createFormData({
        action: "rescheduleLongform",
        postId: TEST_LONGFORM_ID,
        newTime: String(Math.floor(Date.now() / 1000) + 3600),
      });

      const result = await handleCalendarAction(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(getLongFormPost).toHaveBeenCalled();
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.success).toBe(true);
    });

    it("should return error for invalid action", async () => {
      const formData = createFormData({
        action: "invalidAction",
      });

      const result = await handleCalendarAction(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.error).toBe("Invalid action");
    });
  });

  describe("handleCalendarReschedule", () => {
    it("should reschedule a post successfully", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      const newTime = String(Math.floor(Date.now() / 1000) + 3600);

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (reschedulePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const formData = createFormData({
        action: "reschedule",
        postId: TEST_POST_ID,
        newTime,
        overrideQueue: "false",
      });

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(getPostById).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(reschedulePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        scheduledAtUtc: parseInt(newTime, 10),
        overrideQueue: false,
      });

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.needsSigning).toBe(true);
    });

    it("should reschedule with signed events", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      const newTime = String(Math.floor(Date.now() / 1000) + 3600);
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: "test",
        tags: [],
        sig: "sig-123",
      };
      const nostrEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: "test",
        tags: [],
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (reschedulePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const formData = createFormData({
        action: "reschedule",
        postId: TEST_POST_ID,
        newTime,
        overrideQueue: "false",
        signedEvent: JSON.stringify(signedEvent),
        nostrEvent: JSON.stringify(nostrEvent),
      });

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(reschedulePost).toHaveBeenCalledWith(
        expect.objectContaining({
          signedEvent,
          nostrEvent,
        })
      );
      expect(mockSchedulePostExecute).toHaveBeenCalled();

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.signed).toBe(true);
    });

    it("should handle overrideQueue flag", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      const newTime = String(Math.floor(Date.now() / 1000) + 3600);

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (reschedulePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const formData = createFormData({
        action: "reschedule",
        postId: TEST_POST_ID,
        newTime,
        overrideQueue: "true",
      });

      await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(reschedulePost).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideQueue: true,
        })
      );
    });

    it("should return error for missing postId", async () => {
      const formData = createFormData({
        newTime: String(Math.floor(Date.now() / 1000) + 3600),
      });

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      // Zod validation returns error response
      expect(result).toBeInstanceOf(Response);
      expect(jsonResult).toHaveProperty("error");
      expect(String(jsonResult.error)).toBeTruthy();
    });

    it("should return error for missing newTime", async () => {
      const formData = createFormData({
        action: "reschedule",
        postId: TEST_POST_ID,
      });

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      // Zod validation returns error response
      expect(result).toBeInstanceOf(Response);
      expect(jsonResult).toHaveProperty("error");
      expect(String(jsonResult.error)).toBeTruthy();
    });

    it("should return error if post not found", async () => {
      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const formData = createFormData({
        action: "reschedule",
        postId: TEST_POST_ID,
        newTime: String(Math.floor(Date.now() / 1000) + 3600),
      });

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.error).toBe("Post not found");
    });

    it("should handle invalid JSON in signed events gracefully", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      const newTime = String(Math.floor(Date.now() / 1000) + 3600);

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (reschedulePost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      const formData = createFormData({
        action: "reschedule",
        postId: TEST_POST_ID,
        newTime,
        signedEvent: "invalid-json",
        nostrEvent: "invalid-json",
      });

      const result = await handleCalendarReschedule(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      // Should still succeed but without signed events
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.needsSigning).toBe(true);
    });
  });

  describe("handleCalendarRescheduleLongform", () => {
    it("should reschedule a longform post successfully", async () => {
      const mockLongFormPost = { id: TEST_LONGFORM_ID, userId: TEST_USER_ID };
      const newTime = String(Math.floor(Date.now() / 1000) + 3600);

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongFormPost
      );
      (updateLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongFormPost
      );

      const formData = createFormData({
        action: "rescheduleLongform",
        postId: TEST_LONGFORM_ID,
        newTime,
      });

      const result = await handleCalendarRescheduleLongform(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(getLongFormPost).toHaveBeenCalledWith({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });
      expect(updateLongFormPost).toHaveBeenCalledWith({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        scheduledAtUtc: parseInt(newTime, 10),
        signedEvent: null,
        nostrEvent: null,
      });

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.signed).toBe(false);
    });

    it("should reschedule with signed events", async () => {
      const mockLongFormPost = { id: TEST_LONGFORM_ID, userId: TEST_USER_ID };
      const newTime = String(Math.floor(Date.now() / 1000) + 3600);
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        content: "test",
        tags: [],
        sig: "sig-123",
      };
      const nostrEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        content: "test",
        tags: [],
      };

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongFormPost
      );
      (updateLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongFormPost
      );

      const formData = createFormData({
        action: "rescheduleLongform",
        postId: TEST_LONGFORM_ID,
        newTime,
        signedEvent: JSON.stringify(signedEvent),
        nostrEvent: JSON.stringify(nostrEvent),
      });

      const result = await handleCalendarRescheduleLongform(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      expect(updateLongFormPost).toHaveBeenCalledWith({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        scheduledAtUtc: parseInt(newTime, 10),
        signedEvent,
        nostrEvent,
      });

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.signed).toBe(true);
    });

    it("should return error for missing postId", async () => {
      const formData = createFormData({
        action: "rescheduleLongform",
        newTime: String(Math.floor(Date.now() / 1000) + 3600),
      });

      const result = await handleCalendarRescheduleLongform(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      // Zod validation returns error response
      expect(result).toBeInstanceOf(Response);
      expect(jsonResult).toHaveProperty("error");
      expect(String(jsonResult.error)).toBeTruthy();
    });

    it("should return error for missing newTime", async () => {
      const formData = createFormData({
        action: "rescheduleLongform",
        postId: TEST_LONGFORM_ID,
      });

      const result = await handleCalendarRescheduleLongform(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      // Zod validation returns error response
      expect(result).toBeInstanceOf(Response);
      expect(jsonResult).toHaveProperty("error");
      expect(String(jsonResult.error)).toBeTruthy();
    });

    it("should return error if longform post not found", async () => {
      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const formData = createFormData({
        action: "rescheduleLongform",
        postId: TEST_LONGFORM_ID,
        newTime: String(Math.floor(Date.now() / 1000) + 3600),
      });

      const result = await handleCalendarRescheduleLongform(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.error).toBe("Article not found");
    });

    it("should handle invalid JSON in signed events gracefully", async () => {
      const mockLongFormPost = { id: TEST_LONGFORM_ID, userId: TEST_USER_ID };
      const newTime = String(Math.floor(Date.now() / 1000) + 3600);

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongFormPost
      );
      (updateLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongFormPost
      );

      const formData = createFormData({
        action: "rescheduleLongform",
        postId: TEST_LONGFORM_ID,
        newTime,
        signedEvent: "invalid-json",
        nostrEvent: "invalid-json",
      });

      const result = await handleCalendarRescheduleLongform(
        formData,
        TEST_USER_ID,
        TEST_SESSION_PUBKEY
      );

      // Should still succeed but without signed events
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as {
              success?: boolean;
              error?: string;
              needsSigning?: boolean;
              signed?: boolean;
            })
          : {};
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.signed).toBe(false);
    });
  });
});
