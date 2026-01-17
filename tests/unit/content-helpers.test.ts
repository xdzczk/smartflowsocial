/**
 * Unit tests for content helper functions
 * Tests pure utility functions in app/features/posts/utils/content-helpers.ts
 */

import { describe, it, expect } from "vitest";

import type { CombinedContent } from "~/features/posts/combined.server";
import {
  getImageUrls,
  getContentTitle,
  getContentPreview,
  getStatusColor,
  getStatusText,
  formatDate,
  getQueueTypeDisplay,
  getContentTypeBadge,
} from "~/features/posts/utils/content-helpers";

describe("Content Helpers", () => {
  describe("getImageUrls", () => {
    it("should return empty array for undefined", () => {
      expect(getImageUrls(undefined)).toEqual([]);
    });

    it("should return empty array for empty array", () => {
      expect(getImageUrls([])).toEqual([]);
    });

    it("should return array as-is for string array", () => {
      const urls = ["url1", "url2", "url3"];
      expect(getImageUrls(urls)).toEqual(urls);
    });

    it("should parse JSON string array", () => {
      const jsonString = '["url1", "url2", "url3"]';
      expect(getImageUrls([jsonString])).toEqual(["url1", "url2", "url3"]);
    });

    it("should return empty array for invalid JSON", () => {
      const invalidJson = '["url1", "url2"';
      expect(getImageUrls([invalidJson])).toEqual([]);
    });

    it("should handle non-JSON strings", () => {
      const regularString = "not-json";
      expect(getImageUrls([regularString])).toEqual([regularString]);
    });
  });

  describe("getContentTitle", () => {
    it("should return title for longform posts", () => {
      const item: CombinedContent = {
        type: "longform",
        id: "1",
        title: "Test Article",
      } as unknown as CombinedContent;
      expect(getContentTitle(item)).toBe("Test Article");
    });

    it("should return 'Untitled Article' for longform without title", () => {
      const item: CombinedContent = {
        type: "longform",
        id: "1",
      } as unknown as CombinedContent;
      expect(getContentTitle(item)).toBe("Untitled Article");
    });

    it("should return full caption for short captions", () => {
      const item: CombinedContent = {
        type: "post",
        id: "1",
        caption: "Short caption",
      } as unknown as CombinedContent;
      expect(getContentTitle(item)).toBe("Short caption");
    });

    it("should truncate long captions", () => {
      const longCaption = "a".repeat(60);
      const item: CombinedContent = {
        type: "post",
        id: "1",
        caption: longCaption,
      } as unknown as CombinedContent;
      const result = getContentTitle(item);
      expect(result).toHaveLength(53); // 50 + "..."
      expect(result.endsWith("...")).toBe(true);
    });

    it("should return 'No caption' for posts without caption", () => {
      const item: CombinedContent = {
        type: "post",
        id: "1",
      } as unknown as CombinedContent;
      expect(getContentTitle(item)).toBe("No caption");
    });
  });

  describe("getContentPreview", () => {
    it("should return summary for longform posts", () => {
      const item: CombinedContent = {
        type: "longform",
        id: "1",
        summary: "Article summary",
      } as unknown as CombinedContent;
      expect(getContentPreview(item)).toBe("Article summary");
    });

    it("should return truncated content if no summary", () => {
      const longContent = "a".repeat(150);
      const item: CombinedContent = {
        type: "longform",
        id: "1",
        content: longContent,
      } as unknown as CombinedContent;
      const result = getContentPreview(item);
      expect(result).toHaveLength(103); // 100 + "..."
      expect(result?.endsWith("...")).toBe(true);
    });

    it("should return 'No content' for longform without content or summary", () => {
      const item: CombinedContent = {
        type: "longform",
        id: "1",
      } as unknown as CombinedContent;
      expect(getContentPreview(item)).toBe("No content");
    });

    it("should return null for posts", () => {
      const item: CombinedContent = {
        type: "post",
        id: "1",
        caption: "Test",
      } as unknown as CombinedContent;
      expect(getContentPreview(item)).toBeNull();
    });
  });

  describe("getStatusColor", () => {
    it("should return orange for drafts", () => {
      const item: CombinedContent = {
        id: "1",
        currentState: "DRAFT",
      } as unknown as CombinedContent;
      const result = getStatusColor(item);
      expect(result).toContain("orange");
    });

    it("should return green for posted items", () => {
      const item: CombinedContent = {
        id: "1",
        currentState: "PUBLISHED",
        type: "post",
      } as unknown as CombinedContent;
      const result = getStatusColor(item);
      expect(result).toContain("green");
    });

    it("should return green for published items", () => {
      const item: CombinedContent = {
        id: "1",
        currentState: "PUBLISHED",
        type: "longform",
      } as unknown as CombinedContent;
      const result = getStatusColor(item);
      expect(result).toContain("green");
    });

    it("should return blue for scheduled items", () => {
      const item: CombinedContent = {
        id: "1",
        currentState: "SCHEDULED",
      } as unknown as CombinedContent;
      const result = getStatusColor(item);
      expect(result).toContain("blue");
    });

    it("should return gray for unknown status", () => {
      const item: CombinedContent = {
        id: "1",
      } as unknown as CombinedContent;
      const result = getStatusColor(item);
      expect(result).toContain("gray");
    });
  });

  describe("getStatusText", () => {
    it("should return 'Draft' for drafts", () => {
      const item: CombinedContent = {
        id: "1",
        currentState: "DRAFT",
      } as unknown as CombinedContent;
      expect(getStatusText(item)).toBe("Draft");
    });

    it("should return 'Posted' for posted items", () => {
      const item: CombinedContent = {
        id: "1",
        currentState: "PUBLISHED",
        type: "post",
      } as unknown as CombinedContent;
      expect(getStatusText(item)).toBe("Posted");
    });

    it("should return 'Published' for published longform items", () => {
      const item: CombinedContent = {
        id: "1",
        currentState: "PUBLISHED",
        type: "longform",
      } as unknown as CombinedContent;
      expect(getStatusText(item)).toBe("Published");
    });

    it("should return 'Scheduled' for scheduled items", () => {
      const item: CombinedContent = {
        id: "1",
        currentState: "SCHEDULED",
      } as unknown as CombinedContent;
      expect(getStatusText(item)).toBe("Scheduled");
    });

    it("should return 'Unknown' for unknown status", () => {
      const item: CombinedContent = {
        id: "1",
      } as unknown as CombinedContent;
      expect(getStatusText(item)).toBe("Unknown");
    });
  });

  describe("formatDate", () => {
    it("should return '-' for undefined date", () => {
      expect(formatDate(undefined)).toBe("-");
    });

    it("should format Date object", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = formatDate(date);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/); // MM/DD/YYYY format
    });

    it("should format ISO string", () => {
      const dateString = "2024-01-15T14:30:00Z";
      const result = formatDate(dateString);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it("should handle Unix timestamp string", () => {
      const timestamp = "1705327800"; // 2024-01-15T14:30:00Z
      const result = formatDate(timestamp, true);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it("should use provided timezone", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const resultUTC = formatDate(date, false, "UTC");
      const resultNY = formatDate(date, false, "America/New_York");
      // Times should differ due to timezone
      expect(resultUTC).not.toBe(resultNY);
    });
  });

  describe("getQueueTypeDisplay", () => {
    it("should return display info for queue type with color", () => {
      const queueType = {
        name: "Morning",
        color: "#FF5733",
        id: "1",
      };
      const result = getQueueTypeDisplay(queueType);
      expect(result.name).toBe("Morning");
      expect(result.style?.backgroundColor).toContain("#FF5733");
      expect(result.style?.color).toBe("#FF5733");
    });

    it("should return display info for queue type without color", () => {
      const queueType = {
        name: "unassigned",
        id: "1",
      };
      const result = getQueueTypeDisplay(queueType);
      expect(result.name).toBe("unassigned");
      expect(result.className).toContain("inline-flex");
    });

    it("should handle null queue type", () => {
      const result = getQueueTypeDisplay(undefined);
      expect(result.name).toBe("unassigned");
    });

    it("should handle undefined queue type", () => {
      const result = getQueueTypeDisplay(undefined);
      expect(result.name).toBe("unassigned");
    });
  });

  describe("getContentTypeBadge", () => {
    it("should return REPOST badge for kind 6", () => {
      const item: CombinedContent = {
        id: "1",
        signedEvent: {
          kind: 6,
        },
      } as unknown as CombinedContent;
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("REPOST");
      expect(result.className).toContain("orange");
    });

    it("should return LONG-FORM badge for kind 30023", () => {
      const item: CombinedContent = {
        id: "1",
        signedEvent: {
          kind: 30023,
        },
      } as unknown as CombinedContent;
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("LONG-FORM");
      expect(result.className).toContain("purple");
    });

    it("should return Post badge for regular posts", () => {
      const item: CombinedContent = {
        id: "1",
        type: "post",
      } as unknown as CombinedContent;
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("Post");
      expect(result.className).toContain("blue");
    });

    it("should return Article badge for longform type", () => {
      const item: CombinedContent = {
        id: "1",
        type: "longform",
      } as unknown as CombinedContent;
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("Article");
      expect(result.className).toContain("purple");
    });

    it("should check originalData.signedEvent for kind", () => {
      const item: CombinedContent = {
        id: "1",
        originalData: {
          signedEvent: {
            kind: 6,
          },
        },
      } as unknown as CombinedContent;
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("REPOST");
    });
  });
});
