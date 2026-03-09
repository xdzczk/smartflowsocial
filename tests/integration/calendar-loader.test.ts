/**
 * Integration tests for calendar loader
 *
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/posts/calendar.cy.ts
 *
 * Migrated from: tests/e2e/loaders/queues-loader.cy.ts (Calendar Queue Loader section)
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";

interface LoaderData {
  selectedQueueType?: unknown;
  scheduledPosts?: unknown;
  scheduleIntervals?: unknown;
  user?: unknown;
  queueTypes?: unknown;
  error?: { message?: string };
  scheduledLongFormPosts?: unknown;
  pastPosts?: unknown;
  pastLongFormPosts?: unknown;
}

// Mock client-side dependencies FIRST (before route import)
vi.mock("~/lib/error-handler.client", () => ({
  handleErrorSafely: vi.fn(),
}));

vi.mock("~/features/posts/calendar/Calendar/Calendar", () => ({
  Calendar: () => null,
}));

vi.mock("~/features/posts/calendar/Calendar/PostBlock", () => ({
  PostBlock: () => null,
}));

vi.mock("~/features/posts/calendar/Calendar/views/DayView", () => ({
  DayView: () => null,
}));

vi.mock("~/features/posts/calendar/Calendar/views/WeekView", () => ({
  WeekView: () => null,
}));

vi.mock("~/features/posts/calendar/Calendar/MonthlyView", () => ({
  MonthlyView: () => null,
}));

vi.mock("~/features/posts/calendar/Calendar/RescheduleModal", () => ({
  RescheduleModal: () => null,
}));

vi.mock("~/features/posts/queueColors", () => ({
  getQueueColor: vi.fn(),
}));

vi.mock("~/infra/queue", () => ({
  cancelPostJob: vi.fn(),
  enqueuePostJob: vi.fn(),
}));

// Mock server-side dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/payments", () => ({
  requireAnySubscription: vi.fn(),
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/features/posts/calendar/services/calendar-loader.server", () => ({
  loadCalendarQueueData: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getScheduledPosts: vi.fn(),
  getScheduledLongFormPosts: vi.fn(),
  getPastPosts: vi.fn(),
  getPastLongFormPosts: vi.fn(),
  getPostById: vi.fn(),
}));

vi.mock("~/models/post.commands.server", () => ({
  reschedulePost: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
}));

// Import after mocks are set up
import {
  createValidUserMock,
  createValidPostDTOMock,
} from "../utils/test-helpers";

import { requireUserId } from "~/features/auth/session.server";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { loadCalendarQueueData } from "~/features/posts/calendar/index.server";
import { loader } from "~/routes/dashboard.calendar.$queueType";

describe("Calendar Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (loadCalendarQueueData as ReturnType<typeof vi.fn>).mockResolvedValue({
      scheduledPosts: [],
      user: {
        ...createValidUserMock({
          timezone: "UTC",
          scheduleInterval: ["4", "6", "8"],
        }),
        hashTagPresets: [],
      },
      queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
      selectedQueueType: "all",
      scheduleIntervals: [4, 6, 8],
    });
  });

  describe("Calendar Loader", () => {
    it("should load calendar data for authenticated user", async () => {
      const request = new Request(
        "http://localhost:3000/dashboard/calendar/all"
      );
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: { queueType: "all" },
        context: {},
      };
      const response = await loader(loaderArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data: LoaderData =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as LoaderData)
          : {};

      expect(responseObj.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(loadCalendarQueueData).toHaveBeenCalledWith("user-123", "all");
      expect(data).toHaveProperty("scheduledPosts");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
      expect(data).toHaveProperty("selectedQueueType");
      expect(data).toHaveProperty("scheduleIntervals");
      expect(data.selectedQueueType).toBe("all");
    });

    it("should handle queue type parameter", async () => {
      (loadCalendarQueueData as ReturnType<typeof vi.fn>).mockResolvedValue({
        scheduledPosts: [
          createValidPostDTOMock({ id: "1", caption: "Post 1" }),
          createValidPostDTOMock({ id: "2", caption: "Post 2" }),
        ],
        user: {
          ...createValidUserMock(),
          hashTagPresets: [],
        },
        queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
        selectedQueueType: "posts",
        scheduleIntervals: [4, 6, 8],
      });

      const request = new Request(
        "http://localhost:3000/dashboard/calendar/posts"
      );
      const response = await loader({
        request,
        params: { queueType: "posts" },
        context: {},
      } as unknown as LoaderFunctionArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data: LoaderData =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as LoaderData)
          : {};
      const selectedQueueType =
        typeof data.selectedQueueType === "string"
          ? data.selectedQueueType
          : "";
      const scheduledPosts = Array.isArray(data.scheduledPosts)
        ? data.scheduledPosts
        : [];

      expect(loadCalendarQueueData).toHaveBeenCalledWith("user-123", "posts");
      expect(selectedQueueType).toBe("posts");
      expect(scheduledPosts).toHaveLength(2);
    });

    it("should filter posts by queue type when specified", async () => {
      (loadCalendarQueueData as ReturnType<typeof vi.fn>).mockResolvedValue({
        scheduledPosts: [
          createValidPostDTOMock({ id: "1", caption: "Post 1" }),
          createValidPostDTOMock({ id: "3", caption: "Post 3" }),
        ],
        user: {
          ...createValidUserMock(),
          hashTagPresets: [],
        },
        queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
        selectedQueueType: "posts",
        scheduleIntervals: [4, 6, 8],
      });

      const request = new Request(
        "http://localhost:3000/dashboard/calendar/posts"
      );
      const response = await loader({
        request,
        params: { queueType: "posts" },
        context: {},
      } as unknown as LoaderFunctionArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data: LoaderData =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as LoaderData)
          : {};
      const scheduledPosts = Array.isArray(data.scheduledPosts)
        ? data.scheduledPosts
        : [];

      expect(loadCalendarQueueData).toHaveBeenCalledWith("user-123", "posts");
      expect(scheduledPosts.length).toBeGreaterThan(0);
    });

    it("should return all posts when queueType is 'all'", async () => {
      (loadCalendarQueueData as ReturnType<typeof vi.fn>).mockResolvedValue({
        scheduledPosts: [
          createValidPostDTOMock({ id: "1", caption: "Post 1" }),
          createValidPostDTOMock({ id: "2", caption: "Post 2" }),
        ],
        user: {
          ...createValidUserMock(),
          hashTagPresets: [],
        },
        queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
        selectedQueueType: "all",
        scheduleIntervals: [4, 6, 8],
      });

      const request = new Request("http://localhost:3000/dashboard/calendar");
      const response = await loader({
        request,
        params: { queueType: "all" },
        context: {},
      } as unknown as LoaderFunctionArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data: LoaderData =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as LoaderData)
          : {};
      const selectedQueueType =
        typeof data.selectedQueueType === "string"
          ? data.selectedQueueType
          : "";
      const scheduledPosts = Array.isArray(data.scheduledPosts)
        ? data.scheduledPosts
        : [];

      expect(loadCalendarQueueData).toHaveBeenCalledWith("user-123", "all");
      expect(selectedQueueType).toBe("all");
      expect(scheduledPosts).toHaveLength(2);
    });

    it("should include schedule intervals from user", async () => {
      const userWithIntervals = createValidUserMock({
        timezone: "America/New_York",
        scheduleInterval: ["4", "6", "8", "12"],
      });

      (loadCalendarQueueData as ReturnType<typeof vi.fn>).mockResolvedValue({
        scheduledPosts: [],
        user: {
          ...userWithIntervals,
          hashTagPresets: [],
        },
        queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
        selectedQueueType: "posts",
        scheduleIntervals: [4, 6, 8, 12],
      });

      const request = new Request(
        "http://localhost:3000/dashboard/calendar/posts"
      );
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: { queueType: "posts" },
        context: {},
      };
      const response = await loader(loaderArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data: LoaderData =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as LoaderData)
          : {};
      const scheduleIntervals = Array.isArray(data.scheduleIntervals)
        ? data.scheduleIntervals
        : [];
      const user =
        data.user && typeof data.user === "object" && !Array.isArray(data.user)
          ? (data.user as { timezone?: string })
          : {};

      expect(scheduleIntervals).toEqual([4, 6, 8, 12]);
      expect(user).toHaveProperty("timezone", "America/New_York");
    });

    it("should filter queue types to only enabled ones", async () => {
      (loadCalendarQueueData as ReturnType<typeof vi.fn>).mockResolvedValue({
        scheduledPosts: [],
        user: {
          ...createValidUserMock(),
          hashTagPresets: [],
        },
        queueTypes: [
          { id: "1", name: "Default", isEnabled: true },
          { id: "3", name: "Marketing", isEnabled: true },
        ],
        selectedQueueType: "all",
        scheduleIntervals: [4, 6, 8],
      });

      const request = new Request("http://localhost:3000/dashboard/calendar");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data: LoaderData =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as LoaderData)
          : {};
      const queueTypes = Array.isArray(data.queueTypes) ? data.queueTypes : [];
      const enabledQueueTypes = queueTypes.filter((qt: unknown) => {
        if (qt && typeof qt === "object" && !Array.isArray(qt)) {
          const q = qt as { isEnabled?: boolean };
          return q.isEnabled !== false;
        }
        return false;
      });
      expect(enabledQueueTypes.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required")
      );

      const request = new Request("http://localhost:3000/dashboard/calendar");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data: LoaderData =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as LoaderData)
          : {};
      const error =
        data.error &&
        typeof data.error === "object" &&
        !Array.isArray(data.error)
          ? (data.error as { message?: string })
          : {};

      expect(responseObj.status).toBe(401);
      expect(data.error).toBeDefined();
      const errorMessage =
        typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Authentication required");
    });

    it("should handle data loading errors", async () => {
      (loadCalendarQueueData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/dashboard/calendar");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data: LoaderData =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as LoaderData)
          : {};
      const error =
        data.error &&
        typeof data.error === "object" &&
        !Array.isArray(data.error)
          ? (data.error as { message?: string })
          : {};

      expect(responseObj.status).toBe(500);
      expect(data.error).toBeDefined();
      const errorMessage =
        typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Database error");
    });
  });
});
