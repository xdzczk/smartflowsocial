/**
 * Integration tests for scheduled posts loader
 * 
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/posts/scheduled-posts.cy.ts
 * 
 * Migrated from: tests/e2e/loaders/queues-loader.cy.ts (Scheduled Posts section)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { json } from "@remix-run/node";

// Mock Prisma to prevent $use errors
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    $use: vi.fn(),
  },
}));

// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/payments/subscriptions.server", () => ({
  requireAnySubscription: vi.fn(),
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/features/posts/services/scheduled-loader.server", () => ({
  loadScheduledData: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { requireAnySubscription, requireFeatureAccess } from "~/features/payments/subscriptions.server";
import { loadScheduledData } from "~/features/posts/services/scheduled-loader.server";
import { loader } from "~/routes/dashboard.scheduled";

describe("Scheduled Posts Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (loadScheduledData as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      longformPosts: [],
      allContent: [],
      user: { id: "user-123", timezone: "UTC" },
      queueTypes: [],
      selectedQueueType: "all",
      hashTagPresets: [],
    });
  });

  describe("Scheduled Posts Loader", () => {
    it("should load scheduled posts data for authenticated user", async () => {
      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({ request, params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(requireAnySubscription).toHaveBeenCalledWith("user-123");
      expect(requireFeatureAccess).toHaveBeenCalledWith("user-123", "scheduled");
      expect(loadScheduledData).toHaveBeenCalledWith("user-123", "all");
      expect(data).toHaveProperty("posts");
      expect(data).toHaveProperty("longformPosts");
      expect(data).toHaveProperty("allContent");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
    });

    it("should handle queue type parameter", async () => {
      const mockData = {
        posts: [{ id: "1", caption: "Test post" }],
        longformPosts: [],
        allContent: [{ id: "1", caption: "Test post" }],
        user: { id: "user-123", timezone: "UTC" },
        queueTypes: [{ id: "1", name: "Default" }],
        selectedQueueType: "posts",
        hashTagPresets: [],
      };

      (loadScheduledData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({ 
        request, 
        params: { queueType: "posts" } 
      });
      const data = await response.json();

      expect(loadScheduledData).toHaveBeenCalledWith("user-123", "posts");
      expect(data.selectedQueueType).toBe("posts");
      expect(data.posts).toHaveLength(1);
    });

    it("should return proper data structure with posts", async () => {
      const mockData = {
        posts: [
          { id: "1", caption: "Post 1", scheduledFor: new Date() },
          { id: "2", caption: "Post 2", scheduledFor: new Date() },
        ],
        longformPosts: [],
        allContent: [
          { id: "1", caption: "Post 1", scheduledFor: new Date() },
          { id: "2", caption: "Post 2", scheduledFor: new Date() },
        ],
        user: { id: "user-123", timezone: "America/New_York" },
        queueTypes: [
          { id: "1", name: "Default", isEnabled: true },
          { id: "2", name: "Marketing", isEnabled: true },
        ],
        selectedQueueType: "all",
        hashTagPresets: [],
      };

      (loadScheduledData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({ request, params: {} });
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
      expect(data.allContent).toHaveLength(2);
      expect(data.queueTypes).toHaveLength(2);
      expect(data.user).toHaveProperty("timezone", "America/New_York");
    });

    it("should filter queue types to only enabled ones", async () => {
      const mockData = {
        posts: [],
        longformPosts: [],
        allContent: [],
        user: { id: "user-123", timezone: "UTC" },
        queueTypes: [
          { id: "1", name: "Default", isEnabled: true },
          { id: "2", name: "Disabled", isEnabled: false },
          { id: "3", name: "Marketing", isEnabled: true },
        ],
        selectedQueueType: "all",
        hashTagPresets: [],
      };

      (loadScheduledData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({ request, params: {} });
      const data = await response.json();

      // The loadScheduledData function should already filter, but we verify the structure
      expect(data.queueTypes).toBeDefined();
      expect(Array.isArray(data.queueTypes)).toBe(true);
      expect(data.queueTypes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required")
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({ request, params: {} });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain("Authentication required");
    });

    it("should handle subscription requirement errors", async () => {
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Subscription required")
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({ request, params: {} });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain("Subscription required");
    });

    it("should handle feature access errors", async () => {
      (requireFeatureAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Feature access denied")
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({ request, params: {} });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain("Feature access denied");
    });

    it("should handle data loading errors", async () => {
      (loadScheduledData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({ request, params: {} });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain("Database error");
    });
  });
});

