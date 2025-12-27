/**
 * EditorJS content loading and manipulation utilities
 */


import type React from "react";

import type { EditorJSInstance, EditorJSBlock } from "~/features/posts/types/editorjs.types";
import { handleErrorSafely, logClientError } from "~/lib/error-handler.client";
import { convertMarkdownToEditorJS } from "~/lib/nostr";
/**
 * Load initial content into EditorJS
 */
export async function loadEditorJSContent(
  editorRef: React.RefObject<EditorJSInstance>,
  content: string,
  onContentChange: (content: string) => void,
) {
  if (!editorRef.current || !content) return;

  try {
    await editorRef.current.isReady;

    let parsedContent;

    // Try to parse as JSON first (for legacy EditorJS format)
    if (content.trim().startsWith("{")) {
      try {
        parsedContent = JSON.parse(content) as { blocks?: unknown[]; time?: number; version?: string };
        // Validate it has EditorJS structure
        if (
          !parsedContent.blocks ||
          !Array.isArray(parsedContent.blocks)
        ) {
          throw new Error("Not valid EditorJS format");
        }
      } catch (jsonError) {
        logClientError(
          jsonError instanceof Error ? jsonError : new Error(String(jsonError)),
          {
            component: "loadEditorJSContent",
            action: "parseContent",
            message: "Content is not valid EditorJS JSON, treating as markdown",
          },
          "warning",
        );
        // If JSON parsing fails, treat as markdown and convert to EditorJS
        parsedContent = convertMarkdownToEditorJS(content);
      }
    } else {
      // Content is in markdown format, convert to EditorJS
      logClientError(
        "Converting markdown content to EditorJS format",
        {
          component: "loadEditorJSContent",
          action: "convertMarkdown",
        },
        "info",
      );
      parsedContent = convertMarkdownToEditorJS(content);
    }

    await editorRef.current.render({ blocks: (parsedContent.blocks ?? []) as EditorJSBlock[], time: parsedContent.time, version: parsedContent.version });
    onContentChange(JSON.stringify(parsedContent));
  } catch (error) {
    const { handleAsyncError } = await import("~/lib/error-handler.client");
    handleAsyncError(error, {
      component: "useLongFormEditor",
      action: "loadInitialData",
    }, false);
    // Fallback to empty editor if all else fails
    try {
      const emptyContent = { blocks: [] };
      await editorRef.current.render(emptyContent);
      onContentChange(JSON.stringify(emptyContent));
    } catch (fallbackError) {
      const { handleAsyncError: handleFallbackError } = await import("~/lib/error-handler.client");
      handleFallbackError(fallbackError, {
        component: "useLongFormEditor",
        action: "loadInitialDataFallback",
      }, false);
    }
  }
}

/**
 * Insert assets into the editor
 */
export async function insertAssetsIntoEditor(
  editorRef: React.RefObject<EditorJSInstance>,
  selectedAssets: {
    assetType: string;
    fileUrl?: string;
    content?: string;
    title?: string;
  }[],
  onContentChange: (content: string) => void,
) {
  if (!editorRef.current) return;

  try {
    // Wait for editor to be ready
    await editorRef.current.isReady;

    // Get current editor data and insert at current block position
    const currentData = await editorRef.current.saver.save();
    const blocks = [...currentData.blocks];

    // Try to get current block index
    let insertIndex = blocks.length; // Default to end
    try {
      const currentBlockIndex =
        editorRef.current.blocks.getCurrentBlockIndex();
      if (currentBlockIndex >= 0) {
        insertIndex = currentBlockIndex + 1; // Insert after current block
      }
    } catch (error) {
      logClientError(
        "Using default insertion position at end",
        {
          component: "insertAssetsIntoEditor",
          action: "getCurrentBlockIndex",
          error: error instanceof Error ? error.message : String(error),
        },
        "info",
      );
    }

    // Create new blocks for assets
    const newBlocks: EditorJSBlock[] = [];
    for (const asset of selectedAssets) {
      if (asset.assetType === "TEXT") {
        const textContent = asset.content || asset.title || "";
        if (textContent) {
          newBlocks.push({
            id: Math.random().toString(36).substr(2, 9),
            type: "paragraph",
            data: {
              text: textContent,
            },
          });
        }
      } else if (asset.assetType === "IMAGE") {
        newBlocks.push({
          id: Math.random().toString(36).substr(2, 9),
          type: "image",
          data: {
            file: {
              url: asset.fileUrl,
            },
            caption: "",
            withBorder: false,
            withBackground: false,
            stretched: false,
          },
        });
      }
    }

    // Insert new blocks at the determined position
    blocks.splice(insertIndex, 0, ...newBlocks);

    // Render the updated data
    const updatedData = {
      ...currentData,
      blocks: blocks,
    };

    await editorRef.current.render(updatedData);
    onContentChange(JSON.stringify(updatedData));

    // Focus editor
    setTimeout(() => {
      editorRef.current?.focus();
    }, 100);
  } catch (error) {
    const { handleAsyncError } = await import("~/lib/error-handler.client");
    handleAsyncError(error, {
      component: "useLongFormEditor",
      action: "insertAssetIntoEditor",
    }, false);
    // Fallback to simple insertion
    try {
      for (const asset of selectedAssets) {
        if (asset.assetType === "TEXT") {
          const textContent = asset.content || asset.title || "";
          if (textContent) {
            editorRef.current.blocks.insert("paragraph", {
              text: textContent,
            });
          }
        } else if (asset.assetType === "IMAGE") {
          editorRef.current.blocks.insert("image", {
            file: {
              url: asset.fileUrl,
            },
            caption: "",
            withBorder: false,
            withBackground: false,
            stretched: false,
          });
        }
      }
      const saveResult = editorRef.current.saver.save();
      const isPromise = saveResult !== null && saveResult !== undefined && typeof saveResult === "object" && "then" in saveResult && typeof (saveResult as { then?: unknown }).then === "function";
      const updatedData = isPromise ? await (saveResult as Promise<unknown>) : (saveResult as unknown);
      onContentChange(JSON.stringify(updatedData));
    } catch (fallbackError) {
      const { handleAsyncError: handleFallbackError } = await import("~/lib/error-handler.client");
      handleFallbackError(fallbackError, {
        component: "useLongFormEditor",
        action: "insertAssetIntoEditorFallback",
      }, false);
    }
  }
}

/**
 * Generate summary from editor content
 */
export function generateSummaryFromContent(content: string): string {
  if (!content) return "";

  try {
    const parsed: unknown = JSON.parse(content);
    const editorData = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as { blocks?: EditorJSBlock[] } : { blocks: [] };
    let textContent = "";

    if (Array.isArray(editorData.blocks)) {
      (editorData.blocks).forEach((block: EditorJSBlock) => {
        if (block.type === "paragraph" || block.type === "header") {
          const textValue = block.data && typeof block.data === "object" && "text" in block.data && typeof (block.data as { text?: unknown }).text === "string" ? (block.data as { text: string }).text : "";
          textContent += textValue + " ";
        } else if (block.type === "list") {
          if (Array.isArray(block.data.items)) {
            block.data.items.forEach((item: string) => {
              textContent += item + " ";
            });
          }
        }
      });
    }

    const plainText = textContent.replace(/<[^>]*>/g, "").trim();
    const generatedSummary =
      plainText.length > 280
        ? plainText.substring(0, 280) + "..."
        : plainText;

    return generatedSummary;
  } catch (error) {
    handleErrorSafely(error, {
      component: "useLongFormEditor",
      action: "generateSummaryFromContent",
    });
    return "";
  }
}

