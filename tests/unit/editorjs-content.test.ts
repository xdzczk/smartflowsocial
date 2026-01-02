/**
 * Unit tests for EditorJS content utilities
 * Tests app/features/posts/utils/editorjs-content.ts
 */

import { describe, it, expect, vi } from "vitest";

// Mock client-side error handler
vi.mock("~/lib/error-handler.client", () => ({
  handleErrorSafely: vi.fn(),
}));

import { generateSummaryFromContent } from "~/features/posts/utils/editorjs-content";

describe("EditorJS Content Utils", () => {
  describe("generateSummaryFromContent", () => {
    it("should return empty string for empty content", () => {
      expect(generateSummaryFromContent("")).toBe("");
      expect(generateSummaryFromContent("   ")).toBe("");
    });

    it("should generate summary from paragraph blocks", () => {
      const content = JSON.stringify({
        blocks: [
          {
            type: "paragraph",
            data: {
              text: "This is a test paragraph with some content.",
            },
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("This is a test paragraph with some content.");
    });

    it("should generate summary from header blocks", () => {
      const content = JSON.stringify({
        blocks: [
          {
            type: "header",
            data: {
              text: "Test Header",
            },
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("Test Header");
    });

    it("should generate summary from list blocks", () => {
      const content = JSON.stringify({
        blocks: [
          {
            type: "list",
            data: {
              items: ["Item 1", "Item 2", "Item 3"],
            },
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("Item 1 Item 2 Item 3");
    });

    it("should combine multiple block types", () => {
      const content = JSON.stringify({
        blocks: [
          {
            type: "header",
            data: {
              text: "Title",
            },
          },
          {
            type: "paragraph",
            data: {
              text: "First paragraph.",
            },
          },
          {
            type: "paragraph",
            data: {
              text: "Second paragraph.",
            },
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("Title First paragraph. Second paragraph.");
    });

    it("should truncate to 280 characters", () => {
      const longText = "a".repeat(300);
      const content = JSON.stringify({
        blocks: [
          {
            type: "paragraph",
            data: {
              text: longText,
            },
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toHaveLength(283); // 280 + "..."
      expect(result).toMatch(/^a{280}\.\.\.$/);
    });

    it("should strip HTML tags", () => {
      const content = JSON.stringify({
        blocks: [
          {
            type: "paragraph",
            data: {
              text: "<p>This is <strong>bold</strong> text</p>",
            },
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("This is bold text");
    });

    it("should handle empty blocks array", () => {
      const content = JSON.stringify({
        blocks: [],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("");
    });

    it("should handle blocks without data", () => {
      const content = JSON.stringify({
        blocks: [
          {
            type: "paragraph",
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("");
    });

    it("should handle invalid JSON gracefully", () => {
      const result = generateSummaryFromContent("invalid json");
      expect(result).toBe("");
    });

    it("should handle non-object parsed content", () => {
      const result = generateSummaryFromContent('"just a string"');
      expect(result).toBe("");
    });

    it("should handle array as parsed content", () => {
      const result = generateSummaryFromContent('["array", "content"]');
      expect(result).toBe("");
    });

    it("should handle blocks that are not arrays", () => {
      const content = JSON.stringify({
        blocks: "not an array",
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("");
    });

    it("should handle list blocks with non-array items", () => {
      const content = JSON.stringify({
        blocks: [
          {
            type: "list",
            data: {
              items: "not an array",
            },
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("");
    });

    it("should ignore non-paragraph, non-header, non-list blocks", () => {
      const content = JSON.stringify({
        blocks: [
          {
            type: "image",
            data: {
              url: "https://example.com/image.jpg",
            },
          },
          {
            type: "paragraph",
            data: {
              text: "This should be included",
            },
          },
        ],
      });

      const result = generateSummaryFromContent(content);
      expect(result).toBe("This should be included");
    });
  });
});

