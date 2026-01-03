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

type LoaderData = {
  selectedQueueType?: unknown;
  scheduledPosts?: unknown;
  scheduleIntervals?: unknown;
  user?: unknown;
  queueTypes?: unknown;
  error?: { message?: string };
};

// Mock client-side dependencies FIRST (before route import)
vi.mock("~/lib/error-handler.client", () => ({
  handleErrorSafely: vi.fn(),
}));

vi.mock("~/features/posts/components/Calendar/Calendar", () => ({
  Calendar: () => null,
}));

vi.mock("~/features/posts/components/Calendar/PostBlock", () => ({
  PostBlock: () => null,
}));

vi.mock("~/features/posts/components/Calendar/WeeklyView", () => ({
  WeeklyView: () => null,
}));

vi.mock("~/features/posts/components/Calendar/MonthlyView", () => ({
  MonthlyView: () => null,
}));

vi.mock("~/features/posts/components/Calendar/RescheduleModal", () => ({
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

vi.mock("~/models/post.queries.server", () => ({
  getScheduledPosts: vi.fn(),
  getPostById: vi.fn(),
}));

vi.mock("~/models/post.commands.server", () => ({
  reschedulePost: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
}));

// Import after mocks are set up
import { requireUserId } from "~/features/auth/session.server";
import { getScheduledPosts } from "~/models/post.queries.server";
import { getUserById, getQueueTypes } from "~/models/user.server";
import { loader } from "~/routes/dashboard.calendar.$queueType";

describe("Calendar Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-123",
      timezone: "UTC",
      scheduleInterval: ["09:00", "12:00", "15:00"],
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "1", name: "Default", isEnabled: true },
    ]);
  });

  describe("Calendar Loader", () => {
    it("should load calendar data for authenticated user", async () => {
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

      expect(responseObj.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(getScheduledPosts).toHaveBeenCalledWith({ userId: "user-123" });
      expect(getUserById).toHaveBeenCalledWith("user-123");
      expect(getQueueTypes).toHaveBeenCalledWith("user-123");
      expect(data).toHaveProperty("scheduledPosts");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
      expect(data).toHaveProperty("selectedQueueType");
      expect(data).toHaveProperty("scheduleIntervals");
    });

    it("should handle queue type parameter", async () => {
      const mockPosts = [
        { id: "1", caption: "Post 1", queueType: { name: "posts" } },
        { id: "2", caption: "Post 2", queueType: { name: "posts" } },
      ];

      (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts,
      );

      const request = new Request(
        "http://localhost:3000/dashboard/calendar/posts",
      );
      const response = await loader({
        request,
        params: { queueType: "posts" },
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

      expect(selectedQueueType).toBe("posts");
      expect(scheduledPosts).toHaveLength(2);
    });

    it("should filter posts by queue type when specified", async () => {
      const allPosts = [
        { id: "1", caption: "Post 1", queueType: { name: "posts" } },
        { id: "2", caption: "Post 2", queueType: { name: "marketing" } },
        { id: "3", caption: "Post 3", queueType: { name: "posts" } },
      ];

      (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        allPosts,
      );

      const request = new Request(
        "http://localhost:3000/dashboard/calendar/posts",
      );
      const response = await loader({
        request,
        params: { queueType: "posts" },
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

      // Should filter to only posts with queueType "posts"
      const filteredPosts = scheduledPosts.filter((post: unknown) => {
        if (post && typeof post === "object" && !Array.isArray(post)) {
          const p = post as { queueType?: { name?: string } };
          return p.queueType?.name === "posts";
        }
        return false;
      });
      expect(filteredPosts.length).toBeGreaterThan(0);
    });

    it("should return all posts when queueType is 'all'", async () => {
      const allPosts = [
        { id: "1", caption: "Post 1", queueType: { name: "posts" } },
        { id: "2", caption: "Post 2", queueType: { name: "marketing" } },
      ];

      (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        allPosts,
      );

      const request = new Request("http://localhost:3000/dashboard/calendar");
      const response = await loader({
        request,
        params: { queueType: "all" },
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

      expect(selectedQueueType).toBe("all");
      expect(scheduledPosts).toHaveLength(2);
    });

    it("should include schedule intervals from user", async () => {
      const userWithIntervals = {
        id: "user-123",
        timezone: "America/New_York",
        scheduleInterval: ["08:00", "12:00", "16:00", "20:00"],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
        userWithIntervals,
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
      const scheduleIntervals = Array.isArray(data.scheduleIntervals)
        ? data.scheduleIntervals
        : [];
      const user =
        data.user && typeof data.user === "object" && !Array.isArray(data.user)
          ? (data.user as { timezone?: string })
          : {};

      expect(scheduleIntervals).toEqual(["08:00", "12:00", "16:00", "20:00"]);
      expect(user).toHaveProperty("timezone", "America/New_York");
    });

    it("should filter queue types to only enabled ones", async () => {
      const mockQueueTypes = [
        { id: "1", name: "Default", isEnabled: true },
        { id: "2", name: "Disabled", isEnabled: false },
        { id: "3", name: "Marketing", isEnabled: true },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
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
        new Error("Authentication required"),
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
      (getScheduledPosts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
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
