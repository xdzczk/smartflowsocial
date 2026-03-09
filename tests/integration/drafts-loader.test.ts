/**
 * Integration tests for drafts loader
 *
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/posts/drafts.cy.ts
 *
 * Migrated from: tests/e2e/loaders/queues-loader.cy.ts (Drafts Queue Loader section)
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
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
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/features/posts/drafts", () => ({
  loadDraftsData: vi.fn(),
}));

import {
  createValidUserMock,
  createValidPostDTOMock,
} from "../utils/test-helpers";

import { requireUserId } from "~/features/auth/session.server";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments/subscriptions.server";
import { loadDraftsData } from "~/features/posts/server";
import { loader } from "~/routes/dashboard.drafts";

describe("Drafts Loader Integration", () => {
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
    (loadDraftsData as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      longformPosts: [],
      user: createValidUserMock(),
      queueTypes: [],
      selectedQueueType: "all",
    });
  });

  describe("Drafts Loader", () => {
    it("should load drafts data for authenticated user", async () => {
      const request = new Request("http://localhost:3000/dashboard/drafts");
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
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              posts?: unknown;
              longformPosts?: unknown;
              allContent?: unknown;
              user?: unknown;
              queueTypes?: unknown;
              selectedQueueType?: unknown;
              error?: { message?: string };
            })
          : {};

      expect(responseObj.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(requireAnySubscription).toHaveBeenCalledWith("user-123");
      expect(requireFeatureAccess).toHaveBeenCalledWith("user-123", "drafts");
      expect(loadDraftsData).toHaveBeenCalledWith("user-123", "all");
      expect(data).toHaveProperty("posts");
      expect(data).toHaveProperty("longformPosts");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
    });

    it("should handle queue type parameter", async () => {
      const mockData = {
        posts: [
          createValidPostDTOMock({
            id: "1",
            caption: "Draft post",
            status: "DRAFT",
          }),
        ],
        longformPosts: [],
        user: createValidUserMock(),
        queueTypes: [{ id: "1", name: "Default" }],
        selectedQueueType: "posts",
      };

      (loadDraftsData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/drafts");
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
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              posts?: unknown;
              longformPosts?: unknown;
              allContent?: unknown;
              user?: unknown;
              queueTypes?: unknown;
              selectedQueueType?: unknown;
              error?: { message?: string };
            })
          : {};

      expect(loadDraftsData).toHaveBeenCalledWith("user-123", "posts");
      const selectedQueueType =
        typeof data.selectedQueueType === "string"
          ? data.selectedQueueType
          : "";
      const posts = Array.isArray(data.posts) ? data.posts : [];
      expect(selectedQueueType).toBe("posts");
      expect(posts).toHaveLength(1);
    });

    it("should return proper data structure with drafts", async () => {
      const mockData = {
        posts: [
          createValidPostDTOMock({
            id: "1",
            caption: "Draft 1",
            status: "DRAFT",
          }),
          createValidPostDTOMock({
            id: "2",
            caption: "Draft 2",
            status: "DRAFT",
          }),
        ],
        longformPosts: [
          {
            id: "3",
            title: "Longform Draft",
            summary: null,
            content: null,
            image: null,
            publishedAt: null,
            scheduledAtUtc: null,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: "DRAFT",
            currentState: "DRAFT",
            queueTypeId: null,
            tags: [],
            userId: "user-123",
            hashTagPresetId: null,
            queueType: null,
          },
        ],
        user: createValidUserMock({ timezone: "America/New_York" }),
        queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
        selectedQueueType: "all",
      };

      (loadDraftsData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/drafts");
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
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              posts?: unknown;
              longformPosts?: unknown;
              allContent?: unknown;
              user?: unknown;
              queueTypes?: unknown;
              selectedQueueType?: unknown;
              error?: { message?: string };
            })
          : {};

      const posts = Array.isArray(data.posts) ? data.posts : [];
      const longformPosts = Array.isArray(data.longformPosts)
        ? data.longformPosts
        : [];
      const user =
        data.user && typeof data.user === "object" && !Array.isArray(data.user)
          ? (data.user as { timezone?: string })
          : {};
      expect(posts).toHaveLength(2);
      expect(longformPosts).toHaveLength(1);
      expect(user).toHaveProperty("timezone", "America/New_York");
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required")
      );

      const request = new Request("http://localhost:3000/dashboard/drafts");
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
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              posts?: unknown;
              longformPosts?: unknown;
              allContent?: unknown;
              user?: unknown;
              queueTypes?: unknown;
              selectedQueueType?: unknown;
              error?: { message?: string };
            })
          : {};

      expect(responseObj.status).toBe(401);
      expect(data.error).toBeDefined();
      const error =
        data.error &&
        typeof data.error === "object" &&
        !Array.isArray(data.error)
          ? (data.error as { message?: string })
          : {};
      const errorMessage =
        typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Authentication required");
    });

    it("should handle subscription requirement errors", async () => {
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Subscription required")
      );

      const request = new Request("http://localhost:3000/dashboard/drafts");
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
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              posts?: unknown;
              longformPosts?: unknown;
              allContent?: unknown;
              user?: unknown;
              queueTypes?: unknown;
              selectedQueueType?: unknown;
              error?: { message?: string };
            })
          : {};

      expect(responseObj.status).toBe(403);
      expect(data.error).toBeDefined();
      const error =
        data.error &&
        typeof data.error === "object" &&
        !Array.isArray(data.error)
          ? (data.error as { message?: string })
          : {};
      const errorMessage =
        typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Subscription required");
    });

    it("should handle feature access errors", async () => {
      (requireFeatureAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Feature access denied")
      );

      const _request = new Request("http://localhost:3000/dashboard/drafts");
      const loaderArgs: LoaderFunctionArgs = {
        request: _request,
        params: {},
        context: {},
      };
      const response = await loader(loaderArgs);
      const responseObj =
        response instanceof Response
          ? response
          : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              posts?: unknown;
              longformPosts?: unknown;
              allContent?: unknown;
              user?: unknown;
              queueTypes?: unknown;
              selectedQueueType?: unknown;
              error?: { message?: string };
            })
          : {};

      expect(responseObj.status).toBe(403);
      expect(data.error).toBeDefined();
      const error =
        data.error &&
        typeof data.error === "object" &&
        !Array.isArray(data.error)
          ? (data.error as { message?: string })
          : {};
      const errorMessage =
        typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Feature access denied");
    });
  });
});
