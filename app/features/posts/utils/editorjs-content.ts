/**
 * EditorJS content loading and manipulation utilities
 */

import React from "react";
import { convertMarkdownToEditorJS } from "~/lib/nostr";
import { handleErrorSafely } from "~/lib/error-handler.client";
import type { EditorJSInstance, EditorJSBlock } from "~/features/posts/types/editorjs.types";

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
        parsedContent = JSON.parse(content);
        // Validate it has EditorJS structure
        if (
          !parsedContent.blocks ||
          !Array.isArray(parsedContent.blocks)
        ) {
          throw new Error("Not valid EditorJS format");
        }
      } catch (jsonError) {
        console.warn(
          "Content is not valid EditorJS JSON, treating as markdown:",
          jsonError,
        );
        // If JSON parsing fails, treat as markdown and convert to EditorJS
        parsedContent = convertMarkdownToEditorJS(content);
      }
    } else {
      // Content is in markdown format, convert to EditorJS
      console.log("Converting markdown content to EditorJS format");
      parsedContent = convertMarkdownToEditorJS(content);
    }

    await editorRef.current.render(parsedContent);
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
  selectedAssets: Array<{
    assetType: string;
    fileUrl?: string;
    content?: string;
    title?: string;
  }>,
  onContentChange: (content: string) => void,
) {
  if (!editorRef.current) return;

  try {
    // Wait for editor to be ready
    await editorRef.current.isReady;

    // Get current editor data and insert at current block position
    const currentData = await editorRef.current.save();
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
      console.log("Using default insertion position at end");
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
            await editorRef.current.blocks.insert("paragraph", {
              text: textContent,
            });
          }
        } else if (asset.assetType === "IMAGE") {
          await editorRef.current.blocks.insert("image", {
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
      const updatedData = await editorRef.current.save();
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
    const editorData = JSON.parse(content);
    let textContent = "";

    editorData.blocks?.forEach((block: EditorJSBlock) => {
      if (block.type === "paragraph" || block.type === "header") {
        textContent += block.data.text + " ";
      } else if (block.type === "list") {
        block.data.items?.forEach((item: string) => {
          textContent += item + " ";
        });
      }
    });

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

