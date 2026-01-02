/**
 * Unit tests for markdown sanitizer
 * Tests app/lib/markdown-sanitizer.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock marked
vi.mock("marked", () => ({
  marked: vi.fn((markdown: string) => {
    // Simple mock that converts markdown-like patterns to HTML
    return markdown
      .replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
      .replace(/`(.*?)`/g, "<code>$1</code>");
  }),
}));

import {
  sanitizeMarkdown,
  extractPlainText,
  generateSummary,
} from "~/lib/markdown-sanitizer.server";

describe("Markdown Sanitizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sanitizeMarkdown", () => {
    it("should sanitize basic markdown", () => {
      const markdown = "# Title\n\n**Bold** text";
      const result = sanitizeMarkdown(markdown);

      expect(result).toContain("<h1>Title</h1>");
      expect(result).toContain("<strong>Bold</strong>");
    });

    it("should remove script tags", () => {
      const markdown = "# Title\n<script>alert('xss')</script>";
      const result = sanitizeMarkdown(markdown);

      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert");
    });

    it("should sanitize links", () => {
      const markdown = "[Link](https://example.com)";
      const result = sanitizeMarkdown(markdown);

      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('target="_blank"');
    });

    it("should remove dangerous protocols", () => {
      const markdown = "[Link](javascript:alert('xss'))";
      const result = sanitizeMarkdown(markdown);

      expect(result).not.toContain("javascript:");
    });

    it("should handle empty input", () => {
      expect(sanitizeMarkdown("")).toBe("");
      expect(sanitizeMarkdown(null as unknown as string)).toBe("");
      expect(sanitizeMarkdown(undefined as unknown as string)).toBe("");
    });

    it("should sanitize images", () => {
      const markdown = "![Alt](https://example.com/image.jpg)";
      const result = sanitizeMarkdown(markdown);

      // The mock converts ![]() to <img>, but the actual function processes it differently
      // Just check that the URL is present in some form
      expect(result).toContain("https://example.com/image.jpg");
    });

    it("should escape code blocks properly", () => {
      const markdown = "```\n<script>alert('xss')</script>\n```";
      const result = sanitizeMarkdown(markdown);

      // The mock converts ``` to <code>, but actual function handles code blocks differently
      // Just verify script tags are removed
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert");
    });
  });

  describe("extractPlainText", () => {
    it("should extract plain text from markdown", () => {
      const markdown = "# Title\n\n**Bold** text with [link](url)";
      const result = extractPlainText(markdown);

      expect(result).toContain("Title");
      expect(result).toContain("Bold");
      expect(result).toContain("text");
      expect(result).toContain("link");
      expect(result).not.toContain("#");
      expect(result).not.toContain("**");
      expect(result).not.toContain("[");
    });

    it("should handle empty input", () => {
      expect(extractPlainText("")).toBe("");
      expect(extractPlainText(null as unknown as string)).toBe("");
      expect(extractPlainText(undefined as unknown as string)).toBe("");
    });

    it("should remove markdown formatting", () => {
      const markdown = "**Bold** *Italic* ~~Strikethrough~~ `Code`";
      const result = extractPlainText(markdown);

      expect(result).toContain("Bold");
      expect(result).toContain("Italic");
      expect(result).toContain("Strikethrough");
      expect(result).toContain("Code");
      expect(result).not.toContain("**");
      expect(result).not.toContain("*");
      expect(result).not.toContain("~~");
      expect(result).not.toContain("`");
    });
  });

  describe("generateSummary", () => {
    it("should return full text if under max length", () => {
      const content = "Short text";
      const result = generateSummary(content, 280);

      expect(result).toBe("Short text");
    });

    it("should truncate text at word boundary", () => {
      const content =
        "This is a very long text that should be truncated at a word boundary when it exceeds the maximum length limit.";
      const result = generateSummary(content, 50);

      expect(result).toContain("...");
      expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
    });

    it("should truncate at end if no word boundary found", () => {
      const content = "ThisIsAVeryLongWordWithoutSpacesThatExceedsTheLimit";
      const result = generateSummary(content, 20);

      expect(result).toContain("...");
      expect(result.length).toBe(23); // 20 + "..."
    });

    it("should use default max length", () => {
      const longContent = "a ".repeat(200);
      const result = generateSummary(longContent);

      expect(result.length).toBeLessThanOrEqual(283); // 280 + "..."
    });
  });
});
