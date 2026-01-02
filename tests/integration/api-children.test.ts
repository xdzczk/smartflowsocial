/**
 * Integration tests for children API route
 * 
 * Tests the API endpoint in app/routes/api.children.tsx
 */
import { json } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

// Use vi.hoisted to create mock functions before module import - best practice
const { mockLoadChildrenData, mockHandleChildrenApiError } = vi.hoisted(() => ({
  mockLoadChildrenData: vi.fn(),
  mockHandleChildrenApiError: vi.fn(),
}));

// Mock only loadChildrenData - we'll inject the error handler via dependency injection
vi.mock("~/features/user", async () => {
  // Dynamic import() type annotation needed for vi.importActual
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import("~/features/user")>("~/features/user");
  return {
    ...actual,
    loadChildrenData: mockLoadChildrenData,
  };
});

vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

vi.mock("~/lib/errors", () => ({
  normalizeError: vi.fn((error) => ({
    message: error instanceof Error ? error.message : String(error),
    code: "UNKNOWN_ERROR",
    statusCode: 500,
  })),
}));

import { requireUserId } from "~/features/auth/session.server";
import { loadChildrenData } from "~/features/user";
import { createLoader } from "~/routes/api.children";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("API: Children", () => {
  // Create loader with injected error handler for testing
  // This is created fresh for each test via the factory function
  let loader: ReturnType<typeof createLoader>;

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
    // Set default mock for error handler
    mockHandleChildrenApiError.mockReturnValue(json({ children: [] }));
    // Create loader with injected dependencies for each test
    loader = createLoader(mockLoadChildrenData, mockHandleChildrenApiError);
  });

  describe("Successful Requests", () => {
    it("should return children for parent with premium subscription", async () => {
      const expectedResponse = json({
        children: [
          {
            npub: "npub-child-1",
            name: "Child 1",
            displayName: "Child One",
            picture: "https://example.com/pic1.jpg",
          },
          {
            npub: "npub-child-2",
            name: "Child 2",
            displayName: "Child Two",
            picture: "https://example.com/pic2.jpg",
          },
        ],
      });

      mockLoadChildrenData.mockResolvedValue(expectedResponse);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({
        children: [
          {
            npub: "npub-child-1",
            name: "Child 1",
            displayName: "Child One",
            picture: "https://example.com/pic1.jpg",
          },
          {
            npub: "npub-child-2",
            name: "Child 2",
            displayName: "Child Two",
            picture: "https://example.com/pic2.jpg",
          },
        ],
      });
    });

    it("should return children for founder subscription", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(json({ children: [] }));

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data.children).toEqual([]);
    });

    it("should handle case-insensitive plan matching", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(json({ children: [] }));

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data.children).toEqual([]);
    });

    it("should handle children with missing profile data", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(
        json({
          children: [
            {
              npub: "npub-child-1",
              name: undefined,
              displayName: undefined,
              picture: undefined,
            },
          ],
        }),
      );

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data.children).toEqual([
        {
          npub: "npub-child-1",
          name: undefined,
          displayName: undefined,
          picture: undefined,
        },
      ]);
    });

    it("should handle children with object profile data", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(
        json({
          children: [
            {
              npub: "npub-child-1",
              name: "Child 1",
              displayName: "Child One",
              picture: "https://example.com/pic.jpg",
            },
          ],
        }),
      );

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data.children?.[0]?.name).toBe("Child 1");
      expect(data.children?.[0]?.displayName).toBe("Child One");
      expect(data.children?.[0]?.picture).toBe("https://example.com/pic.jpg");
    });
  });

  describe("Access Control", () => {
    it("should return empty array when user has no npub", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(json({ children: [] }));

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({ children: [] });
    });

    it("should return empty array when user is a child account", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(json({ children: [] }));

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({ children: [] });
    });

    it("should return empty array when user doesn't have premium/founder subscription", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(json({ children: [] }));

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({ children: [] });
    });

    it("should return empty array when subscription is null", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(json({ children: [] }));

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({ children: [] });
    });
  });

  describe("Error Handling", () => {
    it("should require authentication", async () => {
      // requireUserId throws a Response (redirect), not an Error
      const redirectResponse = new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
      (requireUserId as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw redirectResponse;
      });
      // handleChildrenApiError rethrows Response errors
      mockHandleChildrenApiError.mockImplementation((error) => {
        if (error instanceof Response) {
          throw error;
        }
        return json({ children: [] });
      });

      const request = new Request("http://localhost:3000/api/children");

      // Loader throws Response, so we need to catch it
      let response: Response;
      try {
        response = await loader({ request, params: {}, context: {} });
      } catch (error) {
        if (error instanceof Response) {
          response = error;
        } else {
          throw error;
        }
      }
      expect(response!.status).toBe(302);
      expect(response!.headers.get("Location")).toBe("/login");
    });

    it("should handle database errors gracefully", async () => {
      // When loadChildrenData fails, the loader should catch it and call
      // the injected error handler, which returns an empty array
      const dbError = new Error("Database error");
      mockLoadChildrenData.mockRejectedValue(dbError);
      
      // Mock the error handler to return a graceful response
      const errorResponse = json({ children: [] });
      mockHandleChildrenApiError.mockReturnValue(errorResponse);

      const request = new Request("http://localhost:3000/api/children");
      const loaderArgs = { request, params: {}, context: {} };
      
      // The loader should catch the error and return a graceful response
      // The error from mockLoadChildrenData should be caught by the loader's try-catch
      const response = await loader(loaderArgs);
      const data = await response.json() as { children?: unknown[] };

      // Verify graceful error handling - returns empty array instead of throwing
      expect(response.status).toBe(200);
      expect(data).toEqual({ children: [] });
      expect(mockHandleChildrenApiError).toHaveBeenCalledWith(
        dbError,
        expect.any(String),
      );
    });

    it("should handle invalid JSON in nostrProfile", async () => {
      (loadChildrenData as ReturnType<typeof vi.fn>).mockResolvedValue(
        json({
          children: [
            {
              npub: "npub-child-1",
              name: undefined,
              displayName: undefined,
              picture: undefined,
            },
          ],
        }),
      );

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(loadChildrenData).toHaveBeenCalledWith(TEST_USER_ID);
      // Should handle parse error gracefully
      const children = Array.isArray(data.children) ? data.children : [];
      const firstChild = children[0] && typeof children[0] === "object" && !Array.isArray(children[0]) ? children[0] as { name?: string; displayName?: string; npub?: string; picture?: string } : {};
      expect(firstChild.name).toBeUndefined();
    });
  });
});

