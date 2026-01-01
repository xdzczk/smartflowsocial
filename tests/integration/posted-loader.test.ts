/**
 * Integration tests for posted posts loader
 * 
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/posts/scheduled-posts.cy.ts
 * 
 * Migrated from: tests/e2e/loaders/queues-loader.cy.ts (Posted Queue Loader section)
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
      const loaderArgs: LoaderFunctionArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { posts?: unknown; longformPosts?: unknown; allContent?: unknown; user?: unknown; queueTypes?: unknown; selectedQueueType?: unknown; error?: { message?: string } } : {};

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
        params: { queueType: "posts" },
        context: {}
      } as unknown as LoaderFunctionArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { posts?: unknown; longformPosts?: unknown; allContent?: unknown; user?: unknown; queueTypes?: unknown; selectedQueueType?: unknown; error?: { message?: string } } : {};

      expect(getPostedDashboardData).toHaveBeenCalledWith({
        userId: "user-123",
        params: { queueType: "posts" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        url: expect.any(URL),
      });
      const selectedQueueType = typeof data.selectedQueueType === "string" ? data.selectedQueueType : "";
      const posts = Array.isArray(data.posts) ? data.posts : [];
      expect(selectedQueueType).toBe("posts");
      expect(posts).toHaveLength(1);
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
      const loaderArgs: LoaderFunctionArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { posts?: unknown; longformPosts?: unknown; allContent?: unknown; user?: unknown; queueTypes?: unknown; selectedQueueType?: unknown; error?: { message?: string } } : {};

      const posts = Array.isArray(data.posts) ? data.posts : [];
      const longformPosts = Array.isArray(data.longformPosts) ? data.longformPosts : [];
      const allContent = Array.isArray(data.allContent) ? data.allContent : [];
      const user = data.user && typeof data.user === "object" && !Array.isArray(data.user) ? data.user as { timezone?: string } : {};
      expect(posts).toHaveLength(2);
      expect(longformPosts).toHaveLength(1);
      expect(allContent).toHaveLength(3);
      expect(user).toHaveProperty("timezone", "America/New_York");
    });

    it("should pass URL object to getPostedDashboardData", async () => {
      const request = new Request("http://localhost:3000/dashboard/posted?page=2&limit=10");
      
      const loaderArgs: LoaderFunctionArgs = { request, params: {}, context: {} };
      await loader(loaderArgs);

      expect(getPostedDashboardData).toHaveBeenCalledWith({
        userId: "user-123",
        params: {},
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        url: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      const loaderArgs: LoaderFunctionArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { posts?: unknown; longformPosts?: unknown; allContent?: unknown; user?: unknown; queueTypes?: unknown; selectedQueueType?: unknown; error?: { message?: string } } : {};
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      const error = data.error && typeof data.error === "object" && !Array.isArray(data.error) ? data.error as { message?: string } : {};
      const errorMessage = typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Authentication required");
    });

    it("should handle subscription requirement errors", async () => {
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Subscription required")
      );

      const request = new Request("http://localhost:3000/dashboard/posted");
      const loaderArgs: LoaderFunctionArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { posts?: unknown; longformPosts?: unknown; allContent?: unknown; user?: unknown; queueTypes?: unknown; selectedQueueType?: unknown; error?: { message?: string } } : {};
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      const error = data.error && typeof data.error === "object" && !Array.isArray(data.error) ? data.error as { message?: string } : {};
      const errorMessage = typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Subscription required");
    });

    it("should handle data loading errors", async () => {
      (getPostedDashboardData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/dashboard/posted");
      const loaderArgs: LoaderFunctionArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { posts?: unknown; longformPosts?: unknown; allContent?: unknown; user?: unknown; queueTypes?: unknown; selectedQueueType?: unknown; error?: { message?: string } } : {};
      
      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      const error = data.error && typeof data.error === "object" && !Array.isArray(data.error) ? data.error as { message?: string } : {};
      const errorMessage = typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Database error");
    });
  });
});

