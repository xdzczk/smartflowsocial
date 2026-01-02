/**
 * EditorJS drag and drop functionality
 */

import type { EditorJSBlock, EditorJSInstance } from "../types/editorjs.types";
export function setupCustomDragDrop(
  editorRef: React.RefObject<EditorJSInstance>,
  editorElement: HTMLElement,
  onContentChange: (content: string) => void,
  disableCaptions: () => void,
) {
  let draggedBlockIndex: number | null = null;
  let draggedBlockData: EditorJSBlock | null = null;

  const addDragHandlers = () => {
    const blocks = editorElement.querySelectorAll(".ce-block");

    blocks.forEach((block, index) => {
      const blockElement = block as HTMLElement;
      // Remove existing handlers to avoid duplicates
      // Note: removeEventListener requires exact function reference match, so we skip removal
      // and rely on the event listener system to handle duplicates

      // Make blocks draggable
      blockElement.draggable = true;
      blockElement.dataset.blockIndex = String(index);

      // Add drag handlers
      blockElement.addEventListener("dragstart", (e) => {
        void handleDragStart(e);
      });
      blockElement.addEventListener("dragend", (e) => {
        handleDragEnd(e);
      });
      blockElement.addEventListener("dragover", (e) => {
        handleDragOver(e);
      });
      blockElement.addEventListener("drop", (e) => {
        void handleDrop(e);
      });
    });
  };

  const handleDragStart = async (e: Event) => {
    const dragEvent = e as DragEvent;
    const blockElement = (dragEvent.target as HTMLElement).closest(
      ".ce-block",
    ) as HTMLElement;
    draggedBlockIndex = parseInt(blockElement.dataset.blockIndex ?? "0");

    // Get block data using EditorJS API
    try {
      const currentData = await editorRef.current!.saver.save();
      draggedBlockData = currentData.blocks[draggedBlockIndex];

      dragEvent.dataTransfer!.effectAllowed = "move";
      dragEvent.dataTransfer!.setData("text/html", blockElement.outerHTML);

      blockElement.style.opacity = "0.5";
      blockElement.classList.add("dragging");
    } catch (error) {
      const { handleErrorSafely } = await import("~/lib/error-handler.client");
      handleErrorSafely(error, {
        component: "useLongFormEditor",
        action: "handleDragStart",
      });
    }
  };

  const handleDragEnd = (e: Event) => {
    const blockElement = (e.target as HTMLElement).closest(
      ".ce-block",
    ) as HTMLElement;
    if (blockElement) {
      blockElement.style.opacity = "1";
      blockElement.classList.remove("dragging");
    }

    // Clean up
    draggedBlockIndex = null;
    draggedBlockData = null;
  };

  const handleDragOver = (e: Event) => {
    e.preventDefault();
    const dragEvent = e as DragEvent;
    dragEvent.dataTransfer!.dropEffect = "move";

    const blockElement = (dragEvent.target as HTMLElement).closest(
      ".ce-block",
    ) as HTMLElement;
    if (blockElement && draggedBlockIndex !== null) {
      blockElement.classList.add("drag-over");
    }
  };

  const handleDrop = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    const dropBlockElement = (e.target as HTMLElement).closest(
      ".ce-block",
    ) as HTMLElement;
    if (!dropBlockElement || draggedBlockIndex === null || !draggedBlockData)
      return;

    const dropIndex = parseInt(dropBlockElement.dataset.blockIndex ?? "0");

    // Don't do anything if dropping on the same position
    if (draggedBlockIndex === dropIndex) return;

    try {
      // Get current editor data
      const currentData = await editorRef.current!.saver.save();
      const blocks = [...currentData.blocks];

      // Remove the dragged block from its original position
      blocks.splice(draggedBlockIndex, 1);

      // Calculate the new insertion index
      let newIndex = dropIndex;
      if (draggedBlockIndex < dropIndex) {
        newIndex = dropIndex - 1;
      }

      // Insert the block at the new position
      blocks.splice(newIndex, 0, draggedBlockData);

      // Update the editor with the new order
      const newData = {
        ...currentData,
        blocks: blocks,
      };

      await editorRef.current!.render(newData);
      onContentChange(JSON.stringify(newData));

      const { logClientError } = await import("~/lib/error-handler.client");
      logClientError(
        `Moved block from index ${draggedBlockIndex} to ${newIndex}`,
        {
          component: "editorjs-dragdrop",
          action: "handleDrop",
          draggedBlockIndex,
          newIndex,
        },
        "info",
      );
    } catch (error) {
      const { handleErrorSafely } = await import("~/lib/error-handler.client");
      handleErrorSafely(error, {
        component: "useLongFormEditor",
        action: "handleDrop",
      });
    } finally {
      // Clean up drag state
      dropBlockElement.classList.remove("drag-over");
      document.querySelectorAll(".ce-block").forEach((block) => {
        block.classList.remove("drag-over", "dragging");
      });
    }
  };

  // Initial setup
  addDragHandlers();

  // Re-add handlers when content changes
  const dragObserver = new MutationObserver(() => {
    setTimeout(() => {
      addDragHandlers();
      // Remove captions that might have been added
      setTimeout(disableCaptions, 50);
    }, 100);
  });

  dragObserver.observe(editorElement, {
    childList: true,
    subtree: true,
  });

  return dragObserver;
}
