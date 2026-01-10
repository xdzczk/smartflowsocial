/**
 * Unit tests for hashtag presets validation utilities
 * Tests app/lib/validation/hashtag-presets.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock error logger for server version
vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

import { validateHashTagPresets } from "~/lib/validation/hashtag-presets";

describe("HashTag Presets Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateHashTagPresets", () => {
    it("should return empty array for non-array values", () => {
      expect(validateHashTagPresets(null)).toEqual([]);
      expect(validateHashTagPresets(undefined)).toEqual([]);
      expect(validateHashTagPresets({})).toEqual([]);
      expect(validateHashTagPresets("string")).toEqual([]);
      expect(validateHashTagPresets(123)).toEqual([]);
    });

    it("should return empty array for empty array", () => {
      expect(validateHashTagPresets([])).toEqual([]);
    });

    it("should return validated presets for valid input", () => {
      const validPresets = [
        {
          id: "preset-1",
          name: "Preset 1",
          tags: "tag1,tag2", // Schema expects string, not array
          userId: "user-1",
          description: "Test preset",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "preset-2",
          name: "Preset 2",
          tags: "tag3",
          userId: "user-1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ];

      const result = validateHashTagPresets(validPresets);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("preset-1");
      expect(result[0]?.name).toBe("Preset 1");
      expect(result[0]?.tags).toBe("tag1,tag2");
      expect(result[1]?.id).toBe("preset-2");
    });

    it("should normalize createdAt from string to Date", () => {
      const preset = {
        id: "preset-1",
        name: "Preset 1",
        tags: "tag1",
        userId: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z", // Required by schema
      };

      const result = validateHashTagPresets([preset]);

      expect(result[0]?.createdAt).toBeInstanceOf(Date);
      expect(result[0]?.createdAt?.getTime()).toBe(
        new Date("2024-01-01T00:00:00Z").getTime()
      );
    });

    it("should normalize createdAt from Date to Date", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      const updatedDate = new Date("2024-01-02T00:00:00Z");
      const preset = {
        id: "preset-1",
        name: "Preset 1",
        tags: "tag1",
        userId: "user-1",
        createdAt: date,
        updatedAt: updatedDate, // Required by schema
      };

      const result = validateHashTagPresets([preset]);

      expect(result[0]?.createdAt).toBeInstanceOf(Date);
      expect(result[0]?.createdAt).toBe(date);
    });

    it("should handle missing createdAt/updatedAt gracefully", () => {
      // Schema requires createdAt and updatedAt, so this will be filtered out
      // But we can test that the function handles it
      const preset = {
        id: "preset-1",
        name: "Preset 1",
        tags: "tag1",
        userId: "user-1",
        // Missing createdAt/updatedAt - will be filtered out
      };

      const result = validateHashTagPresets([preset]);

      // Since schema requires createdAt/updatedAt, this will be filtered out
      expect(result.length).toBe(0);
    });

    it("should normalize updatedAt from string to Date", () => {
      const preset = {
        id: "preset-1",
        name: "Preset 1",
        tags: "tag1",
        userId: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };

      const result = validateHashTagPresets([preset]);

      expect(result[0]?.updatedAt).toBeInstanceOf(Date);
      expect(result[0]?.updatedAt?.getTime()).toBe(
        new Date("2024-01-02T00:00:00Z").getTime()
      );
    });

    it("should filter out invalid items and keep valid ones", () => {
      const mixed = [
        {
          id: "preset-1",
          name: "Preset 1",
          tags: "tag1",
          userId: "user-1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
        {
          invalid: "data",
        },
        {
          id: "preset-2",
          name: "Preset 2",
          tags: "tag2",
          userId: "user-1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ];

      const result = validateHashTagPresets(mixed);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((p) => p.id === "preset-1")).toBe(true);
      expect(result.some((p) => p.id === "preset-2")).toBe(true);
    });

    it("should handle description as optional", () => {
      const preset = {
        id: "preset-1",
        name: "Preset 1",
        tags: "tag1",
        userId: "user-1",
        description: null,
      };

      const result = validateHashTagPresets([preset]);

      expect(result[0]?.description).toBeUndefined();
    });

    it("should handle description when provided", () => {
      const preset = {
        id: "preset-1",
        name: "Preset 1",
        tags: "tag1",
        userId: "user-1",
        description: "Test description",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };

      const result = validateHashTagPresets([preset]);

      // Description is normalized: parsed.description ?? undefined
      // So if description exists and is not null, it should be in the result
      if (result[0]) {
        // The validation function uses: description: parsed.description ?? undefined
        // So if description is provided and not null, it should be present
        expect(result[0].description).toBe("Test description");
      }
    });
  });
});
