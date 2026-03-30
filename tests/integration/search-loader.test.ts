/**
 * Integration tests for search loader
 *
 * Tests the loader in app/features/search/services/search-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

vi.mock("~/features/relays/relay-resolution.server", () => ({
  resolveExecutionRelays: vi
    .fn()
    .mockResolvedValue(["wss://relay.example.test"]),
}));

import { TEST_USER_ID } from "../utils/test-helpers";

import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { loadSearchData } from "~/features/search/services/search-loader.server";
import { getUserById } from "~/features/user";

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
      expect(resolveExecutionRelays).toHaveBeenCalledWith(TEST_USER_ID);
      expect(result).toEqual({
        user: mockUser,
        publishRelays: ["wss://relay.example.test"],
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
