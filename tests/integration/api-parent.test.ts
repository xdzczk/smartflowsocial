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

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

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

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.parent.name).toBe("Parent User");
      expect(data.parent.displayName).toBe("Parent Display");
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

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

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

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

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

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

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

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data).toEqual({ parent: null });
    });
  });

  describe("Error Handling", () => {
    it("should require authentication", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required"),
      );

      const request = new Request("http://localhost:3000/api/parent");

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      (getUserBasicInfo as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const request = new Request("http://localhost:3000/api/parent");

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

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

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Should handle parse error gracefully
      expect(data.parent.name).toBeUndefined();
    });
  });
});

