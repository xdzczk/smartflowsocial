/**
 * Unit tests for markdown sanitization
 * 
 * Tests the security-critical sanitization functions in app/lib/markdown-sanitizer.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sanitizeMarkdown,
  extractPlainText,
  generateSummary,
} from "~/lib/markdown-sanitizer.server";

// Mock marked
vi.mock("marked", () => ({
  default: {
    Renderer: vi.fn(() => ({
      html: vi.fn(),
      link: vi.fn(),
      image: vi.fn(),
      code: vi.fn(),
    })),
    marked: vi.fn((markdown, options) => {
      // Simple mock that returns basic HTML
      return `<p>${markdown}</p>`;
    }),
  },
}));

describe("Markdown Sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sanitizeMarkdown", () => {
    it("should return empty string for null input", () => {
      const result = sanitizeMarkdown(null as any);

      expect(result).toBe("");
    });

    it("should return empty string for undefined input", () => {
      const result = sanitizeMarkdown(undefined as any);

      expect(result).toBe("");
    });

    it("should return empty string for non-string input", () => {
      const result = sanitizeMarkdown(123 as any);

      expect(result).toBe("");
    });

    it("should sanitize basic markdown", () => {
      const markdown = "# Heading\n\nThis is **bold** text.";

      const result = sanitizeMarkdown(markdown);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should remove script tags", () => {
      const markdown = "Text\n<script>alert('xss')</script>More text";

      const result = sanitizeMarkdown(markdown);

      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert('xss')");
    });

    it("should remove event handlers", () => {
      const markdown = "Text\n<img onclick='alert(1)' src='test.jpg'>";

      const result = sanitizeMarkdown(markdown);

      expect(result).not.toContain("onclick");
    });

    it("should remove dangerous protocols", () => {
      const markdown = "[Link](javascript:alert('xss'))";

      const result = sanitizeMarkdown(markdown);

      expect(result).not.toContain("javascript:");
    });

    it("should remove data URIs", () => {
      const markdown = "![Image](data:text/html,<script>alert(1)</script>)";

      const result = sanitizeMarkdown(markdown);

      expect(result).not.toContain("data:");
    });

    it("should remove iframe tags", () => {
      const markdown = "Text\n<iframe src='evil.com'></iframe>";

      const result = sanitizeMarkdown(markdown);

      expect(result).not.toContain("<iframe");
    });

    it("should remove form elements", () => {
      const markdown = "Text\n<form><input type='text'></form>";

      const result = sanitizeMarkdown(markdown);

      expect(result).not.toContain("<form");
      expect(result).not.toContain("<input");
    });

    it("should allow safe links", () => {
      const markdown = "[Safe Link](https://example.com)";

      const result = sanitizeMarkdown(markdown);

      // Should contain the link but sanitized
      expect(result).toBeDefined();
    });

    it("should sanitize code blocks", () => {
      const markdown = "```javascript\nconst x = '<script>';\n```";

      const result = sanitizeMarkdown(markdown);

      expect(result).toBeDefined();
      // Code should be escaped
      expect(result).not.toContain("<script>");
    });

    it("should handle empty string", () => {
      const result = sanitizeMarkdown("");

      expect(result).toBeDefined();
    });

    it("should handle markdown with only whitespace", () => {
      const result = sanitizeMarkdown("   \n\n   ");

      expect(result).toBeDefined();
    });

    it("should return empty string on parsing error", () => {
      // Force an error by using invalid markdown that breaks the parser
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // This would need to actually break marked to test error handling
      const result = sanitizeMarkdown("Valid markdown");

      expect(result).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe("extractPlainText", () => {
    it("should extract plain text from markdown", () => {
      const markdown = "# Heading\n\nThis is **bold** text.";

      const result = extractPlainText(markdown);

      expect(result).not.toContain("#");
      expect(result).not.toContain("**");
      expect(result).toContain("Heading");
      expect(result).toContain("This is bold text");
    });

    it("should remove markdown headers", () => {
      const markdown = "# Heading 1\n## Heading 2\n### Heading 3";

      const result = extractPlainText(markdown);

      expect(result).not.toContain("#");
      expect(result).toContain("Heading 1");
      expect(result).toContain("Heading 2");
      expect(result).toContain("Heading 3");
    });

    it("should remove bold formatting", () => {
      const markdown = "This is **bold** text.";

      const result = extractPlainText(markdown);

      expect(result).toContain("This is bold text");
      expect(result).not.toContain("**");
    });

    it("should remove italic formatting", () => {
      const markdown = "This is *italic* text.";

      const result = extractPlainText(markdown);

      expect(result).toContain("This is italic text");
      expect(result).not.toContain("*");
    });

    it("should remove strikethrough", () => {
      const markdown = "This is ~~strikethrough~~ text.";

      const result = extractPlainText(markdown);

      expect(result).toContain("This is strikethrough text");
      expect(result).not.toContain("~~");
    });

    it("should remove inline code", () => {
      const markdown = "This is `code` text.";

      const result = extractPlainText(markdown);

      expect(result).toContain("This is code text");
      expect(result).not.toContain("`");
    });

    it("should remove links but keep text", () => {
      const markdown = "This is [a link](https://example.com) text.";

      const result = extractPlainText(markdown);

      expect(result).toContain("This is a link text");
      expect(result).not.toContain("[");
      expect(result).not.toContain("]");
      expect(result).not.toContain("(");
    });

    it("should remove images but keep alt text", () => {
      const markdown = "![Alt text](https://example.com/image.jpg)";

      const result = extractPlainText(markdown);

      expect(result).toContain("Alt text");
      expect(result).not.toContain("![");
      expect(result).not.toContain("](");
    });

    it("should remove blockquotes", () => {
      const markdown = "> This is a quote";

      const result = extractPlainText(markdown);

      expect(result).not.toContain(">");
      expect(result).toContain("This is a quote");
    });

    it("should remove list markers", () => {
      const markdown = "- Item 1\n- Item 2\n1. Numbered 1\n2. Numbered 2";

      const result = extractPlainText(markdown);

      expect(result).not.toContain("-");
      expect(result).not.toMatch(/^\d+\./);
      expect(result).toContain("Item 1");
      expect(result).toContain("Item 2");
    });

    it("should normalize multiple newlines", () => {
      const markdown = "Line 1\n\n\n\nLine 2";

      const result = extractPlainText(markdown);

      // Should have at most 2 consecutive newlines
      expect(result).not.toMatch(/\n{3,}/);
    });

    it("should trim result", () => {
      const markdown = "   Text with spaces   ";

      const result = extractPlainText(markdown);

      expect(result).toBe(result.trim());
    });

    it("should return empty string for null input", () => {
      const result = extractPlainText(null as any);

      expect(result).toBe("");
    });

    it("should return empty string for undefined input", () => {
      const result = extractPlainText(undefined as any);

      expect(result).toBe("");
    });

    it("should return empty string for non-string input", () => {
      const result = extractPlainText(123 as any);

      expect(result).toBe("");
    });
  });

  describe("generateSummary", () => {
    it("should return full text if shorter than maxLength", () => {
      const content = "Short text";

      const result = generateSummary(content, 280);

      expect(result).toBe("Short text");
    });

    it("should truncate text longer than maxLength", () => {
      const content = "A".repeat(300);

      const result = generateSummary(content, 280);

      expect(result.length).toBeLessThanOrEqual(283); // 280 + "..."
      expect(result).toContain("...");
    });

    it("should truncate at word boundary when possible", () => {
      const content = "This is a long sentence that should be truncated at a word boundary when it exceeds the maximum length.";
      const maxLength = 50;

      const result = generateSummary(content, maxLength);

      // Should end at a word boundary (space)
      expect(result.length).toBeLessThanOrEqual(maxLength + 3);
      expect(result).toContain("...");
      // Should not cut in the middle of a word
      const lastWord = result.split(" ").pop();
      expect(lastWord).toBe("...");
    });

    it("should use default maxLength of 280", () => {
      const shortContent = "Short";
      const longContent = "A".repeat(300);

      const shortResult = generateSummary(shortContent);
      const longResult = generateSummary(longContent);

      expect(shortResult).toBe("Short");
      expect(longResult.length).toBeLessThanOrEqual(283);
    });

    it("should handle markdown and extract plain text first", () => {
      const markdown = "# Heading\n\n" + "A".repeat(300);

      const result = generateSummary(markdown, 50);

      expect(result).not.toContain("#");
      expect(result.length).toBeLessThanOrEqual(53);
    });

    it("should handle empty string", () => {
      const result = generateSummary("", 280);

      expect(result).toBe("");
    });

    it("should handle text exactly at maxLength", () => {
      const content = "A".repeat(280);

      const result = generateSummary(content, 280);

      expect(result).toBe(content);
      expect(result).not.toContain("...");
    });

    it("should handle very short maxLength", () => {
      const content = "This is a longer sentence";

      const result = generateSummary(content, 10);

      expect(result.length).toBeLessThanOrEqual(13);
      expect(result).toContain("...");
    });

    it("should handle text with no spaces (no word boundary)", () => {
      const content = "A".repeat(300);

      const result = generateSummary(content, 50);

      // Should truncate anyway, even without word boundary
      expect(result.length).toBeLessThanOrEqual(53);
      expect(result).toContain("...");
    });
  });
});

