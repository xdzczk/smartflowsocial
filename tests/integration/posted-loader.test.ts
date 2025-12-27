/**
 * Integration tests for posted posts loader
 * 
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/posts/scheduled-posts.cy.ts
 * 
 * Migrated from: tests/e2e/loaders/queues-loader.cy.ts (Posted Queue Loader section)
 */

import { json } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
}));

vi.mock("~/features/posts/posts.server", () => ({
  getPostedDashboardData: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import { getPostedDashboardData } from "~/features/posts/posts.server";
import { loader } from "~/routes/dashboard.posted";

describe("Posted Posts Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (getPostedDashboardData as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      longformPosts: [],
      allContent: [],
      user: { id: "user-123", timezone: "UTC" },
      queueTypes: [],
      selectedQueueType: "all",
    });
  });

  describe("Posted Posts Loader", () => {
    it("should load posted posts data for authenticated user", async () => {
      const request = new Request("http://localhost:3000/dashboard/posted");
      const response = await loader({ request, params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(requireAnySubscription).toHaveBeenCalledWith("user-123");
      expect(getPostedDashboardData).toHaveBeenCalled();
      expect(data).toHaveProperty("posts");
      expect(data).toHaveProperty("longformPosts");
      expect(data).toHaveProperty("allContent");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
    });

    it("should handle queue type parameter", async () => {
      const mockData = {
        posts: [{ id: "1", caption: "Posted post", postedAt: new Date() }],
        longformPosts: [],
        allContent: [{ id: "1", caption: "Posted post", postedAt: new Date() }],
        user: { id: "user-123", timezone: "UTC" },
        queueTypes: [{ id: "1", name: "Default" }],
        selectedQueueType: "posts",
      };

      (getPostedDashboardData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/posted");
      const response = await loader({ 
        request, 
        params: { queueType: "posts" } 
      });
      const data = await response.json();

      expect(getPostedDashboardData).toHaveBeenCalledWith({
        userId: "user-123",
        params: { queueType: "posts" },
        url: expect.any(URL),
      });
      expect(data.selectedQueueType).toBe("posts");
      expect(data.posts).toHaveLength(1);
    });

    it("should return proper data structure with posted posts", async () => {
      const mockData = {
        posts: [
          { id: "1", caption: "Post 1", postedAt: new Date("2024-01-01") },
          { id: "2", caption: "Post 2", postedAt: new Date("2024-01-02") },
        ],
        longformPosts: [
          { id: "3", title: "Longform Post", publishedAt: new Date("2024-01-03") },
        ],
        allContent: [
          { id: "1", caption: "Post 1", postedAt: new Date("2024-01-01") },
          { id: "2", caption: "Post 2", postedAt: new Date("2024-01-02") },
          { id: "3", title: "Longform Post", publishedAt: new Date("2024-01-03") },
        ],
        user: { id: "user-123", timezone: "America/New_York" },
        queueTypes: [
          { id: "1", name: "Default", isEnabled: true },
        ],
        selectedQueueType: "all",
      };

      (getPostedDashboardData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/posted");
      const response = await loader({ request, params: {} });
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
      expect(data.longformPosts).toHaveLength(1);
      expect(data.allContent).toHaveLength(3);
      expect(data.user).toHaveProperty("timezone", "America/New_York");
    });

    it("should pass URL object to getPostedDashboardData", async () => {
      const request = new Request("http://localhost:3000/dashboard/posted?page=2&limit=10");
      
      await loader({ request, params: {} });

      expect(getPostedDashboardData).toHaveBeenCalledWith({
        userId: "user-123",
        params: {},
        url: expect.objectContaining({
          searchParams: expect.any(URLSearchParams),
        }),
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required")
      );

      const request = new Request("http://localhost:3000/dashboard/posted");
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

      const request = new Request("http://localhost:3000/dashboard/posted");
      const response = await loader({ request, params: {} });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain("Subscription required");
    });

    it("should handle data loading errors", async () => {
      (getPostedDashboardData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/dashboard/posted");
      const response = await loader({ request, params: {} });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain("Database error");
    });
  });
});

