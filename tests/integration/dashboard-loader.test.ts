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
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/features/posts/server", () => ({
  loadFlowData: vi.fn(),
  handleDashboardAction: vi.fn(),
}));

import { createValidUserMock } from "../utils/test-helpers";

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import { loadFlowData } from "~/features/posts/server";
import { loader } from "~/routes/dashboard._index";

describe("Dashboard Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (loadFlowData as ReturnType<typeof vi.fn>).mockResolvedValue({
      flowItems: [],
      hasMorePast: false,
      hasMoreFuture: false,
      pastCursor: null,
      futureCursor: null,
      user: createValidUserMock(),
      queueTypes: [],
      hashTagPresets: [],
    });
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
      expect(requireFeatureAccess).toHaveBeenCalledWith(
        "user-123",
        "dashboard"
      );
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
      const mockUser = createValidUserMock({ timezone: "America/New_York" });
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
      const user =
        data["user"] &&
        typeof data["user"] === "object" &&
        !Array.isArray(data["user"])
          ? (data["user"] as { timezone?: unknown })
          : {};
      expect(user).toHaveProperty("timezone", "America/New_York");
      const queueTypes = Array.isArray(data["queueTypes"])
        ? data["queueTypes"]
        : [];
      expect(queueTypes).toHaveLength(1);
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
      (requireFeatureAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
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
