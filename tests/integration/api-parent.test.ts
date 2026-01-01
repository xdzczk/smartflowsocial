/**
 * Integration tests for parent API route
 * 
 * Tests the API endpoint in app/routes/api.parent.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserBasicInfo: vi.fn(),
  getUserByNpubWithProfile: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { getUserBasicInfo, getUserByNpubWithProfile } from "~/models/user.server";
import { loader } from "~/routes/api.parent";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("API: Parent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
  });

  describe("Successful Requests", () => {
    it("should return parent information for child account", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub-child",
        isChild: true,
        parentNpub: "npub-parent",
      };

      const mockParent = {
        npub: "npub-parent",
        nostrProfile: JSON.stringify({
          name: "Parent User",
          display_name: "Parent Display",
          picture: "https://example.com/parent.jpg",
        }),
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserByNpubWithProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockParent);

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
      expect(getUserBasicInfo).toHaveBeenCalledWith(TEST_USER_ID);
      expect(getUserByNpubWithProfile).toHaveBeenCalledWith("npub-parent");
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
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub-child",
        isChild: true,
        parentNpub: "npub-parent",
      };

      const mockParent = {
        npub: "npub-parent",
        nostrProfile: {
          name: "Parent User",
          display_name: "Parent Display",
          picture: "https://example.com/parent.jpg",
        },
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserByNpubWithProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockParent);

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

      expect(data.parent?.name).toBe("Parent User");
      expect(data.parent?.displayName).toBe("Parent Display");
    });

    it("should handle parent with missing profile data", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub-child",
        isChild: true,
        parentNpub: "npub-parent",
      };

      const mockParent = {
        npub: "npub-parent",
        nostrProfile: null,
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserByNpubWithProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockParent);

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
      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      });

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

      expect(data).toEqual({ parent: null });
      expect(getUserByNpubWithProfile).not.toHaveBeenCalled();
    });

    it("should return null when user has no parentNpub", async () => {
      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_USER_ID,
        npub: "npub-child",
        isChild: true,
        parentNpub: null,
      });

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

      expect(data).toEqual({ parent: null });
      expect(getUserByNpubWithProfile).not.toHaveBeenCalled();
    });

    it("should return null when parent not found", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub-child",
        isChild: true,
        parentNpub: "npub-parent",
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserByNpubWithProfile as ReturnType<typeof vi.fn>).mockResolvedValue(null);

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
      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
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

      // Should return null parent on error
      expect(data).toEqual({ parent: null });
    });

    it("should handle invalid JSON in parent profile", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub-child",
        isChild: true,
        parentNpub: "npub-parent",
      };

      const mockParent = {
        npub: "npub-parent",
        nostrProfile: "invalid json",
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserByNpubWithProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockParent);

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

      // Should handle parse error gracefully
      const parent = data.parent && typeof data.parent === "object" && !Array.isArray(data.parent) ? data.parent as { name?: string; displayName?: string; picture?: string; npub?: string } : null;
      expect(parent?.name).toBeUndefined();
    });
  });
});

