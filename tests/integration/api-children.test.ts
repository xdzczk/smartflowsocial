/**
 * Integration tests for children API route
 * 
 * Tests the API endpoint in app/routes/api.children.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserBasicInfo: vi.fn(),
  getConfirmedChildrenForParent: vi.fn(),
}));

vi.mock("~/models/payment.server", () => ({
  getUserSubscription: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { getUserSubscription } from "~/models/payment.server";
import { getUserBasicInfo, getConfirmedChildrenForParent } from "~/models/user.server";
import { loader } from "~/routes/api.children";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("API: Children", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
  });

  describe("Successful Requests", () => {
    it("should return children for parent with premium subscription", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      };

      const mockSubscription = {
        planId: "premium",
        Plan: { name: "Premium" },
      };

      const mockChildren = [
        {
          npub: "npub-child-1",
          nostrProfile: JSON.stringify({
            name: "Child 1",
            display_name: "Child One",
            picture: "https://example.com/pic1.jpg",
          }),
        },
        {
          npub: "npub-child-2",
          nostrProfile: JSON.stringify({
            name: "Child 2",
            display_name: "Child Two",
            picture: "https://example.com/pic2.jpg",
          }),
        },
      ];

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubscription);
      (getConfirmedChildrenForParent as ReturnType<typeof vi.fn>).mockResolvedValue(mockChildren);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(getUserBasicInfo).toHaveBeenCalledWith(TEST_USER_ID);
      expect(getUserSubscription).toHaveBeenCalledWith(TEST_USER_ID);
      expect(getConfirmedChildrenForParent).toHaveBeenCalledWith("npub123");
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
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      };

      const mockSubscription = {
        planId: "basic",
        Plan: { name: "Founder" },
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubscription);
      (getConfirmedChildrenForParent as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(data.children).toEqual([]);
    });

    it("should handle case-insensitive plan matching", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      };

      const mockSubscription = {
        planId: "PREMIUM",
        Plan: { name: "premium" },
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubscription);
      (getConfirmedChildrenForParent as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(data.children).toEqual([]);
    });

    it("should handle children with missing profile data", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      };

      const mockSubscription = {
        planId: "premium",
        Plan: { name: "Premium" },
      };

      const mockChildren = [
        {
          npub: "npub-child-1",
          nostrProfile: null,
        },
      ];

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubscription);
      (getConfirmedChildrenForParent as ReturnType<typeof vi.fn>).mockResolvedValue(mockChildren);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

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
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      };

      const mockSubscription = {
        planId: "premium",
        Plan: { name: "Premium" },
      };

      const mockChildren = [
        {
          npub: "npub-child-1",
          nostrProfile: {
            name: "Child 1",
            display_name: "Child One",
            picture: "https://example.com/pic.jpg",
          },
        },
      ];

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubscription);
      (getConfirmedChildrenForParent as ReturnType<typeof vi.fn>).mockResolvedValue(mockChildren);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(data.children[0].name).toBe("Child 1");
      expect(data.children[0].displayName).toBe("Child One");
      expect(data.children[0].picture).toBe("https://example.com/pic.jpg");
    });
  });

  describe("Access Control", () => {
    it("should return empty array when user has no npub", async () => {
      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_USER_ID,
        npub: null,
      });

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(data).toEqual({ children: [] });
      expect(getUserSubscription).not.toHaveBeenCalled();
    });

    it("should return empty array when user is a child account", async () => {
      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: true,
      });

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(data).toEqual({ children: [] });
      expect(getUserSubscription).not.toHaveBeenCalled();
    });

    it("should return empty array when user doesn't have premium/founder subscription", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      };

      const mockSubscription = {
        planId: "basic",
        Plan: { name: "Basic" },
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubscription);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      expect(data).toEqual({ children: [] });
      expect(getConfirmedChildrenForParent).not.toHaveBeenCalled();
    });

    it("should return empty array when subscription is null", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      };

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

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
      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      // Should return empty array on error
      expect(data).toEqual({ children: [] });
    });

    it("should handle invalid JSON in nostrProfile", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: "npub123",
        isChild: false,
      };

      const mockSubscription = {
        planId: "premium",
        Plan: { name: "Premium" },
      };

      const mockChildren = [
        {
          npub: "npub-child-1",
          nostrProfile: "invalid json",
        },
      ];

      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubscription);
      (getConfirmedChildrenForParent as ReturnType<typeof vi.fn>).mockResolvedValue(mockChildren);

      const request = new Request("http://localhost:3000/api/children");

      interface LoaderArgs {
        request: Request;
        params: Record<string, string | undefined>;
        context: Record<string, unknown>;
      }
      const response = await loader({ request, params: {}, context: {} } as LoaderArgs);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { children?: Array<{ name?: string; displayName?: string; npub?: string; picture?: string }> } : {};

      // Should handle parse error gracefully
      const children = Array.isArray(data.children) ? data.children : [];
      const firstChild = children[0] && typeof children[0] === "object" && !Array.isArray(children[0]) ? children[0] as { name?: string; displayName?: string; npub?: string; picture?: string } : {};
      expect(firstChild.name).toBeUndefined();
    });
  });
});

