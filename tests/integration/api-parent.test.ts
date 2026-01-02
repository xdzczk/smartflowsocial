/**
 * Integration tests for parent API route
 * 
 * Tests the API endpoint in app/routes/api.parent.tsx
 */
import { json } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

// Use vi.hoisted to create mock functions before module import - best practice
const { mockLoadParentData, mockHandleParentApiError } = vi.hoisted(() => ({
  mockLoadParentData: vi.fn(),
  mockHandleParentApiError: vi.fn(),
}));

// Mock only loadParentData - we'll inject the error handler via dependency injection
vi.mock("~/features/user", async () => {
  // Dynamic import() type annotation needed for vi.importActual
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import("~/features/user")>("~/features/user");
  return {
    ...actual,
    loadParentData: mockLoadParentData,
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
import { loadParentData } from "~/features/user";
import { createLoader } from "~/routes/api.parent";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("API: Parent", () => {
  // Create loader with injected error handler for testing
  // This is created fresh for each test via the factory function
  let loader: ReturnType<typeof createLoader>;

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
    // Set default mock for error handler
    mockHandleParentApiError.mockReturnValue(json({ parent: null }));
    // Create loader with injected dependencies for each test
    loader = createLoader(mockLoadParentData, mockHandleParentApiError);
  });

  describe("Successful Requests", () => {
    it("should return parent information for child account", async () => {
      mockLoadParentData.mockResolvedValue(
        json({
          parent: {
            npub: "npub-parent",
            name: "Parent User",
            displayName: "Parent Display",
            picture: "https://example.com/parent.jpg",
          },
        }),
      );

      const request = new Request("http://localhost:3000/api/parent");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { parent?: { npub?: string; name?: string; displayName?: string; picture?: string } | null } : {};

      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(loadParentData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({
        parent: {
          npub: "npub-parent",
          name: "Parent User",
          displayName: "Parent Display",
          picture: "https://example.com/parent.jpg",
        },
      });
    });

    it("should handle parent with object profile data", async () => {
      mockLoadParentData.mockResolvedValue(
        json({
          parent: {
            npub: "npub-parent",
            name: "Parent User",
            displayName: "Parent Display",
            picture: "https://example.com/parent.jpg",
          },
        }),
      );

      const request = new Request("http://localhost:3000/api/parent");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { parent?: { npub?: string; name?: string; displayName?: string; picture?: string } | null } : {};

      expect(loadParentData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data.parent?.name).toBe("Parent User");
      expect(data.parent?.displayName).toBe("Parent Display");
    });

    it("should handle parent with missing profile data", async () => {
      mockLoadParentData.mockResolvedValue(
        json({
          parent: {
            npub: "npub-parent",
            name: undefined,
            displayName: undefined,
            picture: undefined,
          },
        }),
      );

      const request = new Request("http://localhost:3000/api/parent");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { parent?: { npub?: string; name?: string; displayName?: string; picture?: string } | null } : {};

      expect(loadParentData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data.parent).toEqual({
        npub: "npub-parent",
        name: undefined,
        displayName: undefined,
        picture: undefined,
      });
    });
  });

  describe("Access Control", () => {
    it("should return null when user is not a child account", async () => {
      mockLoadParentData.mockResolvedValue(json({ parent: null }));

      const request = new Request("http://localhost:3000/api/parent");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { parent?: { npub?: string; name?: string; displayName?: string; picture?: string } | null } : {};

      expect(loadParentData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({ parent: null });
    });

    it("should return null when user has no parentNpub", async () => {
      mockLoadParentData.mockResolvedValue(json({ parent: null }));

      const request = new Request("http://localhost:3000/api/parent");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { parent?: { npub?: string; name?: string; displayName?: string; picture?: string } | null } : {};

      expect(loadParentData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({ parent: null });
    });

    it("should return null when parent not found", async () => {
      mockLoadParentData.mockResolvedValue(json({ parent: null }));

      const request = new Request("http://localhost:3000/api/parent");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { parent?: { npub?: string; name?: string; displayName?: string; picture?: string } | null } : {};

      expect(loadParentData).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({ parent: null });
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
      // handleParentApiError rethrows Response errors
      mockHandleParentApiError.mockImplementation((error) => {
        if (error instanceof Response) {
          throw error;
        }
        return json({ parent: null });
      });

      const request = new Request("http://localhost:3000/api/parent");

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
      // When loadParentData fails, the loader should catch it and call
      // the injected error handler, which returns null parent
      mockLoadParentData.mockRejectedValue(new Error("Database error"));
      
      // Mock the error handler to return a graceful response
      mockHandleParentApiError.mockReturnValue(json({ parent: null }));

      const request = new Request("http://localhost:3000/api/parent");
      const loaderArgs = { request, params: {}, context: {} };
      
      // The loader should catch the error and return a graceful response
      const response = await loader(loaderArgs);
      const data = await response.json() as { parent?: unknown | null };

      // Verify graceful error handling - returns null parent instead of throwing
      expect(response.status).toBe(200);
      expect(data).toEqual({ parent: null });
      expect(mockHandleParentApiError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(String),
      );
    });

    it("should handle invalid JSON in parent profile", async () => {
      mockLoadParentData.mockResolvedValue(
        json({
          parent: {
            npub: "npub-parent",
            name: undefined,
            displayName: undefined,
            picture: undefined,
          },
        }),
      );

      const request = new Request("http://localhost:3000/api/parent");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const loaderArgs: LoaderArgs = { request, params: {}, context: {} };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { parent?: { npub?: string; name?: string; displayName?: string; picture?: string } | null } : {};

      expect(loadParentData).toHaveBeenCalledWith(TEST_USER_ID);
      // Should handle parse error gracefully
      const parent = data.parent && typeof data.parent === "object" && !Array.isArray(data.parent) ? data.parent as { name?: string; displayName?: string; picture?: string; npub?: string } : null;
      expect(parent?.name).toBeUndefined();
    });
  });
});

