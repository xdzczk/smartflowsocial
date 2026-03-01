/**
 * Unit tests for user data validation utilities
 * Tests app/lib/validation/user-data.ts
 */

import { describe, it, expect } from "vitest";

import { validateUserData } from "~/lib/validation/user-data";

describe("User Data Validation", () => {
  describe("validateUserData", () => {
    it("should return null for null input", () => {
      expect(validateUserData(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(validateUserData(undefined)).toBeNull();
    });

    it("should return null for non-object input", () => {
      expect(validateUserData("string")).toBeNull();
      expect(validateUserData(123)).toBeNull();
      expect(validateUserData([])).toBeNull();
    });

    it("should return null for invalid user structure", () => {
      const invalid = {
        invalid: "data",
      };

      expect(validateUserData(invalid)).toBeNull();
    });

    it("should return validated UserData for valid input", () => {
      const validUser = {
        id: "user-1",
        npub: "npub1test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        isEnabled: true,
        timezone: "America/New_York",
        userRelays: ["relay1", "relay2"],
        giveawayBlackListed: [],
        uploadProvider: "BLOSSOM_PRIMAL",
        scheduleInterval: [4, 8],
        pendingParentRequests: [],
      };

      const result = validateUserData(validUser);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe("user-1");
        expect(result.npub).toBe("npub1test");
        expect(result.pubKey).toBe("npub1test");
        expect(result.timezone).toBe("America/New_York");
        expect(result.scheduleInterval).toEqual([4, 8]);
        expect(result.userRelays).toEqual(["relay1", "relay2"]);
        expect(result.isEnabled).toBe(true);
      }
    });

    it("should accept BLOSSOM_CUSTOM as upload provider", () => {
      const validUser = {
        id: "user-1",
        npub: "npub1test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        isEnabled: true,
        timezone: "America/New_York",
        userRelays: ["relay1", "relay2"],
        giveawayBlackListed: [],
        uploadProvider: "BLOSSOM_CUSTOM",
        scheduleInterval: [4, 8],
        pendingParentRequests: [],
      };

      const result = validateUserData(validUser);
      expect(result).not.toBeNull();
    });

    it("should convert scheduleInterval from strings to numbers", () => {
      const user = {
        id: "user-1",
        npub: "npub1test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        isEnabled: true,
        timezone: null,
        userRelays: [],
        giveawayBlackListed: [],
        uploadProvider: "BLOSSOM_PRIMAL",
        scheduleInterval: ["4", "8", "invalid"],
        pendingParentRequests: [],
      };

      const result = validateUserData(user);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.scheduleInterval).toEqual([4, 8]);
      }
    });

    it("should handle scheduleInterval with numbers", () => {
      const user = {
        id: "user-1",
        npub: "npub1test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        isEnabled: true,
        timezone: null,
        userRelays: [],
        giveawayBlackListed: [],
        uploadProvider: "BLOSSOM_PRIMAL",
        scheduleInterval: [4, 8],
        pendingParentRequests: [],
      };

      const result = validateUserData(user);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.scheduleInterval).toEqual([4, 8]);
      }
    });

    it("should handle null timezone", () => {
      const user = {
        id: "user-1",
        npub: "npub1test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        isEnabled: true,
        timezone: null,
        userRelays: [],
        giveawayBlackListed: [],
        uploadProvider: "BLOSSOM_PRIMAL",
        scheduleInterval: [],
        pendingParentRequests: [],
      };

      const result = validateUserData(user);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.timezone).toBeNull();
      }
    });

    it("should handle empty scheduleInterval", () => {
      const user = {
        id: "user-1",
        npub: "npub1test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        isEnabled: true,
        timezone: null,
        userRelays: [],
        giveawayBlackListed: [],
        uploadProvider: "BLOSSOM_PRIMAL",
        scheduleInterval: [],
        pendingParentRequests: [],
      };

      const result = validateUserData(user);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.scheduleInterval).toEqual([]);
      }
    });

    it("should handle missing optional fields", () => {
      const user = {
        id: "user-1",
        npub: "npub1test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        isEnabled: true,
        timezone: null,
        userRelays: [],
        giveawayBlackListed: [],
        uploadProvider: "BLOSSOM_PRIMAL",
        scheduleInterval: [],
        pendingParentRequests: [],
      };

      const result = validateUserData(user);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.userRelays).toEqual([]);
      }
    });
  });
});
