/**
 * Unit tests for Nostr utility functions
 * Tests pure functions in app/lib/nostr.ts
 */

import { describe, it, expect, vi } from "vitest";

import {
  hexToNpub,
  npubToHex,
  generateArticleIdentifier,
  convertEditorJSToMarkdown,
  convertMarkdownToEditorJS,
} from "~/lib/nostr";

// Mock nip19 from nostr-tools
vi.mock("nostr-tools", () => ({
  nip19: {
    npubEncode: vi.fn((hex: string) => {
      if (!hex || hex.length < 32) throw new Error("Invalid hex");
      return `npub${hex.slice(0, 32)}`;
    }),
    decode: vi.fn((npub: string) => {
      if (!npub.startsWith("npub")) throw new Error("Invalid npub");
      return { type: "npub", data: npub.slice(4, 36) };
    }),
  },
}));

describe("Nostr Utils", () => {
  describe("hexToNpub", () => {
    it("should convert valid hex to npub", () => {
      const hex = "a".repeat(64);
      const result = hexToNpub(hex);
      expect(result).toMatch(/^npub/);
    });

    it("should return null for invalid hex", () => {
      const result = hexToNpub("invalid");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = hexToNpub("");
      expect(result).toBeNull();
    });

    it("should return null for too short hex", () => {
      const result = hexToNpub("abc");
      expect(result).toBeNull();
    });
  });

  describe("npubToHex", () => {
    it("should convert valid npub to hex", () => {
      const npub = "npub" + "a".repeat(32);
      const result = npubToHex(npub);
      expect(result).toBe("a".repeat(32));
    });

    it("should return hex as-is if not npub format", () => {
      const hex = "a".repeat(64);
      const result = npubToHex(hex);
      expect(result).toBe(hex);
    });

    it("should return string as-is if not npub format", () => {
      // If string doesn't start with "npub", it's returned as-is
      const result = npubToHex("invalid-npub");
      expect(result).toBe("invalid-npub");
    });

    it("should return empty string as-is (not npub format)", () => {
      // Empty string doesn't start with "npub", so it's returned as-is
      const result = npubToHex("");
      expect(result).toBe("");
    });
  });

  describe("generateArticleIdentifier", () => {
    it("should convert title to lowercase identifier", () => {
      const result = generateArticleIdentifier("My Article Title");
      expect(result).toBe("my-article-title");
    });

    it("should remove special characters", () => {
      const result = generateArticleIdentifier("Article@#$%Title!");
      expect(result).toBe("articletitle");
    });

    it("should replace spaces with hyphens", () => {
      const result = generateArticleIdentifier("Article With Spaces");
      expect(result).toBe("article-with-spaces");
    });

    it("should collapse multiple hyphens", () => {
      const result = generateArticleIdentifier("Article---With---Hyphens");
      expect(result).toBe("article-with-hyphens");
    });

    it("should limit to 64 characters", () => {
      const longTitle = "a".repeat(100);
      const result = generateArticleIdentifier(longTitle);
      expect(result).toHaveLength(64);
    });

    it("should handle whitespace", () => {
      // Leading/trailing spaces are converted to hyphens, then trim() removes them
      // But trim() only removes whitespace, not hyphens
      // So "  Article Title  " -> "-article-title-" (spaces become hyphens, trim doesn't remove hyphens)
      const result = generateArticleIdentifier("  Article Title  ");
      expect(result).toBe("-article-title-");
    });

    it("should handle empty string", () => {
      const result = generateArticleIdentifier("");
      expect(result).toBe("");
    });
  });

  describe("convertEditorJSToMarkdown", () => {
    it("should return empty string for null", () => {
      expect(convertEditorJSToMarkdown(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(convertEditorJSToMarkdown(undefined)).toBe("");
    });

    it("should parse JSON string input", () => {
      const editorData = JSON.stringify({
        blocks: [
          {
            type: "paragraph",
            data: { text: "Hello world" },
          },
        ],
      });
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toContain("Hello world");
    });

    it("should convert paragraph block", () => {
      const editorData = {
        blocks: [
          {
            type: "paragraph",
            data: { text: "Test paragraph" },
          },
        ],
      };
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toContain("Test paragraph");
    });

    it("should convert header block", () => {
      const editorData = {
        blocks: [
          {
            type: "header",
            data: { text: "Header Text", level: 2 },
          },
        ],
      };
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toContain("## Header Text");
    });

    it("should convert list block (ordered)", () => {
      const editorData = {
        blocks: [
          {
            type: "list",
            data: {
              style: "ordered",
              items: ["Item 1", "Item 2"],
            },
          },
        ],
      };
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toContain("1. Item 1");
      expect(result).toContain("2. Item 2");
    });

    it("should convert list block (unordered)", () => {
      const editorData = {
        blocks: [
          {
            type: "list",
            data: {
              style: "unordered",
              items: ["Item 1", "Item 2"],
            },
          },
        ],
      };
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toContain("- Item 1");
      expect(result).toContain("- Item 2");
    });

    it("should convert quote block", () => {
      const editorData = {
        blocks: [
          {
            type: "quote",
            data: {
              text: "Quote text",
              caption: "Author",
            },
          },
        ],
      };
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toContain("> Quote text");
      expect(result).toContain("— Author");
    });

    it("should convert code block", () => {
      const editorData = {
        blocks: [
          {
            type: "code",
            data: {
              code: "const x = 1;",
            },
          },
        ],
      };
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toContain("```");
      expect(result).toContain("const x = 1;");
    });

    it("should convert image block", () => {
      const editorData = {
        blocks: [
          {
            type: "image",
            data: {
              url: "https://example.com/image.jpg",
              caption: "Image caption",
            },
          },
        ],
      };
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toContain(
        "![Image caption](https://example.com/image.jpg)",
      );
    });

    it("should return empty string for invalid JSON", () => {
      const result = convertEditorJSToMarkdown("invalid json");
      expect(result).toBe("");
    });

    it("should return empty string for empty blocks", () => {
      const editorData = { blocks: [] };
      const result = convertEditorJSToMarkdown(editorData);
      expect(result).toBe("");
    });
  });

  describe("convertMarkdownToEditorJS", () => {
    it("should return empty blocks for empty string", () => {
      const result = convertMarkdownToEditorJS("");
      expect(result).toEqual({ blocks: [] });
    });

    it("should convert paragraph", () => {
      const result = convertMarkdownToEditorJS("Hello world");
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]?.type).toBe("paragraph");
    });

    it("should convert headers", () => {
      const result = convertMarkdownToEditorJS("# Header 1\n## Header 2");
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0]?.type).toBe("header");
      expect(result.blocks[1]?.type).toBe("header");
    });

    it("should convert ordered lists", () => {
      const result = convertMarkdownToEditorJS("1. Item 1\n2. Item 2");
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]?.type).toBe("list");
      expect(result.blocks[0]?.data.style).toBe("ordered");
    });

    it("should convert unordered lists", () => {
      const result = convertMarkdownToEditorJS("- Item 1\n- Item 2");
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]?.type).toBe("list");
      expect(result.blocks[0]?.data.style).toBe("unordered");
    });

    it("should convert blockquotes", () => {
      const result = convertMarkdownToEditorJS("> Quote text");
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]?.type).toBe("quote");
    });

    it("should convert code blocks", () => {
      const result = convertMarkdownToEditorJS("```\nconst x = 1;\n```");
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]?.type).toBe("code");
    });

    it("should convert images", () => {
      const result = convertMarkdownToEditorJS(
        "![alt](https://example.com/image.jpg)",
      );
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]?.type).toBe("image");
    });

    it("should convert links", () => {
      const result = convertMarkdownToEditorJS(
        "[Link Text](https://example.com)",
      );
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]?.type).toBe("linkTool");
    });
  });
});
