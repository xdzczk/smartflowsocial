import { useState, useEffect, useRef, useCallback } from "react";

interface UseLongFormEditorOptions {
    uploadProvider: string | null;
    initialContent?: string;
    onContentChange: (content: string) => void;
}

interface EditorJSInstance {
    isReady: Promise<void>;
    save: () => Promise<{ blocks: any[] }>;
    render: (data: { blocks: any[] }) => Promise<void>;
    blocks: {
        getCurrentBlockIndex: () => number;
        insert: (type: string, data: any) => void;
    };
    focus: () => void;
    destroy: () => void;
    _captionObserver?: MutationObserver;
    _dragObserver?: MutationObserver;
}

declare global {
    interface Window {
        EditorJSInstances?: EditorJSInstance[];
    }
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
    const disableCaptions = useCallback(() => {
        const captions = document.querySelectorAll(
            ".image-tool__caption, .image-tool .cdx-input",
        );
        captions.forEach((caption) => {
            if (caption) {
                (caption as HTMLElement).style.display = "none";
                caption.remove();
            }
        });
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
                        console.log("EditorJS already initialized, skipping...");
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

                const editorInstance = new EditorJS({
                    holder: "editorjs",
                    minHeight: 300,
                    tools: {
                        header: {
                            class: (await import("@editorjs/header")).default,
                            config: {
                                placeholder: "Enter a header",
                                levels: [2, 3, 4],
                                defaultLevel: 3,
                            },
                        },
                        list: {
                            class: (await import("@editorjs/list")).default,
                            inlineToolbar: true,
                        },
                        quote: {
                            class: (await import("@editorjs/quote")).default,
                            inlineToolbar: true,
                            config: {
                                quotePlaceholder: "Enter a quote",
                                captionPlaceholder: "Quote's author",
                            },
                        },
                        code: {
                            class: (await import("@editorjs/code")).default,
                            config: {
                                placeholder: "Enter code here...",
                            },
                        },
                        inlineCode: {
                            class: (await import("@editorjs/inline-code")).default,
                        },
                        linkTool: {
                            class: (await import("@editorjs/link")).default,
                            config: {
                                endpoint: "/api/link-preview",
                            },
                        },
                        embed: {
                            class: (await import("@editorjs/embed")).default,
                            config: {
                                services: {
                                    youtube: true,
                                    twitter: true,
                                },
                            },
                        },
                        image: {
                            class: (await import("@editorjs/image")).default,
                            config: {
                                buttonContent: "Select Image",
                                captionPlaceholder: "",
                                withBorder: false,
                                withBackground: false,
                                stretched: false,
                                uploader: {
                                    uploadByUrl: (url: string) => {
                                        // Handle direct URL uploads (for assets)
                                        return Promise.resolve({
                                            success: 1,
                                            file: {
                                                url: url,
                                            },
                                        });
                                    },
                                    uploadByFile: async (file: File) => {
                                        try {
                                            console.log(
                                                "Starting EditorJS image upload:",
                                                file.name,
                                                file.size,
                                            );

                                            // Check upload provider and use appropriate method
                                            if (uploadProvider && uploadProvider.includes("BLOSSOM")) {
                                                // Use client-side upload for Blossom
                                                const { uploadFile } = await import("~/features/upload/upload.client");
                                                const uploadResult = await uploadFile(file);

                                                if (uploadResult.success && uploadResult.file) {
                                                    console.log("Blossom upload successful:", uploadResult.file.url);
                                                    return {
                                                        success: 1,
                                                        file: {
                                                            url: uploadResult.file.url,
                                                            size: uploadResult.file.size || file.size,
                                                            name: uploadResult.file.name || file.name,
                                                            extension: uploadResult.file.extension || file.name.split(".").pop(),
                                                        },
                                                    };
                                                } else {
                                                    console.error("Blossom upload failed:", uploadResult.error);
                                                    throw new Error(uploadResult.error || "Blossom upload failed");
                                                }
                                            } else {
                                                // Use server-side upload for S3
                                                const formData = new FormData();
                                                formData.append("image", file);

                                                const response = await fetch(
                                                    "/api/upload-editorjs-image",
                                                    {
                                                        method: "POST",
                                                        body: formData,
                                                    },
                                                );

                                                if (!response.ok) {
                                                    const errorText = await response.text();
                                                    console.error("Server error response:", errorText);
                                                    throw new Error(`Server error: ${response.status}`);
                                                }

                                                const result = await response.json();
                                                console.log("S3 EditorJS upload response:", result);

                                                if (result.success === 1 && result.file?.url) {
                                                    console.log("S3 upload successful:", result.file.url);
                                                    return {
                                                        success: 1,
                                                        file: {
                                                            url: result.file.url,
                                                            size: result.file.size || file.size,
                                                            name: result.file.name || file.name,
                                                            extension:
                                                                result.file.extension ||
                                                                file.name.split(".").pop(),
                                                        },
                                                    };
                                                } else {
                                                    console.error("S3 upload failed:", result.error);
                                                    throw new Error(result.error || "Upload failed");
                                                }
                                            }
                                        } catch (error) {
                                            console.error("EditorJS upload error:", error);
                                            throw error;
                                        }
                                    },
                                },
                            },
                        },
                    },
                    data: undefined, // Initial data will be loaded separately
                    onChange: async (api: any) => {
                        try {
                            const outputData = await api.saver.save();
                            onContentChange(JSON.stringify(outputData));
                        } catch (error) {
                            console.error("Editor save error:", error);
                        }
                    },
                }) as EditorJSInstance;

                // Store the editor reference and add to global tracking
                editorRef.current = editorInstance;
                window.EditorJSInstances!.push(editorInstance);

                // Initialize custom drag and drop functionality after editor is ready
                editorRef.current.isReady.then(() => {
                    setupCustomDragDrop();
                    setEditorReady(true);
                });

                // Run caption disabling immediately and on editor changes
                setTimeout(disableCaptions, 100);

                // Set up a mutation observer to remove captions whenever they appear
                const captionObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === "childList") {
                            setTimeout(disableCaptions, 10);
                        }
                    });
                });

                // Observe the editor container for changes
                const editorElement = document.getElementById("editorjs");
                if (editorElement) {
                    captionObserver.observe(editorElement, {
                        childList: true,
                        subtree: true,
                    });
                }

                // Store observer reference for cleanup
                editorRef.current._captionObserver = captionObserver;

                // Custom drag and drop setup function using EditorJS API
                const setupCustomDragDrop = () => {
                    const editorElement = document.getElementById("editorjs");
                    if (!editorElement) return;

                    let draggedBlockIndex: number | null = null;
                    let draggedBlockData: any = null;

                    const addDragHandlers = () => {
                        const blocks = editorElement.querySelectorAll(".ce-block");

                        blocks.forEach((block, index) => {
                            const blockElement = block as HTMLElement;
                            // Remove existing handlers to avoid duplicates
                            blockElement.removeEventListener("dragstart", handleDragStart);
                            blockElement.removeEventListener("dragend", handleDragEnd);
                            blockElement.removeEventListener("dragover", handleDragOver);
                            blockElement.removeEventListener("drop", handleDrop);

                            // Make blocks draggable
                            blockElement.draggable = true;
                            blockElement.dataset.blockIndex = String(index);

                            // Add drag handlers
                            blockElement.addEventListener("dragstart", handleDragStart);
                            blockElement.addEventListener("dragend", handleDragEnd);
                            blockElement.addEventListener("dragover", handleDragOver);
                            blockElement.addEventListener("drop", handleDrop);
                        });
                    };

                    const handleDragStart = async (e: Event) => {
                        const dragEvent = e as DragEvent;
                        const blockElement = (dragEvent.target as HTMLElement).closest(".ce-block") as HTMLElement;
                        draggedBlockIndex = parseInt(blockElement.dataset.blockIndex || "0");

                        // Get block data using EditorJS API
                        try {
                            const currentData = await editorRef.current!.save();
                            draggedBlockData = currentData.blocks[draggedBlockIndex];

                            dragEvent.dataTransfer!.effectAllowed = "move";
                            dragEvent.dataTransfer!.setData("text/html", blockElement.outerHTML);

                            blockElement.style.opacity = "0.5";
                            blockElement.classList.add("dragging");
                        } catch (error) {
                            console.error("Error getting block data:", error);
                        }
                    };

                    const handleDragEnd = (e: Event) => {
                        const blockElement = (e.target as HTMLElement).closest(".ce-block") as HTMLElement;
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

                        const blockElement = (dragEvent.target as HTMLElement).closest(".ce-block") as HTMLElement;
                        if (blockElement && draggedBlockIndex !== null) {
                            blockElement.classList.add("drag-over");
                        }
                    };

                    const handleDrop = async (e: Event) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const dropBlockElement = (e.target as HTMLElement).closest(".ce-block") as HTMLElement;
                        if (
                            !dropBlockElement ||
                            draggedBlockIndex === null ||
                            !draggedBlockData
                        )
                            return;

                        const dropIndex = parseInt(dropBlockElement.dataset.blockIndex || "0");

                        // Don't do anything if dropping on the same position
                        if (draggedBlockIndex === dropIndex) return;

                        try {
                            // Get current editor data
                            const currentData = await editorRef.current!.save();
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

                            console.log(
                                `Moved block from index ${draggedBlockIndex} to ${newIndex}`,
                            );
                        } catch (error) {
                            console.error("Error reordering blocks:", error);
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

                    // Store observer for cleanup
                    editorRef.current!._dragObserver = dragObserver;
                };
            }
        };

        loadEditor();

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
                    console.warn("Error during editor cleanup:", error);
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
    }, [uploadProvider, onContentChange, disableCaptions]);

    // Load initial content when editor is ready
    const loadInitialData = useCallback(async (content: string) => {
        if (editorReady && editorRef.current && content) {
            try {
                await editorRef.current.isReady;

                const { convertMarkdownToEditorJS } = await import("~/lib/nostr");
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
                console.error("Error loading initial data:", error);
                // Fallback to empty editor if all else fails
                try {
                    const emptyContent = { blocks: [] };
                    await editorRef.current.render(emptyContent);
                    onContentChange(JSON.stringify(emptyContent));
                } catch (fallbackError) {
                    console.error("Even fallback failed:", fallbackError);
                }
            }
        }
    }, [editorReady, onContentChange]);

    // Insert assets into the editor
    const insertAssetIntoEditor = useCallback(async (selectedAssets: Array<{
        assetType: string;
        fileUrl?: string;
        content?: string;
        title?: string;
    }>) => {
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
            const newBlocks: any[] = [];
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
            console.error("Error inserting assets into editor:", error);
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
                console.error("Fallback insertion also failed:", fallbackError);
            }
        }
    }, [onContentChange]);

    // Generate summary from editor content
    const generateSummaryFromContent = useCallback((content: string) => {
        if (!content) return "";

        try {
            const editorData = JSON.parse(content);
            let textContent = "";

            editorData.blocks?.forEach((block: any) => {
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
            console.error("Error generating summary:", error);
            return "";
        }
    }, []);

    return {
        editorRef,
        editorReady,
        loadInitialData,
        insertAssetIntoEditor,
        generateSummaryFromContent,
    };
}
