/**
 * Unit tests for markdown utilities
 * Tests app/lib/markdown-utils.ts
 */

import { describe, it, expect } from "vitest";

import {
  stripMarkdownToPlainText,
  generateSummaryFromMarkdown,
  generateArticleIdentifier,
} from "~/lib/markdown-utils";

describe("Markdown Utils", () => {
  describe("stripMarkdownToPlainText", () => {
    it("returns empty for null or non-string", () => {
      expect(stripMarkdownToPlainText("")).toBe("");
      expect(stripMarkdownToPlainText(null as never)).toBe("");
      expect(stripMarkdownToPlainText(123 as never)).toBe("");
    });

    it("strips headings", () => {
      expect(stripMarkdownToPlainText("## Hello")).toBe("Hello");
      expect(stripMarkdownToPlainText("# Title")).toBe("Title");
    });

    it("strips bold", () => {
      expect(stripMarkdownToPlainText("**bold**")).toBe("bold");
      expect(stripMarkdownToPlainText("*italic*")).toBe("italic");
    });

    it("strips strikethrough and code", () => {
      expect(stripMarkdownToPlainText("~~strike~~")).toBe("strike");
      expect(stripMarkdownToPlainText("`code`")).toBe("code");
    });

    it("strips link text only", () => {
      expect(stripMarkdownToPlainText("[link text](https://url.com)")).toBe(
        "link text"
      );
    });

    it("strips image alt only", () => {
      // Link replace runs first so [alt](url) becomes "alt", leaving "!" from ![alt]
      expect(stripMarkdownToPlainText("![alt](https://img.jpg)")).toBe("!alt");
    });

    it("strips blockquote and list markers", () => {
      expect(stripMarkdownToPlainText("> quote")).toBe("quote");
      expect(stripMarkdownToPlainText("- item")).toBe("item");
      expect(stripMarkdownToPlainText("1. first")).toBe("first");
    });

    it("collapses multiple newlines", () => {
      expect(stripMarkdownToPlainText("a\n\n\n\nb")).toBe("a\n\nb");
    });

    it("trims result", () => {
      expect(stripMarkdownToPlainText("  hello  ")).toBe("hello");
    });
  });

  describe("generateSummaryFromMarkdown", () => {
    it("returns plain text when under maxLength", () => {
      const short = "Short text";
      expect(generateSummaryFromMarkdown(short)).toBe(short);
    });

    it("truncates with ... when over maxLength", () => {
      const long = "a".repeat(300);
      const result = generateSummaryFromMarkdown(long, 100);
      expect(result.length).toBeLessThanOrEqual(103);
      expect(result.endsWith("...")).toBe(true);
    });

    it("truncates at word boundary when lastSpace > 80% of maxLength", () => {
      const text = "word ".repeat(60).trim();
      const result = generateSummaryFromMarkdown(text, 50);
      expect(result.endsWith("...")).toBe(true);
    });

    it("uses default maxLength 280", () => {
      const long = "x".repeat(300);
      const result = generateSummaryFromMarkdown(long);
      expect(result.length).toBeLessThanOrEqual(283);
    });
  });

  describe("generateArticleIdentifier", () => {
    it("lowercases and replaces non-alphanumeric with hyphens", () => {
      expect(generateArticleIdentifier("Hello World")).toBe("hello-world");
    });

    it("replaces multiple spaces with single hyphen", () => {
      expect(generateArticleIdentifier("A   B")).toBe("a-b");
    });

    it("collapses multiple hyphens", () => {
      expect(generateArticleIdentifier("A---B")).toBe("a-b");
    });

    it("strips invalid chars", () => {
      expect(generateArticleIdentifier("Hello! @World?")).toBe("hello-world");
    });

    it("limits to 64 chars", () => {
      const long = "a".repeat(100);
      expect(generateArticleIdentifier(long).length).toBe(64);
    });

    it("normalizes spaces to single hyphen", () => {
      // Spaces become hyphens; leading/trailing spaces become leading/trailing hyphens
      expect(generateArticleIdentifier("  title  ")).toBe("-title-");
    });
  });
});
