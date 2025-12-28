/**
 * Integration tests for dashboard loader
 * 
 * These tests verify the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/dashboard.cy.ts
 * 
 * Migrated from: tests/e2e/loaders/dashboard-loader.cy.ts
 */

import { json } from "@remix-run/node";
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

vi.mock("~/features/posts/services/dashboard-loader.server", () => ({
  loadDashboardData: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import { loadDashboardData } from "~/features/posts/services/dashboard-loader.server";
import { loader } from "~/routes/dashboard._index";

describe("Dashboard Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (loadDashboardData as ReturnType<typeof vi.fn>).mockResolvedValue({
      scheduledPosts: [],
      longformPosts: [],
      allContent: [],
      user: { id: "user-123", timezone: "UTC" },
      queueTypes: [],
      hashTagPresets: [],
    });
  });

  describe("Dashboard Index Loader", () => {
    it("should load dashboard data for authenticated user", async () => {
      const request = new Request("http://localhost:3000/dashboard");
      const response = await loader({ request, params: {}, context: {} } as LoaderFunctionArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as Record<string, unknown> : {};

      expect(response.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(requireFeatureAccess).toHaveBeenCalledWith("user-123", "dashboard");
      expect(loadDashboardData).toHaveBeenCalledWith("user-123", "all");
      expect(data).toHaveProperty("scheduledPosts");
      expect(data).toHaveProperty("longformPosts");
      expect(data).toHaveProperty("allContent");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
    });

    it("should handle queue type parameter", async () => {
      const request = new Request("http://localhost:3000/dashboard");
      const response = await loader({ 
        request, 
        params: { queueType: "posts" } 
      } as unknown as LoaderFunctionArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as Record<string, unknown> : {};

      expect(loadDashboardData).toHaveBeenCalledWith("user-123", "posts");
      expect(data).toBeDefined();
    });

    it("should handle planActivated query parameter", async () => {
      const request = new Request("http://localhost:3000/dashboard?planActivated=true");
      const response = await loader({ request, params: {}, context: {} } as LoaderFunctionArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as Record<string, unknown> : {};

      const planActivated = typeof data.planActivated === "string" ? data.planActivated : "";
      expect(planActivated).toBe("true");
    });

    it("should handle successMessage query parameter", async () => {
      const request = new Request("http://localhost:3000/dashboard?message=success");
      const response = await loader({ request, params: {}, context: {} } as LoaderFunctionArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as Record<string, unknown> : {};

      const successMessage = typeof data.successMessage === "string" ? data.successMessage : "";
      expect(successMessage).toBe("success");
    });

    it("should return proper data structure", async () => {
      const mockData = {
        scheduledPosts: [{ id: "1", caption: "Test post" }],
        longformPosts: [],
        allContent: [{ id: "1", caption: "Test post" }],
        user: { id: "user-123", timezone: "America/New_York" },
        queueTypes: [{ id: "1", name: "Default" }],
        hashTagPresets: [],
      };

      (loadDashboardData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard");
      const response = await loader({ request, params: {}, context: {} } as LoaderFunctionArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as Record<string, unknown> : {};

      const scheduledPosts = Array.isArray(data.scheduledPosts) ? data.scheduledPosts : [];
      expect(scheduledPosts).toHaveLength(1);
      const firstPost = scheduledPosts[0] && typeof scheduledPosts[0] === "object" && !Array.isArray(scheduledPosts[0]) ? scheduledPosts[0] as { id?: unknown } : {};
      expect(firstPost).toHaveProperty("id", "1");
      const user = data.user && typeof data.user === "object" && !Array.isArray(data.user) ? data.user as { timezone?: unknown } : {};
      expect(user).toHaveProperty("timezone", "America/New_York");
      const queueTypes = Array.isArray(data.queueTypes) ? data.queueTypes : [];
      expect(queueTypes).toHaveLength(1);
    });
  });

  describe("Dashboard Queue Filtering", () => {
    it("should handle 'all' queue type", async () => {
      const request = new Request("http://localhost:3000/dashboard?tab=all");
      const response = await loader({ request, params: {}, context: {} } as LoaderFunctionArgs);
      
      expect(response.status).toBe(200);
      expect(loadDashboardData).toHaveBeenCalledWith("user-123", "all");
    });

    it("should handle 'posts' queue type", async () => {
      const request = new Request("http://localhost:3000/dashboard?tab=posts");
      const response = await loader({ 
        request, 
        params: { queueType: "posts" } 
      } as unknown as LoaderFunctionArgs);
      
      expect(response.status).toBe(200);
      expect(loadDashboardData).toHaveBeenCalledWith("user-123", "posts");
    });

    it("should handle 'longform' queue type", async () => {
      const request = new Request("http://localhost:3000/dashboard?tab=longform");
      const response = await loader({ 
        request, 
        params: { queueType: "longform" } 
      } as unknown as LoaderFunctionArgs);
      
      expect(response.status).toBe(200);
      expect(loadDashboardData).toHaveBeenCalledWith("user-123", "longform");
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required")
      );

      const request = new Request("http://localhost:3000/dashboard");
      
      await expect(loader({ request, params: {}, context: {} } as LoaderFunctionArgs)).rejects.toThrow(
        "Authentication required"
      );
    });

    it("should handle feature access errors", async () => {
      (requireFeatureAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Feature access denied")
      );

      const request = new Request("http://localhost:3000/dashboard");
      
      await expect(loader({ request, params: {}, context: {} } as LoaderFunctionArgs)).rejects.toThrow(
        "Feature access denied"
      );
    });

    it("should handle data loading errors", async () => {
      (loadDashboardData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/dashboard");
      
      await expect(loader({ request, params: {}, context: {} } as LoaderFunctionArgs)).rejects.toThrow(
        "Database error"
      );
    });
  });
});

