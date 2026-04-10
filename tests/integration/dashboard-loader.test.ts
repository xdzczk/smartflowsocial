/**
 * Integration tests for dashboard loader
 *
 * These tests verify the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/dashboard.cy.ts
 *
 * Migrated from: tests/e2e/loaders/dashboard-loader.cy.ts
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock Prisma to prevent $use errors
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    $use: vi.fn(),
  },
}));

// Mock the dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/payments/subscriptions.server", () => ({
  requireAnySubscription: vi.fn(),
}));

vi.mock("~/features/posts/server", () => ({
  loadFlowData: vi.fn(),
  handleDashboardAction: vi.fn(),
  getContentStatistics: vi.fn(),
  getDraftCountForDashboard: vi.fn(),
  deriveDashboardActivitySummary: vi.fn(),
  getQueueCountsForDashboard: vi.fn(),
  getRunwayLastScheduledAtUtcMs: vi.fn(),
  getScheduleNext7DaysCounts: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getRunwaySettings: vi.fn(),
}));

// Avoid pulling in full posts UI (calendar, hooks) which need React Query etc.
vi.mock("~/features/posts/ui", () => ({
  DashboardIndexPage: () => null,
}));

import { userFactory } from "../factories";

import { requireUserId } from "~/features/auth/session.server";
import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import {
  loadFlowData,
  getContentStatistics,
  getDraftCountForDashboard,
  deriveDashboardActivitySummary,
  getQueueCountsForDashboard,
  getRunwayLastScheduledAtUtcMs,
  getScheduleNext7DaysCounts,
} from "~/features/posts/server";
import { getRunwaySettings } from "~/features/user";
import { loader } from "~/routes/dashboard._index";

describe("Dashboard Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (loadFlowData as ReturnType<typeof vi.fn>).mockResolvedValue({
      flowItems: [],
      hasMorePast: false,
      hasMoreFuture: false,
      pastCursor: null,
      futureCursor: null,
      user: userFactory.basic({ id: "user-123" }),
      queueTypes: [],
      hashTagPresets: [],
    });
    (getContentStatistics as ReturnType<typeof vi.fn>).mockResolvedValue({
      scheduledCount: 0,
      successCount: 0,
    });
    (getDraftCountForDashboard as ReturnType<typeof vi.fn>).mockResolvedValue(
      0
    );
    (getQueueCountsForDashboard as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );
    (
      deriveDashboardActivitySummary as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      draftCount: 0,
      hasDrafts: false,
      hasScheduled: false,
      hasPublished: false,
      hasQueuesWithContent: false,
      isFirstRunDashboard: true,
    });
    (
      getRunwayLastScheduledAtUtcMs as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (getScheduleNext7DaysCounts as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );
    (getRunwaySettings as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
  });

  describe("Dashboard Index Loader", () => {
    it("should load dashboard data for authenticated user", async () => {
      const request = new Request("http://localhost:3000/dashboard");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(response.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(loadFlowData).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          queueType: "all",
        })
      );
      expect(data).toHaveProperty("flowItems");
      expect(data).toHaveProperty("hasMorePast");
      expect(data).toHaveProperty("hasMoreFuture");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
    });

    it("should handle queue type parameter", async () => {
      const request = new Request("http://localhost:3000/dashboard");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: { queueType: "posts" },
      } as unknown as LoaderFunctionArgs;
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(loadFlowData).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          queueType: "posts",
        })
      );
      expect(data).toBeDefined();
    });

    it("should return proper Flow data structure", async () => {
      const mockUser = userFactory.basic({
        id: "user-123",
        timezone: "America/New_York",
      });
      const mockData = {
        flowItems: [],
        hasMorePast: false,
        hasMoreFuture: false,
        pastCursor: null,
        futureCursor: null,
        user: mockUser,
        queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
        hashTagPresets: [],
      };

      (loadFlowData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("flowItems");
      expect(Array.isArray(data["flowItems"])).toBe(true);
      expect(data).toHaveProperty("hasMorePast", false);
      expect(data).toHaveProperty("hasMoreFuture", false);
      expect(data["user"]).toBeDefined();
      expect(data).toHaveProperty("queueTypes");
      expect(Array.isArray(data["queueTypes"])).toBe(true);
    });

    it("should expose first-run dashboard state for new users", async () => {
      const request = new Request("http://localhost:3000/dashboard");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(getDraftCountForDashboard).toHaveBeenCalledWith("user-123");
      expect(deriveDashboardActivitySummary).toHaveBeenCalledWith({
        draftCount: 0,
        postStatistics: { scheduledCount: 0, successCount: 0 },
        queueCountsByQueue: [],
      });
      expect(data["isFirstRunDashboard"]).toBe(true);
      expect(data["dashboardActivity"]).toEqual(
        expect.objectContaining({
          hasDrafts: false,
          hasScheduled: false,
          hasPublished: false,
          hasQueuesWithContent: false,
        })
      );
    });

    it("should disable first-run dashboard when user has activity", async () => {
      (
        deriveDashboardActivitySummary as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        draftCount: 1,
        hasDrafts: true,
        hasScheduled: false,
        hasPublished: false,
        hasQueuesWithContent: false,
        isFirstRunDashboard: false,
      });
      (getDraftCountForDashboard as ReturnType<typeof vi.fn>).mockResolvedValue(
        1
      );

      const request = new Request("http://localhost:3000/dashboard");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(data["isFirstRunDashboard"]).toBe(false);
      expect(data["dashboardActivity"]).toEqual(
        expect.objectContaining({
          draftCount: 1,
          hasDrafts: true,
          isFirstRunDashboard: false,
        })
      );
    });
  });

  describe("Dashboard Queue Filtering", () => {
    it("should handle 'all' queue type", async () => {
      const request = new Request(
        "http://localhost:3000/dashboard?queueType=all"
      );
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);

      expect(response.status).toBe(200);
      expect(loadFlowData).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          queueType: "all",
        })
      );
    });

    it("should handle 'posts' queue type", async () => {
      const request = new Request(
        "http://localhost:3000/dashboard?queueType=posts"
      );
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);

      expect(response.status).toBe(200);
      expect(loadFlowData).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          queueType: "posts",
        })
      );
    });

    it("should handle 'longform' queue type", async () => {
      const request = new Request(
        "http://localhost:3000/dashboard?queueType=longform"
      );
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);

      expect(response.status).toBe(200);
      expect(loadFlowData).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          queueType: "longform",
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Response("Authentication required", { status: 401 })
      );

      const request = new Request("http://localhost:3000/dashboard");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      const response = await loader(loaderArgs);
      expect(response.status).toBe(401);
    });

    it("should handle feature access errors", async () => {
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Response("Feature access denied", { status: 403 })
      );

      const request = new Request("http://localhost:3000/dashboard");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      const response = await loader(loaderArgs);
      expect(response.status).toBe(403);
    });

    it("should handle data loading errors", async () => {
      (loadFlowData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/dashboard");

      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      expect(response.status).toBe(500);
    });
  });
});
