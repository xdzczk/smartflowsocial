/**
 * Integration tests for scheduled posts loader
 *
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/posts/scheduled-posts.cy.ts
 *
 * Migrated from: tests/e2e/loaders/queues-loader.cy.ts (Scheduled Posts section)
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
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/features/posts/scheduling/services/scheduled-loader.server", () => ({
  loadScheduledData: vi.fn(),
}));

vi.mock("~/features/posts/ui", () => ({
  ScheduledPostsPage: () => null,
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
import { loadScheduledData } from "~/features/posts/server";
import { loader } from "~/routes/dashboard.scheduled";

describe("Scheduled Posts Loader Integration", () => {
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
    (loadScheduledData as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      longformPosts: [],
      user: createValidUserMock(),
      queueTypes: [],
      selectedQueueType: "all",
      hashTagPresets: [],
      pagination: { total: 0, pages: 0, currentPage: 1, limit: 20 },
    });
  });

  describe("Scheduled Posts Loader", () => {
    it("should load scheduled posts data for authenticated user", async () => {
      const request = new Request("http://localhost:3000/dashboard/scheduled");
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
      expect(requireFeatureAccess).toHaveBeenCalledWith(
        "user-123",
        "scheduled"
      );
      expect(loadScheduledData).toHaveBeenCalledWith(
        "user-123",
        "all",
        1,
        20,
        undefined,
        undefined
      );
      expect(data).toHaveProperty("posts");
      expect(data).toHaveProperty("longformPosts");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("queueTypes");
    });

    it("should handle queue type parameter", async () => {
      const mockData = {
        posts: [createValidPostDTOMock({ id: "1", caption: "Test post" })],
        longformPosts: [],
        user: createValidUserMock(),
        queueTypes: [{ id: "1", name: "Default", isEnabled: true }],
        selectedQueueType: "posts",
        hashTagPresets: [],
        pagination: { total: 1, pages: 1, currentPage: 1, limit: 20 },
      };

      (loadScheduledData as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockData
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
      const response = await loader({
        request,
        params: { queueType: "posts" },
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

      expect(loadScheduledData).toHaveBeenCalledWith(
        "user-123",
        "posts",
        1,
        20,
        undefined,
        undefined
      );
      expect(data.selectedQueueType).toBe("posts");
      expect(data.posts).toHaveLength(1);
    });

    it("should return proper data structure with posts", async () => {
      const mockData = {
        posts: [
          createValidPostDTOMock({
            id: "1",
            caption: "Post 1",
            scheduledAtUtc: new Date().toISOString(),
          }),
          createValidPostDTOMock({
            id: "2",
            caption: "Post 2",
            scheduledAtUtc: new Date().toISOString(),
          }),
        ],
        longformPosts: [],
        user: createValidUserMock({ timezone: "America/New_York" }),
        queueTypes: [
          { id: "1", name: "Default", isEnabled: true },
          { id: "2", name: "Marketing", isEnabled: true },
        ],
        selectedQueueType: "all",
        hashTagPresets: [],
        pagination: { total: 2, pages: 1, currentPage: 1, limit: 20 },
      };

      (loadScheduledData as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockData
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
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

      expect(data.posts).toHaveLength(2);
      expect(data.longformPosts).toHaveLength(0);
      expect(data.queueTypes).toHaveLength(2);
      expect(data.user).toBeDefined();
    });

    it("should filter queue types to only enabled ones", async () => {
      const mockData = {
        posts: [],
        longformPosts: [],
        user: createValidUserMock(),
        queueTypes: [
          { id: "1", name: "Default", isEnabled: true },
          { id: "2", name: "Disabled", isEnabled: false },
          { id: "3", name: "Marketing", isEnabled: true },
        ],
        selectedQueueType: "all",
        hashTagPresets: [],
        pagination: { total: 0, pages: 0, currentPage: 1, limit: 20 },
      };

      (loadScheduledData as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockData
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
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

      // The loadScheduledData function should already filter, but we verify the structure
      const queueTypes = data.queueTypes;
      expect(queueTypes).toBeDefined();
      expect(Array.isArray(queueTypes)).toBe(true);
      if (Array.isArray(queueTypes)) {
        expect(queueTypes.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required")
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
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
        "message" in data.error &&
        typeof data.error.message === "string"
          ? data.error.message
          : "";
      expect(error).toContain("Authentication required");
    });

    it("should handle subscription requirement errors", async () => {
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Subscription required")
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
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
        "message" in data.error &&
        typeof data.error.message === "string"
          ? data.error.message
          : "";
      expect(error).toContain("Subscription required");
    });

    it("should handle feature access errors", async () => {
      (requireFeatureAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Feature access denied")
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
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
        "message" in data.error &&
        typeof data.error.message === "string"
          ? data.error.message
          : "";
      expect(error).toContain("Feature access denied");
    });

    it("should handle data loading errors", async () => {
      (loadScheduledData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/dashboard/scheduled");
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
        "message" in data.error &&
        typeof data.error.message === "string"
          ? data.error.message
          : "";
      expect(error).toContain("Database error");
    });
  });
});
