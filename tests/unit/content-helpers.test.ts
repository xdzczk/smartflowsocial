/**
 * Unit tests for content helper functions
 * Tests pure utility functions in app/features/posts/utils/content-helpers.ts
 */

import { describe, it, expect } from "vitest";

import { combinedContentFactory } from "../factories";

import type { PostData } from "~/features/posts/types";
import {
  getImageUrls,
  getMediaPreviewUrls,
  getContentTitle,
  getContentPreview,
  getStatusColor,
  getStatusText,
  formatDate,
  getQueueTypeDisplay,
  getContentTypeBadge,
  isRepostPost,
  isRepostContent,
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

  describe("getMediaPreviewUrls", () => {
    it("returns longform image sliced by max", () => {
      const item = combinedContentFactory.longform({
        id: "1",
        image: "https://example.com/img.jpg",
      });
      expect(getMediaPreviewUrls(item, 1)).toEqual([
        "https://example.com/img.jpg",
      ]);
      expect(getMediaPreviewUrls(item, 4)).toEqual([
        "https://example.com/img.jpg",
      ]);
    });
    it("returns empty for longform without image", () => {
      const item = combinedContentFactory.longform({ id: "1" });
      expect(getMediaPreviewUrls(item)).toEqual([]);
    });
    it("returns fileUrl slice for post", () => {
      const item = combinedContentFactory.post({
        id: "1",
        fileUrl: ["a", "b", "c", "d", "e"],
      });
      expect(getMediaPreviewUrls(item, 2)).toEqual(["a", "b"]);
    });
  });

  describe("getContentTitle", () => {
    it("should return title for longform posts", () => {
      const item = combinedContentFactory.longform({
        id: "1",
        title: "Test Article",
      });
      expect(getContentTitle(item)).toBe("Test Article");
    });

    it("should return 'Untitled Article' for longform without title", () => {
      const item = combinedContentFactory.longform({ id: "1" });
      expect(getContentTitle(item)).toBe("Untitled Article");
    });

    it("should return full caption for short captions", () => {
      const item = combinedContentFactory.post({
        id: "1",
        caption: "Short caption",
      });
      expect(getContentTitle(item)).toBe("Short caption");
    });

    it("should truncate long captions", () => {
      const longCaption = "a".repeat(60);
      const item = combinedContentFactory.post({
        id: "1",
        caption: longCaption,
      });
      const result = getContentTitle(item);
      expect(result).toHaveLength(53); // 50 + "..."
      expect(result.endsWith("...")).toBe(true);
    });

    it("should return 'No caption' for posts without caption", () => {
      const item = combinedContentFactory.post({ id: "1" });
      expect(getContentTitle(item)).toBe("No caption");
    });
  });

  describe("getContentPreview", () => {
    it("should return summary for longform posts", () => {
      const item = combinedContentFactory.longform({
        id: "1",
        summary: "Article summary",
      });
      expect(getContentPreview(item)).toBe("Article summary");
    });

    it("should return truncated content if no summary", () => {
      const longContent = "a".repeat(150);
      const item = combinedContentFactory.longform({
        id: "1",
        content: longContent,
      });
      const result = getContentPreview(item);
      expect(result).toHaveLength(103); // 100 + "..."
      expect(result?.endsWith("...")).toBe(true);
    });

    it("should return 'No content' for longform without content or summary", () => {
      const item = combinedContentFactory.longform({ id: "1" });
      expect(getContentPreview(item)).toBe("No content");
    });

    it("should return null for posts", () => {
      const item = combinedContentFactory.post({
        id: "1",
        caption: "Test",
      });
      expect(getContentPreview(item)).toBeNull();
    });
  });

  describe("getStatusColor", () => {
    it("should return neutral border/primary text for drafts", () => {
      const item = combinedContentFactory.post({
        id: "1",
        currentState: "DRAFT",
      });
      const result = getStatusColor(item);
      expect(result).toContain("border");
      expect(result).toContain("text-text");
    });

    it("should return success styling for posted items", () => {
      const item = combinedContentFactory.post({
        id: "1",
        currentState: "PUBLISHED",
      });
      const result = getStatusColor(item);
      expect(result).toContain("success");
    });

    it("should return success styling for published items", () => {
      const item = combinedContentFactory.longform({
        id: "1",
        currentState: "PUBLISHED",
      });
      const result = getStatusColor(item);
      expect(result).toContain("success");
    });

    it("should return secondary text styling for scheduled items", () => {
      const item = combinedContentFactory.post({
        id: "1",
        currentState: "SCHEDULED",
      });
      const result = getStatusColor(item);
      expect(result).toContain("text-text-secondary");
    });

    it("should return secondary text styling for unknown status", () => {
      const item = combinedContentFactory.post({ id: "1" });
      const result = getStatusColor(item);
      expect(result).toContain("text-text-secondary");
    });

    it("should return danger tokens for FAILED state", () => {
      const item = combinedContentFactory.post({
        id: "1",
        currentState: "FAILED",
      });
      const result = getStatusColor(item);
      expect(result).toContain("danger");
    });

    it("should return secondary text for CANCELLED state", () => {
      const item = combinedContentFactory.post({
        id: "1",
        currentState: "CANCELLED",
      });
      const result = getStatusColor(item);
      expect(result).toContain("text-text-secondary");
    });

    it("should return danger tokens for longform FAILED state", () => {
      const item = combinedContentFactory.longform({
        id: "1",
        currentState: "FAILED",
      });
      const result = getStatusColor(item);
      expect(result).toContain("danger");
    });

    it("should return secondary text for longform CANCELLED state", () => {
      const item = combinedContentFactory.longform({
        id: "1",
        currentState: "CANCELLED",
      });
      const result = getStatusColor(item);
      expect(result).toContain("text-text-secondary");
    });

    it("should use currentState from originalData when item.currentState missing", () => {
      const item = combinedContentFactory.post({
        id: "1",
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        originalData: { currentState: "PUBLISHED" } as never,
      });
      const result = getStatusColor(item);
      expect(result).toContain("success");
    });
  });

  describe("getStatusText", () => {
    it("should return 'Draft' for drafts", () => {
      const item = combinedContentFactory.post({
        id: "1",
        currentState: "DRAFT",
      });
      expect(getStatusText(item)).toBe("Draft");
    });

    it("should return 'Published' for posted items", () => {
      const item = combinedContentFactory.post({
        id: "1",
        currentState: "PUBLISHED",
      });
      expect(getStatusText(item)).toBe("Published");
    });

    it("should return 'Published' for published longform items", () => {
      const item = combinedContentFactory.longform({
        id: "1",
        currentState: "PUBLISHED",
      });
      expect(getStatusText(item)).toBe("Published");
    });

    it("should return 'Scheduled' for scheduled items", () => {
      const item = combinedContentFactory.post({
        id: "1",
        currentState: "SCHEDULED",
      });
      expect(getStatusText(item)).toBe("Scheduled");
    });

    it("should return 'Unknown' for unknown status", () => {
      const item = combinedContentFactory.post({ id: "1" });
      expect(getStatusText(item)).toBe("Unknown");
    });

    it("should use getStatusTextFromStateLongForm for longform type", () => {
      const item = combinedContentFactory.longform({
        id: "1",
        currentState: "DRAFT",
      });
      expect(getStatusText(item)).toBe("Draft");
    });
  });

  describe("formatDate", () => {
    it("should return '-' for undefined date", () => {
      expect(formatDate(undefined)).toBe("-");
    });

    it("should format Date object", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = formatDate(date);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/); // DD/MM/YYYY format
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

    it("should return '-' for invalid Date (NaN)", () => {
      const invalidDate = new Date("invalid");
      expect(formatDate(invalidDate)).toBe("-");
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
    it("should return display info for queue type with color token", () => {
      const queueType = {
        name: "Morning",
        colorToken: "red",
        id: "1",
      };
      const result = getQueueTypeDisplay(queueType);
      expect(result.name).toBe("Morning");
      // red token: accent #DC2626; surface is rgba(220,38,38,0.12)
      expect(result.style?.backgroundColor).toMatch(/220|#DC2626/);
      expect(result.style?.color).toBe("#DC2626");
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
    it("should return REPOST badge when postKind is REPOST", () => {
      const item = combinedContentFactory.post({
        id: "1",
        postKind: "REPOST",
      });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("REPOST");
      expect(result.className).toContain("inline-flex");
    });

    it("should return QUOTE badge when postKind is QUOTE", () => {
      const item = combinedContentFactory.post({
        id: "1",
        postKind: "QUOTE",
      });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("QUOTE");
    });

    it("should return THREAD badge when postKind is THREAD", () => {
      const item = combinedContentFactory.post({
        id: "1",
        postKind: "THREAD",
      });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("THREAD");
    });

    it("should return REPLY badge when postKind is REPLY", () => {
      const item = combinedContentFactory.post({
        id: "1",
        postKind: "REPLY",
      });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("REPLY");
    });

    it("should use originalData.postKind when postKind is absent", () => {
      const item = combinedContentFactory.post({
        id: "1",
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        originalData: { postKind: "REPOST" } as never,
      });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("REPOST");
    });

    it("should return REPOST badge for kind 6", () => {
      const item = combinedContentFactory.post({
        id: "1",
        signedEvent: { kind: 6 },
      });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("REPOST");
      expect(result.className).toContain("inline-flex");
    });

    it("should return ARTICLE badge for kind 30023", () => {
      const item = combinedContentFactory.post({
        id: "1",
        signedEvent: { kind: 30023 },
      });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("ARTICLE");
      expect(result.className).toContain("inline-flex");
    });

    it("should return Post badge for regular posts", () => {
      const item = combinedContentFactory.post({ id: "1" });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("POST");
      expect(result.className).toContain("inline-flex");
    });

    it("should return Article badge for longform type", () => {
      const item = combinedContentFactory.longform({ id: "1" });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("Article");
      expect(result.className).toContain("inline-flex");
    });

    it("should check originalData.signedEvent for kind", () => {
      const item = combinedContentFactory.post({
        id: "1",
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        originalData: {
          signedEvent: { kind: 6 },
        } as never,
      });
      const result = getContentTypeBadge(item);
      expect(result.text).toBe("REPOST");
    });
  });

  describe("isRepostPost", () => {
    it("returns true when postKind is REPOST", () => {
      expect(
        isRepostPost(
          combinedContentFactory.post({
            postKind: "REPOST",
          }) as unknown as PostData
        )
      ).toBe(true);
    });
    it("returns false when postKind is not REPOST", () => {
      expect(
        isRepostPost(
          combinedContentFactory.post({
            postKind: "QUOTE",
          }) as unknown as PostData
        )
      ).toBe(false);
    });
  });

  describe("isRepostContent", () => {
    it("returns false for longform", () => {
      expect(
        isRepostContent(combinedContentFactory.longform({ postKind: "REPOST" }))
      ).toBe(false);
    });
    it("returns true when type is post and postKind is REPOST", () => {
      expect(
        isRepostContent(combinedContentFactory.post({ postKind: "REPOST" }))
      ).toBe(true);
    });
    it("returns true when postKind from originalData is REPOST", () => {
      expect(
        isRepostContent(
          combinedContentFactory.post({
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
            originalData: { postKind: "REPOST" } as never,
          })
        )
      ).toBe(true);
    });
  });
});
