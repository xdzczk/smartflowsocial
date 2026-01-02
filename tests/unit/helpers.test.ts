/**
 * Unit tests for helper utilities
 * Tests app/lib/helpers.ts
 */

import { describe, it, expect, vi } from "vitest";

// Mock nip19
vi.mock("nostr-tools", () => ({
  nip19: {
    decode: vi.fn((npub: string) => {
      if (!npub.startsWith("npub")) throw new Error("Invalid npub");
      return { type: "npub", data: npub.slice(4, 36) };
    }),
  },
}));

import {
  getTimeRemaining,
  convertToHex,
  formatDate,
  getImageUrls,
  isVideoFile,
} from "~/lib/helpers";

describe("Helper Utilities", () => {
  describe("getTimeRemaining", () => {
    it("should return days and hours for future dates", () => {
      const future = new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000,
      );
      const result = getTimeRemaining(future);

      expect(result).toMatch(/\d+d \d+h/);
    });

    it("should return hours and minutes for near future dates", () => {
      const future = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000);
      const result = getTimeRemaining(future);

      expect(result).toMatch(/\d+h \d+m/);
    });

    it("should return minutes and seconds for very near future dates", () => {
      const future = new Date(Date.now() + 5 * 60 * 1000 + 30 * 1000);
      const result = getTimeRemaining(future);

      expect(result).toMatch(/\d+m \d+s/);
    });

    it("should return seconds for very short durations", () => {
      const future = new Date(Date.now() + 45 * 1000);
      const result = getTimeRemaining(future);

      expect(result).toMatch(/\d+s/);
    });

    it("should handle string dates", () => {
      const future = new Date(Date.now() + 2 * 60 * 1000);
      const result = getTimeRemaining(future.toISOString());

      expect(result).toMatch(/\d+m/);
    });
  });

  describe("convertToHex", () => {
    it("should convert valid npub to hex", () => {
      const result = convertToHex("npub1abc123");

      expect(result).toBe("1abc123");
    });

    it("should return null for invalid npub", () => {
      const result = convertToHex("invalid");

      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = convertToHex("");

      expect(result).toBeNull();
    });
  });

  describe("formatDate", () => {
    it("should format date string", () => {
      const date = new Date("2024-12-25T12:00:00Z");
      const result = formatDate(date.toISOString());

      expect(result).toContain("12");
      expect(result).toContain("25");
      expect(result).toContain("2024");
    });

    it("should format Date object", () => {
      const date = new Date("2024-12-25T12:00:00Z");
      const result = formatDate(date);

      expect(result).toContain("12");
      expect(result).toContain("25");
      expect(result).toContain("2024");
    });
  });

  describe("getImageUrls", () => {
    it("should return array of URLs", () => {
      const urls = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ];
      const result = getImageUrls(urls);

      expect(result).toEqual(urls);
    });

    it("should parse JSON string array", () => {
      const jsonString = JSON.stringify([
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ]);
      const result = getImageUrls([jsonString]);

      expect(result).toEqual([
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ]);
    });

    it("should return empty array for empty input", () => {
      const result = getImageUrls([]);

      expect(result).toEqual([]);
    });

    it("should handle invalid JSON gracefully", () => {
      // Invalid JSON that doesn't start with '[' will be returned as-is
      const result = getImageUrls(["invalid-json["]);

      // The function only parses if it starts with '[', otherwise returns as-is
      expect(result).toEqual(["invalid-json["]);
    });
  });

  describe("isVideoFile", () => {
    it("should identify video files by extension", () => {
      expect(isVideoFile("https://example.com/video.mp4")).toBe(true);
      expect(isVideoFile("https://example.com/video.mov")).toBe(true);
      expect(isVideoFile("https://example.com/video.webm")).toBe(true);
      expect(isVideoFile("https://example.com/video.avi")).toBe(true);
    });

    it("should return false for non-video files", () => {
      expect(isVideoFile("https://example.com/image.jpg")).toBe(false);
      expect(isVideoFile("https://example.com/image.png")).toBe(false);
      expect(isVideoFile("https://example.com/file.pdf")).toBe(false);
    });

    it("should handle URLs with query parameters", () => {
      expect(isVideoFile("https://example.com/video.mp4?param=value")).toBe(
        true,
      );
      expect(isVideoFile("https://example.com/video.mp4#fragment")).toBe(true);
    });

    it("should return false for invalid input", () => {
      expect(isVideoFile("")).toBe(false);
      expect(isVideoFile(null as unknown as string)).toBe(false);
      expect(isVideoFile(undefined as unknown as string)).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(isVideoFile("https://example.com/video.MP4")).toBe(true);
      expect(isVideoFile("https://example.com/video.MOV")).toBe(true);
    });
  });
});
