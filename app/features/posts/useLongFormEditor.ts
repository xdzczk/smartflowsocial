import { useState, useEffect, useRef, useCallback } from "react";

import type { EditorJSInstance, EditorJSAPI } from "~/features/posts/types/editorjs.types";
import {
  disableCaptions,
  setupCaptionObserver,
} from "~/features/posts/utils/editorjs-captions";
import { createEditorJSToolsConfig } from "~/features/posts/utils/editorjs-config";
import {
  loadEditorJSContent,
  insertAssetsIntoEditor,
  generateSummaryFromContent as generateSummary,
} from "~/features/posts/utils/editorjs-content";
import { setupCustomDragDrop } from "~/features/posts/utils/editorjs-dragdrop";
import { logClientError } from "~/lib/error-handler.client";

interface UseLongFormEditorOptions {
    uploadProvider: string | null;
    initialContent?: string;
    onContentChange: (content: string) => void;
}

export function useLongFormEditor({
    uploadProvider,
    initialContent,
    onContentChange,
}: UseLongFormEditorOptions) {
    const editorRef = useRef<EditorJSInstance | null>(null);
    const editorInitialized = useRef(false);
    const [editorReady, setEditorReady] = useState(false);

    // Disable captions function
    const disableCaptionsFn = useCallback(() => {
        disableCaptions();
    }, []);

    // Main editor initialization effect
    useEffect(() => {
        const loadEditor = async () => {
            // Prevent multiple initializations more aggressively
            if (
                typeof window !== "undefined" &&
                !editorRef.current &&
                !editorInitialized.current
            ) {
                editorInitialized.current = true;

                // Check if editor is already initialized in DOM
                const existingEditor = document.getElementById("editorjs");
                if (existingEditor) {
                    // If there's already EditorJS content, don't reinitialize
                    const hasEditorContent =
                        existingEditor.querySelector(".codex-editor") ||
                        existingEditor.querySelector(".ce-block") ||
                        existingEditor.innerHTML.trim().length > 0;

                    if (hasEditorContent) {
                        logClientError(
                            "EditorJS already initialized, skipping...",
                            {
                                component: "useLongFormEditor",
                                action: "loadEditor",
                            },
                            "info",
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
                        } catch (e) {
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

                // Create tools configuration
                const tools = await createEditorJSToolsConfig(uploadProvider);

                const editorInstance = new EditorJS({
                    holder: "editorjs",
                    minHeight: 300,
                    tools: tools as unknown as Record<string, { class: unknown; config?: Record<string, unknown>; inlineToolbar?: boolean }>,
                    data: undefined, // Initial data will be loaded separately
                    onChange: (async (api: EditorJSAPI) => {
                        try {
                            const outputData = await api.saver.save();
                            onContentChange(JSON.stringify(outputData));
                        } catch (error) {
                            const { handleErrorSafely } = await import("~/lib/error-handler.client");
                            handleErrorSafely(error, {
                                component: "useLongFormEditor",
                                action: "onChange",
                            });
                        }
                    }) as unknown as (api: EditorJSAPI) => void,
                }) as EditorJSInstance;

                // Store the editor reference and add to global tracking
                editorRef.current = editorInstance;
                window.EditorJSInstances.push(editorInstance);

                // Initialize custom drag and drop functionality after editor is ready
                void (async () => {
                    try {
                        await editorRef.current.isReady;
                        if (!editorRef.current) return;
                        const editorElement = document.getElementById("editorjs");
                        if (editorElement) {
                            const dragObserver = setupCustomDragDrop(
                                editorRef as unknown as React.RefObject<EditorJSInstance>,
                                editorElement,
                                onContentChange,
                                disableCaptionsFn,
                            );
                            editorRef.current._dragObserver = dragObserver;
                        }
                        setEditorReady(true);
                    } catch (error) {
                        logClientError(
                            error instanceof Error ? error : new Error(String(error)),
                            {
                                component: "useLongFormEditor",
                                action: "initializeDragDrop",
                            },
                            "warning",
                        );
                    }
                })();

                // Run caption disabling immediately and on editor changes
                setTimeout(disableCaptionsFn, 100);

                // Set up a mutation observer to remove captions whenever they appear
                const editorElement = document.getElementById("editorjs");
                if (editorElement) {
                    const captionObserver = setupCaptionObserver(editorElement, disableCaptionsFn);
                    editorRef.current._captionObserver = captionObserver;
                }
            }
        };

        void loadEditor();

        return () => {
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
                        "warning",
                    );
                } finally {
                    editorRef.current = null;
                    editorInitialized.current = false;
                    setEditorReady(false);

                    // Remove from global tracking
                    if (window.EditorJSInstances) {
                        window.EditorJSInstances = window.EditorJSInstances.filter(
                            (instance) => instance !== editorRef.current,
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
    const loadInitialData = useCallback(async (content: string) => {
        if (editorReady && editorRef.current && content) {
            await loadEditorJSContent(editorRef, content, onContentChange);
        }
    }, [editorReady, onContentChange]);

    // Insert assets into the editor
    const insertAssetIntoEditor = useCallback(async (selectedAssets: {
        assetType: string;
        fileUrl?: string;
        content?: string;
        title?: string;
    }[]) => {
        await insertAssetsIntoEditor(editorRef, selectedAssets, onContentChange);
    }, [onContentChange]);

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
