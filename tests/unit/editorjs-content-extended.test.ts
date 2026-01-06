/**
 * Extended unit tests for EditorJS content utilities
 * Tests loadEditorJSContent and insertAssetsIntoEditor
 * Tests app/features/posts/utils/editorjs-content.ts
 */

import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock client-side error handler
vi.mock("~/lib/error-handler.client", () => ({
  handleErrorSafely: vi.fn(),
  logClientError: vi.fn(),
  handleAsyncError: vi.fn(),
}));

// Mock editorjs-conversion
vi.mock("~/features/posts/utils/editorjs-conversion", () => ({
  convertMarkdownToEditorJS: vi.fn((markdown: string) => ({
    blocks: [
      {
        id: "test-id",
        type: "paragraph",
        data: { text: markdown },
      },
    ],
  })),
}));

import type { EditorJSInstance } from "~/features/posts/types/editorjs.types";
import {
  loadEditorJSContent,
  insertAssetsIntoEditor,
} from "~/features/posts/utils/editorjs-content";
import { convertMarkdownToEditorJS } from "~/features/posts/utils/editorjs-conversion";
import { handleAsyncError, logClientError } from "~/lib/error-handler.client";

interface EditorJSData {
  blocks?: Array<{
    type: string;
    data?: Record<string, unknown> & { text?: string };
  }>;
}

