import { useState, useEffect, useRef, useCallback } from "react";

import { logClientError } from "~/lib/error-handler.client";

import type { EditorJSInstance, EditorJSAPI } from "./types/editorjs.types";
import {
  disableCaptions,
  setupCaptionObserver,
} from "./utils/editorjs-captions";
import { createEditorJSToolsConfig } from "./utils/editorjs-config";
import {
  loadEditorJSContent,
  insertAssetsIntoEditor,
  generateSummaryFromContent as generateSummary,
} from "./utils/editorjs-content";
import { setupCustomDragDrop } from "./utils/editorjs-dragdrop";

interface UseLongFormEditorOptions {
  uploadProvider: string | null;
  initialContent?: string;
  onContentChange: (content: string) => void;
}

export function useLongFormEditor({
  uploadProvider,
  initialContent: _initialContent,
  onContentChange,
}: UseLongFormEditorOptions) {
  const editorRef = useRef<EditorJSInstance | null>(null);
  const editorInitialized = useRef(false);
  const [editorReady, setEditorReady] = useState(false);
  const isMountedRef = useRef(true);

  // Disable captions function
  const disableCaptionsFn = useCallback(() => {
    disableCaptions();
  }, []);

  // Main editor initialization effect
  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;

    const loadEditor = async () => {
      // Prevent multiple initializations more aggressively
      if (
        typeof window !== "undefined" &&
        !editorRef.current &&
        !editorInitialized.current &&
        isMountedRef.current
      ) {
        editorInitialized.current = true;

        // Check if editor is already initialized in DOM
        const existingEditor = document.getElementById("editorjs");
        if (existingEditor) {
          // If there's already EditorJS content, don't reinitialize
          const hasEditorContent =
            existingEditor.querySelector(".codex-editor") ??
            existingEditor.querySelector(".ce-block") ??
            existingEditor.innerHTML.trim().length > 0;

          if (hasEditorContent) {
            logClientError(
              "EditorJS already initialized, skipping...",
              {
                component: "useLongFormEditor",
                action: "loadEditor",
              },
              "info"
            );
            editorInitialized.current = false; // Reset flag so it can try again if needed
            return;
          }

          existingEditor.innerHTML = "";

          // Remove any existing EditorJS classes that might interfere
          existingEditor.className = existingEditor.className
            .split(" ")
            .filter((cls) => !cls.startsWith("codex-editor"))
            .join(" ");
        }

        // Also check for any existing editor instances globally
        if (window.EditorJSInstances) {
          window.EditorJSInstances.forEach((instance) => {
            try {
              if (instance.destroy) instance.destroy();
            } catch (_e) {
              /* ignore cleanup errors */
            }
          });
          window.EditorJSInstances = [];
        } else {
          window.EditorJSInstances = [];
        }

        const EditorJS = (await import("@editorjs/editorjs")).default;

        // Add a small delay to ensure DOM is fully ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if component is still mounted and element exists before creating editor
        if (!isMountedRef.current) {
          editorInitialized.current = false;
          return;
        }

        const editorElement = document.getElementById("editorjs");
        if (!editorElement) {
          editorInitialized.current = false;
          return;
        }

        // Create tools configuration
        const tools = await createEditorJSToolsConfig(uploadProvider);

        // Double-check component is still mounted before creating editor instance
        if (!isMountedRef.current) {
          editorInitialized.current = false;
          return;
        }

        let editorInstance: EditorJSInstance;
        try {
          editorInstance = new EditorJS({
            holder: "editorjs",
            minHeight: 300,
            // @ts-expect-error - EditorJS types don't match exactly but work at runtime
            tools: tools,
            data: undefined, // Initial data will be loaded separately
            // @ts-expect-error - EditorJS onChange signature doesn't match types but works at runtime
            // eslint-disable-next-line @typescript-eslint/no-misused-promises -- EditorJS onChange is async but types don't reflect this
            onChange: async (api: EditorJSAPI) => {
              // Check if component is still mounted and editor element exists
              if (!isMountedRef.current) {
                return;
              }

              const editorElement = document.getElementById("editorjs");
              if (!editorElement) {
                return;
              }

              try {
                const outputData = await api.saver.save();
                // Double-check component is still mounted before calling callback
                if (isMountedRef.current) {
                  onContentChange(JSON.stringify(outputData));
                }
              } catch (error) {
                // Only log errors if component is still mounted
                if (isMountedRef.current) {
                  const { handleErrorSafely } = await import(
                    "~/lib/error-handler.client"
                  );
                  handleErrorSafely(error, {
                    component: "useLongFormEditor",
                    action: "onChange",
                  });
                }
              }
            },
          }) as EditorJSInstance;
        } catch (error) {
          // If editor creation fails, reset flag and return
          editorInitialized.current = false;
          if (isMountedRef.current) {
            logClientError(
              error instanceof Error ? error : new Error(String(error)),
              {
                component: "useLongFormEditor",
                action: "createEditor",
                message: "Failed to create EditorJS instance",
              },
              "warning"
            );
          }
          return;
        }

        // Store the editor reference and add to global tracking
        editorRef.current = editorInstance;
        window.EditorJSInstances.push(editorInstance);

        // Initialize custom drag and drop functionality after editor is ready
        void (async () => {
          try {
            if (!editorRef.current || !isMountedRef.current) return;

            // Check if element still exists before waiting for isReady
            const editorElement = document.getElementById("editorjs");
            if (!editorElement || !isMountedRef.current) return;

            await editorRef.current.isReady;

            // Check again after isReady resolves
            if (!editorRef.current || !isMountedRef.current) return;

            const editorElementAfterReady = document.getElementById("editorjs");
            if (!editorElementAfterReady || !isMountedRef.current) return;

            const dragObserver = setupCustomDragDrop(
              editorRef as unknown as React.RefObject<EditorJSInstance>,
              editorElementAfterReady,
              onContentChange,
              disableCaptionsFn
            );
            editorRef.current._dragObserver = dragObserver;

            if (isMountedRef.current) {
              setEditorReady(true);
            }
          } catch (error) {
            // Only log if component is still mounted
            if (isMountedRef.current) {
              logClientError(
                error instanceof Error ? error : new Error(String(error)),
                {
                  component: "useLongFormEditor",
                  action: "initializeDragDrop",
                },
                "warning"
              );
            }
          }
        })();

        // Run caption disabling immediately and on editor changes
        // Only if component is still mounted
        if (isMountedRef.current) {
          setTimeout(() => {
            if (isMountedRef.current) {
              disableCaptionsFn();
            }
          }, 100);
        }

        // Set up a mutation observer to remove captions whenever they appear
        // Only if component is still mounted
        if (isMountedRef.current) {
          const editorElement = document.getElementById("editorjs");
          if (editorElement && editorRef.current) {
            const captionObserver = setupCaptionObserver(
              editorElement,
              disableCaptionsFn
            );
            editorRef.current._captionObserver = captionObserver;
          }
        }
      }
    };

    void loadEditor();

    return () => {
      // Mark component as unmounted to prevent onChange callbacks
      isMountedRef.current = false;

      if (editorRef.current) {
        try {
          // Clean up mutation observers
          if (editorRef.current._captionObserver) {
            editorRef.current._captionObserver.disconnect();
          }
          if (editorRef.current._dragObserver) {
            editorRef.current._dragObserver.disconnect();
          }

          // Destroy the editor instance
          if (editorRef.current.destroy) {
            editorRef.current.destroy();
          }
        } catch (error) {
          logClientError(
            error instanceof Error ? error : new Error(String(error)),
            {
              component: "useLongFormEditor",
              action: "cleanup",
              message: "Error during editor cleanup",
            },
            "warning"
          );
        } finally {
          editorRef.current = null;
          editorInitialized.current = false;
          setEditorReady(false);

          // Remove from global tracking
          if (window.EditorJSInstances) {
            window.EditorJSInstances = window.EditorJSInstances.filter(
              (instance) => instance !== editorRef.current
            );
          }

          // Also clear the DOM container to prevent issues
          const editorContainer = document.getElementById("editorjs");
          if (editorContainer) {
            editorContainer.innerHTML = "";

            // Remove any EditorJS classes
            editorContainer.className = editorContainer.className
              .split(" ")
              .filter((cls) => !cls.startsWith("codex-editor"))
              .join(" ");
          }
        }
      }
    };
  }, [uploadProvider, onContentChange, disableCaptionsFn]);

  // Load initial content when editor is ready
  const loadInitialData = useCallback(
    async (content: string) => {
      if (editorReady && editorRef.current && content) {
        await loadEditorJSContent(editorRef, content, onContentChange);
      }
    },
    [editorReady, onContentChange]
  );

  // Insert assets into the editor
  const insertAssetIntoEditor = useCallback(
    async (
      selectedAssets: Array<{
        assetType: string;
        fileUrl?: string;
        content?: string;
        title?: string;
      }>
    ) => {
      await insertAssetsIntoEditor(editorRef, selectedAssets, onContentChange);
    },
    [onContentChange]
  );

  // Generate summary from editor content
  const generateSummaryFromContent = useCallback((content: string) => {
    return generateSummary(content);
  }, []);

  return {
    editorRef,
    editorReady,
    loadInitialData,
    insertAssetIntoEditor,
    generateSummaryFromContent,
  };
}
