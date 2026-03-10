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

const { mockGetPublishedDashboardData } = vi.hoisted(() => ({
  mockGetPublishedDashboardData: vi.fn(),
}));
vi.mock("~/features/posts/server", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getPublishedDashboardData: mockGetPublishedDashboardData,
  };
});

vi.mock("~/features/posts/ui", () => ({
  PublishedPostsPage: () => null,
}));

import {
  createValidUserMock,
  createValidPostDTOMock,
} from "../utils/test-helpers";

import { requireUserId } from "~/features/auth/session.server";
import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import { loader } from "~/routes/dashboard.published";

describe("Posted Posts Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    mockGetPublishedDashboardData.mockResolvedValue({
      posts: [],
      longformPosts: [],
      user: createValidUserMock(),
      queueTypes: [],
      selectedQueueType: "all",
      pagination: {
        total: 0,
        pages: 0,
        currentPage: 1,
        limit: 50,
      },
      stats: {},
    });
  });

  describe("Posted Posts Loader", () => {
    it("should load posted posts data for authenticated user", async () => {
      const request = new Request("http://localhost:3000/dashboard/published");
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
      expect(mockGetPublishedDashboardData).toHaveBeenCalled();
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
            caption: "Posted post",
            publishedAt: new Date().toISOString(),
          }),
        ],
        longformPosts: [],
        user: createValidUserMock(),
        queueTypes: [{ id: "1", name: "Default" }],
        selectedQueueType: "posts",
        pagination: {
          total: 1,
          pages: 1,
          currentPage: 1,
          limit: 50,
        },
        stats: {},
      };

      mockGetPublishedDashboardData.mockResolvedValue(mockData);

      const request = new Request("http://localhost:3000/dashboard/published");
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

      expect(mockGetPublishedDashboardData).toHaveBeenCalledWith({
        userId: "user-123",
        params: { queueType: "posts" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        url: expect.any(URL),
      });
      const selectedQueueType =
        typeof data.selectedQueueType === "string"
          ? data.selectedQueueType
          : "";
      const posts = Array.isArray(data.posts) ? data.posts : [];
      expect(selectedQueueType).toBe("posts");
      expect(posts).toHaveLength(1);
    });

    it("should return proper data structure with posted posts", async () => {
      mockGetPublishedDashboardData.mockResolvedValue({
        posts: [],
        longformPosts: [],
        user: createValidUserMock(),
        queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
        selectedQueueType: "all",
        pagination: {
          total: 0,
          pages: 0,
          currentPage: 1,
          limit: 50,
        },
        stats: {},
      });

      const request = new Request("http://localhost:3000/dashboard/published");
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
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(responseObj.status).toBe(200);
      expect(data).toHaveProperty("posts");
      expect(data).toHaveProperty("longformPosts");
      expect(Array.isArray(data["posts"])).toBe(true);
      expect(Array.isArray(data["longformPosts"])).toBe(true);
      expect(data["user"]).toBeDefined();
      expect(data["queueTypes"]).toBeDefined();
      expect(data["pagination"]).toBeDefined();
      expect(data["stats"]).toBeDefined();
    });

    it("should pass URL object to getPublishedDashboardData", async () => {
      const request = new Request(
        "http://localhost:3000/dashboard/published?page=2&limit=10"
      );

      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      await loader(loaderArgs);

      expect(mockGetPublishedDashboardData).toHaveBeenCalledWith({
        userId: "user-123",
        params: {},
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        url: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
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

      const request = new Request("http://localhost:3000/dashboard/published");
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

      const request = new Request("http://localhost:3000/dashboard/published");
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

    it("should handle data loading errors", async () => {
      mockGetPublishedDashboardData.mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/dashboard/published");
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

      expect(responseObj.status).toBe(500);
      expect(data.error).toBeDefined();
      const error =
        data.error &&
        typeof data.error === "object" &&
        !Array.isArray(data.error)
          ? (data.error as { message?: string })
          : {};
      const errorMessage =
        typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Database error");
    });
  });
});
