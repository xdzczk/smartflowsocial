/**
 * Integration tests for drafts loader
 * 
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/posts/drafts.cy.ts
 * 
 * Migrated from: tests/e2e/loaders/queues-loader.cy.ts (Drafts Queue Loader section)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { json } from "@remix-run/node";

// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/payments/subscriptions.server", () => ({
  requireAnySubscription: vi.fn(),
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/features/posts/services/drafts-loader.server", () => ({
  loadDraftsData: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { requireAnySubscription, requireFeatureAccess } from "~/features/payments/subscriptions.server";
import { loadDraftsData } from "~/features/posts/services/drafts-loader.server";
import { loader } from "~/routes/dashboard.drafts";

describe("Drafts Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (loadDraftsData as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      longformPosts: [],
      allContent: [],
      user: { id: "user-123", timezone: "UTC" },
      queueTypes: [],
      selectedQueueType: "all",
      hashTagPresets: [],
    });
  });

  describe("Drafts Loader", () => {
    it("should load drafts data for authenticated user", async () => {
      const request = new Request("http://localhost:3000/dashboard/drafts");
      const response = await loader({ request, params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(requireAnySubscription).toHaveBeenCalledWith("user-123");
      expect(requireFeatureAccess).toHaveBeenCalledWith("user-123", "drafts");
      expect(loadDraftsData).toHaveBeenCalledWith("user-123", "all");
      expect(data).toHaveProperty("posts");
      expect(data).toHaveProperty("longformPosts");
      expect(data).toHaveProperty("allContent");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
    });

    it("should handle queue type parameter", async () => {
      const mockData = {
        posts: [{ id: "1", caption: "Draft post" }],
        longformPosts: [],
        allContent: [{ id: "1", caption: "Draft post" }],
        user: { id: "user-123", timezone: "UTC" },
        queueTypes: [{ id: "1", name: "Default" }],
        selectedQueueType: "posts",
        hashTagPresets: [],
      };

      (loadDraftsData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/drafts");
      const response = await loader({ 
        request, 
        params: { queueType: "posts" } 
      });
      const data = await response.json();

      expect(loadDraftsData).toHaveBeenCalledWith("user-123", "posts");
      expect(data.selectedQueueType).toBe("posts");
      expect(data.posts).toHaveLength(1);
    });

    it("should return proper data structure with drafts", async () => {
      const mockData = {
        posts: [
          { id: "1", caption: "Draft 1", isDraft: true },
          { id: "2", caption: "Draft 2", isDraft: true },
        ],
        longformPosts: [
          { id: "3", title: "Longform Draft", isDraft: true },
        ],
        allContent: [
          { id: "1", caption: "Draft 1", isDraft: true },
          { id: "2", caption: "Draft 2", isDraft: true },
          { id: "3", title: "Longform Draft", isDraft: true },
        ],
        user: { id: "user-123", timezone: "America/New_York" },
        queueTypes: [
          { id: "1", name: "Default", isEnabled: true },
        ],
        selectedQueueType: "all",
        hashTagPresets: [],
      };

      (loadDraftsData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/drafts");
      const response = await loader({ request, params: {} });
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
      expect(data.longformPosts).toHaveLength(1);
      expect(data.allContent).toHaveLength(3);
      expect(data.user).toHaveProperty("timezone", "America/New_York");
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required")
      );

      const request = new Request("http://localhost:3000/dashboard/drafts");
      
      await expect(loader({ request, params: {} })).rejects.toThrow(
        "Authentication required"
      );
    });

    it("should handle subscription requirement errors", async () => {
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Subscription required")
      );

      const request = new Request("http://localhost:3000/dashboard/drafts");
      
      await expect(loader({ request, params: {} })).rejects.toThrow(
        "Subscription required"
      );
    });

    it("should handle feature access errors", async () => {
      (requireFeatureAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Feature access denied")
      );

      const request = new Request("http://localhost:3000/dashboard/drafts");
      
      await expect(loader({ request, params: {} })).rejects.toThrow(
        "Feature access denied"
      );
    });
  });
});