describe("EditorJS Content Utils - Extended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadEditorJSContent", () => {
    it("should return early if editorRef is null", async () => {
      const editorRef = { current: null };
      const onContentChange = vi.fn();

      await loadEditorJSContent(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        "some content",
        onContentChange
      );

      expect(onContentChange).not.toHaveBeenCalled();
    });

    it("should return early if content is empty", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      await loadEditorJSContent(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        "",
        onContentChange
      );

      expect(onContentChange).not.toHaveBeenCalled();
    });

    it("should parse and render JSON EditorJS format", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const jsonContent = JSON.stringify({
        blocks: [
          {
            type: "paragraph",
            data: { text: "Test content" },
          },
        ],
        time: 1234567890,
        version: "2.0",
      });

      await loadEditorJSContent(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        jsonContent,
        onContentChange
      );

      expect(mockEditor.render).toHaveBeenCalled();
      expect(onContentChange).toHaveBeenCalled();
      const callArg = onContentChange.mock.calls[0]?.[0] as string | undefined;
      expect(callArg).toContain("Test content");
    });

    it("should convert markdown to EditorJS format", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const markdownContent = "# Heading\n\nSome paragraph text";

      await loadEditorJSContent(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        markdownContent,
        onContentChange
      );

      expect(convertMarkdownToEditorJS).toHaveBeenCalledWith(markdownContent);
      expect(mockEditor.render).toHaveBeenCalled();
      expect(onContentChange).toHaveBeenCalled();
    });

    it("should handle invalid JSON and convert to markdown", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const invalidJson = "{ invalid json }";

      await loadEditorJSContent(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        invalidJson,
        onContentChange
      );

      expect(logClientError).toHaveBeenCalled();
      expect(convertMarkdownToEditorJS).toHaveBeenCalled();
      expect(mockEditor.render).toHaveBeenCalled();
    });

    it("should handle JSON without blocks array", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const invalidJson = JSON.stringify({ time: 1234567890 });

      await loadEditorJSContent(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        invalidJson,
        onContentChange
      );

      expect(logClientError).toHaveBeenCalled();
      expect(convertMarkdownToEditorJS).toHaveBeenCalled();
    });

    it("should handle render errors and fallback to empty editor", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockRejectedValue(new Error("Render failed")),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const content = JSON.stringify({
        blocks: [{ type: "paragraph", data: { text: "Test" } }],
      });

      await loadEditorJSContent(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        content,
        onContentChange
      );

      expect(handleAsyncError).toHaveBeenCalled();
      // Should attempt fallback render
      expect(mockEditor.render).toHaveBeenCalledTimes(2);
      const fallbackCall = mockEditor.render.mock.calls[1]?.[0] as EditorJSData;
      expect(fallbackCall).toEqual({ blocks: [] });
    });

    it("should handle fallback render errors", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi
          .fn()
          .mockRejectedValueOnce(new Error("Render failed"))
          .mockRejectedValueOnce(new Error("Fallback failed")),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const content = JSON.stringify({
        blocks: [{ type: "paragraph", data: { text: "Test" } }],
      });

      await loadEditorJSContent(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        content,
        onContentChange
      );

      expect(handleAsyncError).toHaveBeenCalledTimes(2);
    });
  });

  describe("insertAssetsIntoEditor", () => {
    it("should return early if editorRef is null", async () => {
      const editorRef = { current: null };
      const onContentChange = vi.fn();

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        [],
        onContentChange
      );

      expect(onContentChange).not.toHaveBeenCalled();
    });

    it("should insert text assets as paragraph blocks", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
        saver: {
          save: vi.fn().mockResolvedValue({ blocks: [] }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockReturnValue(0),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "TEXT",
          content: "Test text content",
          title: "Test Title",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(mockEditor.render).toHaveBeenCalled();
      const renderCall = mockEditor.render.mock.calls[0]?.[0] as {
        blocks?: Array<{ type: string }>;
      };
      expect(renderCall.blocks).toBeDefined();
      expect(renderCall.blocks?.some((b) => b.type === "paragraph")).toBe(true);
      expect(onContentChange).toHaveBeenCalled();
    });

    it("should insert image assets as image blocks", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
        saver: {
          save: vi.fn().mockResolvedValue({ blocks: [] }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockReturnValue(0),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "IMAGE",
          fileUrl: "https://example.com/image.jpg",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(mockEditor.render).toHaveBeenCalled();
      const renderCall = mockEditor.render.mock.calls[0]?.[0] as EditorJSData;
      expect(renderCall.blocks).toBeDefined();
      expect(renderCall.blocks?.some((b) => b.type === "image")).toBe(true);
    });

    it("should use title if content is not available for text assets", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
        saver: {
          save: vi.fn().mockResolvedValue({ blocks: [] }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockReturnValue(0),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "TEXT",
          title: "Title only",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(mockEditor.render).toHaveBeenCalled();
      const renderCall = mockEditor.render.mock.calls[0]?.[0] as EditorJSData;
      const textBlock = renderCall.blocks?.find((b) => b.type === "paragraph");
      expect(textBlock?.data?.text).toBe("Title only");
    });

    it("should skip text assets with no content or title", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
        saver: {
          save: vi.fn().mockResolvedValue({ blocks: [] }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockReturnValue(0),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "TEXT",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(mockEditor.render).toHaveBeenCalled();
      const renderCall = mockEditor.render.mock.calls[0]?.[0] as EditorJSData;
      expect(renderCall.blocks?.length).toBe(0);
    });

    it("should insert at current block index + 1", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
        saver: {
          save: vi.fn().mockResolvedValue({
            blocks: [
              { type: "paragraph", data: { text: "Existing" } },
              { type: "paragraph", data: { text: "Block" } },
            ],
          }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockReturnValue(1),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "TEXT",
          content: "New content",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(mockEditor.render).toHaveBeenCalled();
      const renderCall = mockEditor.render.mock.calls[0]?.[0] as EditorJSData;
      // Should have 3 blocks: existing, new (inserted at index 2), block
      expect(renderCall.blocks?.length).toBe(3);
      // The new content should be inserted at index 2 (after current block index 1)
      expect(renderCall.blocks?.[2]?.data?.text).toBe("New content");
    });

    it("should handle getCurrentBlockIndex errors gracefully", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockResolvedValue(undefined),
        saver: {
          save: vi.fn().mockResolvedValue({ blocks: [] }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockImplementation(() => {
            throw new Error("Index error");
          }),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "TEXT",
          content: "Test",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(logClientError).toHaveBeenCalled();
      expect(mockEditor.render).toHaveBeenCalled();
      // Should insert at end (default)
      const renderCall = mockEditor.render.mock.calls[0]?.[0] as EditorJSData;
      expect(renderCall.blocks?.length).toBe(1);
    });

    it("should handle render errors and use fallback insertion", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockRejectedValue(new Error("Render failed")),
        saver: {
          save: vi.fn().mockResolvedValue({ blocks: [] }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockReturnValue(0),
          insert: vi.fn(),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "TEXT",
          content: "Test content",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(handleAsyncError).toHaveBeenCalled();
      expect(mockEditor.blocks.insert).toHaveBeenCalledWith("paragraph", {
        text: "Test content",
      });
    });

    it("should handle fallback insertion errors", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockRejectedValue(new Error("Render failed")),
        saver: {
          save: vi.fn().mockResolvedValue({ blocks: [] }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockReturnValue(0),
          insert: vi.fn().mockImplementation(() => {
            throw new Error("Insert failed");
          }),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "TEXT",
          content: "Test content",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(handleAsyncError).toHaveBeenCalledTimes(2);
    });

    it("should handle async save result in fallback", async () => {
      const mockEditor = {
        isReady: Promise.resolve(),
        render: vi.fn().mockRejectedValue(new Error("Render failed")),
        saver: {
          save: vi.fn().mockResolvedValue({ blocks: [] }),
        },
        blocks: {
          getCurrentBlockIndex: vi.fn().mockReturnValue(0),
          insert: vi.fn(),
        },
        focus: vi.fn(),
      };
      const editorRef = { current: mockEditor };
      const onContentChange = vi.fn();

      const assets = [
        {
          assetType: "IMAGE",
          fileUrl: "https://example.com/image.jpg",
        },
      ];

      await insertAssetsIntoEditor(
        editorRef as unknown as React.RefObject<EditorJSInstance>,
        assets,
        onContentChange
      );

      expect(mockEditor.blocks.insert).toHaveBeenCalledWith("image", {
        file: {
          url: "https://example.com/image.jpg",
        },
        caption: "",
        withBorder: false,
        withBackground: false,
        stretched: false,
      });
      expect(onContentChange).toHaveBeenCalled();
    });
  });
});
