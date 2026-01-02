/**
 * Integration tests for effective hashtags service
 * Tests app/features/posts/services/effective-hashtags.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/user", () => ({
  getQueueTypes: vi.fn(),
}));

import {
  getEffectiveHashtags,
  parseEffectiveHashtagsRequest,
} from "~/features/posts/services/effective-hashtags.server";
import { getQueueTypes } from "~/features/user";
import { ValidationError } from "~/lib/errors";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Effective Hashtags Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEffectiveHashtags", () => {
    it("should return empty hashtags for 'unassigned' queue type", async () => {
      const result = await getEffectiveHashtags(TEST_USER_ID, "unassigned");

      expect(getQueueTypes).not.toHaveBeenCalled();
      const jsonResult = await result.json();
      expect(jsonResult).toEqual({ hashtags: "" });
    });

    it("should throw ValidationError if neither queueTypeName nor queueTypeId provided", async () => {
      await expect(getEffectiveHashtags(TEST_USER_ID)).rejects.toThrow(
        ValidationError,
      );
      expect(getQueueTypes).not.toHaveBeenCalled();
    });

    it("should return hashtags for queue type with hashtag preset (by ID)", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "Morning",
          hashTagPreset: {
            tags: "#morning #goodmorning",
          },
        },
        {
          id: "queue-2",
          name: "Evening",
          hashTagPreset: null,
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
      );

      const result = await getEffectiveHashtags(
        TEST_USER_ID,
        undefined,
        "queue-1",
      );

      expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
      const jsonResult = await result.json();
      expect(jsonResult).toEqual({ hashtags: "#morning #goodmorning" });
    });

    it("should return hashtags for queue type with hashtag preset (by name)", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "Morning",
          hashTagPreset: {
            tags: "#morning #goodmorning",
          },
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
      );

      const result = await getEffectiveHashtags(TEST_USER_ID, "Morning");

      expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
      const jsonResult = await result.json();
      expect(jsonResult).toEqual({ hashtags: "#morning #goodmorning" });
    });

    it("should return empty hashtags if queue type has no hashtag preset", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "Morning",
          hashTagPreset: null,
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
      );

      const result = await getEffectiveHashtags(TEST_USER_ID, "Morning");

      const jsonResult = await result.json();
      expect(jsonResult).toEqual({ hashtags: "" });
    });

    it("should return empty hashtags if queue type not found", async () => {
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getEffectiveHashtags(TEST_USER_ID, "NonExistent");

      const jsonResult = await result.json();
      expect(jsonResult).toEqual({ hashtags: "" });
    });

    it("should prioritize queueTypeId over queueTypeName", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "Morning",
          hashTagPreset: {
            tags: "#morning",
          },
        },
        {
          id: "queue-2",
          name: "Evening",
          hashTagPreset: {
            tags: "#evening",
          },
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
      );

      const result = await getEffectiveHashtags(
        TEST_USER_ID,
        "Evening",
        "queue-1",
      );

      const jsonResult = await result.json();
      expect(jsonResult).toEqual({ hashtags: "#morning" });
    });

    it("should handle null tags in hashtag preset", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "Morning",
          hashTagPreset: {
            tags: null,
          },
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
      );

      const result = await getEffectiveHashtags(TEST_USER_ID, "Morning");

      const jsonResult = await result.json();
      expect(jsonResult).toEqual({ hashtags: "" });
    });
  });

  describe("parseEffectiveHashtagsRequest", () => {
    it("should parse valid request body with queueTypeName", () => {
      const body = { queueTypeName: "Morning" };
      const result = parseEffectiveHashtagsRequest(body);

      expect(result).toEqual({
        queueTypeName: "Morning",
        queueTypeId: undefined,
      });
    });

    it("should parse valid request body with queueTypeId", () => {
      const body = { queueTypeId: "queue-123" };
      const result = parseEffectiveHashtagsRequest(body);

      expect(result).toEqual({
        queueTypeName: undefined,
        queueTypeId: "queue-123",
      });
    });

    it("should parse valid request body with both", () => {
      const body = { queueTypeName: "Morning", queueTypeId: "queue-123" };
      const result = parseEffectiveHashtagsRequest(body);

      expect(result).toEqual({
        queueTypeName: "Morning",
        queueTypeId: "queue-123",
      });
    });

    it("should throw ValidationError for null body", () => {
      expect(() => parseEffectiveHashtagsRequest(null)).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError for non-object body", () => {
      expect(() => parseEffectiveHashtagsRequest("string")).toThrow(
        ValidationError,
      );
      expect(() => parseEffectiveHashtagsRequest(123)).toThrow(ValidationError);
      // Note: Arrays are objects in JavaScript, so [] would pass the check
      // The function checks typeof body === "object" && body !== null
      // Arrays pass this check, so we test with null instead
    });

    it("should handle empty object", () => {
      const result = parseEffectiveHashtagsRequest({});

      expect(result).toEqual({
        queueTypeName: undefined,
        queueTypeId: undefined,
      });
    });
  });
});
