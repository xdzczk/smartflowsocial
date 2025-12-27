/**
 * Integration tests for search loader
 * 
 * Tests the loader in app/features/search/services/search-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
}));

import { loadSearchData } from "~/features/search/services/search-loader.server";
import { getUserById } from "~/models/user.server";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("Search Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful Data Loading", () => {
    it("should load search page data with user", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        name: "Test User",
        npub: "npub123",
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await loadSearchData(TEST_USER_ID);

      expect(getUserById).toHaveBeenCalledWith(TEST_USER_ID);
      expect(result).toEqual({
        user: mockUser,
      });
    });

    it("should handle user with minimal data", async () => {
      const mockUser = {
        id: TEST_USER_ID,
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await loadSearchData(TEST_USER_ID);

      expect(result.user).toEqual(mockUser);
    });

    it("should handle user with all fields", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        name: "Test User",
        npub: "npub123",
        email: "test@example.com",
        createdAt: new Date(),
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await loadSearchData(TEST_USER_ID);

      expect(result.user).toEqual(mockUser);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null user gracefully", async () => {
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await loadSearchData(TEST_USER_ID);

      expect(result.user).toBeNull();
    });

    it("should handle undefined user gracefully", async () => {
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await loadSearchData(TEST_USER_ID);

      expect(result.user).toBeUndefined();
    });
  });
});







