import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

import type { PostData, LongFormPostData, UserData, HashTagPreset } from "~/features/posts/types";
import type { EditorJSInstance as EditorJSInstanceType, EditorJSAPI } from "~/features/posts/types/editorjs.types";
import { resizeImage } from "~/features/upload/image-resize";
import { uploadMultipleFiles } from "~/features/upload/upload.client";
import { logClientError } from "~/lib/error-handler.client";
import {
  signEventFn,
  convertEditorJSToMarkdown,
  convertMarkdownToEditorJS,
} from "~/lib/nostr";

interface UseEditPostModalProps {
  post: PostData | LongFormPostData;
  user?: UserData;
  hashTagPresets?: HashTagPreset[];
  isLongform: boolean;
}

export function useEditPostModal({
  post,
  user,
  hashTagPresets = [],
  isLongform,
}: UseEditPostModalProps) {
  // Form fields for regular posts
  const [caption, setCaption] = useState("caption" in post ? (post.caption || "") : "");
  const [selectedQueueType, setSelectedQueueType] = useState(
    post?.queueType?.id ?? "",
  );

  // Form fields for longform posts
  const [title, setTitle] = useState("title" in post ? (post.title || "") : "");
  const [summary, setSummary] = useState("summary" in post ? (post.summary || "") : "");
  const [content, setContent] = useState("");
  const [image, setImage] = useState("image" in post ? (post.image || "") : "");

  // Schedule fields
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);

  // Image/media handling
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Hashtag preset handling
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState<
    string | null
  >(null);
  const [selectedHashtagPresetTags, setSelectedHashtagPresetTags] =
    useState("");
  const [manualHashtags, setManualHashtags] = useState("");

  // EditorJS state for longform content
  const editorRef = useRef<EditorJSInstanceType | null>(null);
  const editorInitialized = useRef(false);
  const [editorReady, setEditorReady] = useState(false);

  // Initialize form fields from post
  useEffect(() => {
    if (post) {
      if (isLongform && "title" in post) {
        setTitle(post.title || "");
        setSummary(post.summary || "");
        setImage(post.image || "");
        setContent(post.content || "");
        setScheduledFor(post.publishedAt ? new Date(post.publishedAt) : null);
      } else if (!isLongform && "caption" in post) {
        setCaption(post.caption || "");
        setSelectedQueueType(post.queueType?.id ?? "");
        setScheduledFor(
          post.scheduledFor
            ? new Date(parseInt(post.scheduledFor) * 1000)
            : null,
        );

        // Parse existing images
        if ("fileUrl" in post && post.fileUrl && Array.isArray(post.fileUrl)) {
          const urls = post.fileUrl
            .map((url: string) => {
              if (typeof url === "string" && url.startsWith("[")) {
                try {
                  const parsed = JSON.parse(url);
                  return Array.isArray(parsed) ? parsed : [url];
                } catch {
                  return [url];
                }
              }
              return Array.isArray(url) ? url : [url];
            })
            .flat();
          setExistingImages(
            urls.filter((url) => typeof url === "string" && url.length > 0),
          );
        }

        // Parse existing hashtags
        const existingHashtags = post.hashtags || "";
        if (existingHashtags) {
          setManualHashtags(existingHashtags);
        }

        // Check if post uses hashtag preset
        if (post.hashTagPresetId && hashTagPresets.length > 0) {
          const preset = hashTagPresets.find(
            (p) => p.id === post.hashTagPresetId,
          );
          if (preset) {
            setUseHashtagPresets(true);
            setSelectedHashtagPresetId(preset.id);
            setSelectedHashtagPresetTags(preset.tags || "");
          }
        }
      }
    }
  }, [post, isLongform, hashTagPresets]);

  // Initialize EditorJS for longform posts
  useEffect(() => {
    if (!isLongform) return;

    const loadEditor = async () => {
      if (
        typeof window !== "undefined" &&
        !editorRef.current &&
        !editorInitialized.current
      ) {
        editorInitialized.current = true;

        try {
          const EditorJS = (await import("@editorjs/editorjs")).default;

          const editorInstance = new EditorJS({
            holder: "longform-editorjs",
            minHeight: 300,
            tools: {
              header: {
                class: (await import("@editorjs/header")).default as unknown as new (config?: { placeholder?: string; levels?: number[]; defaultLevel?: number }) => unknown,
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
                class: (await import("@editorjs/link")).default as unknown as new (config?: { endpoint?: string }) => unknown,
                config: {
                  endpoint: "/api/link-preview",
                },
              },
              embed: {
                class: (await import("@editorjs/embed")).default as unknown as new (config?: { services?: Record<string, boolean> }) => unknown,
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
                    uploadByFile: async (file: File) => {
                      try {
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
                          throw new Error(`Server error: ${response.status}`);
                        }

                        const result = (await response.json()) as {
                          success?: number;
                          file?: { url?: string };
                          error?: string;
                        };

                        if (result.success === 1 && result.file?.url) {
                          return {
                            success: 1,
                            file: {
                              url: result.file.url,
                            },
                          };
                        } else {
                          throw new Error(result.error || "Upload failed");
                        }
                      } catch (error) {
                        const { handleAsyncError } = await import("~/lib/error-handler.client");
                        handleAsyncError(error, {
                          component: "EditPostModal",
                          action: "uploadImage",
                        }, false);
                        throw error;
                      }
                    },
                  },
                },
              },
            },
            onChange: (async (api: EditorJSAPI) => {
              try {
                const outputData = await api.saver.save();
                const markdownContent = convertEditorJSToMarkdown(outputData);
                setContent(markdownContent);
              } catch (error) {
                console.error("Editor save error:", error);
              }
            }),
          });

          editorRef.current = editorInstance;
          await editorRef.current.isReady;
          setEditorReady(true);
        } catch (error) {
          console.error("Error loading EditorJS:", error);
          editorInitialized.current = false;
        }
      }
    };

    void loadEditor();

    return () => {
      if (editorRef.current) {
        try {
          if (editorRef.current.destroy) {
            editorRef.current.destroy();
          }
        } catch (error) {
          logClientError(
            error instanceof Error ? error : new Error(String(error)),
            {
              component: "useEditPostModal",
              action: "cleanup",
              message: "Error during editor cleanup",
            },
            "warning",
          );
        } finally {
          editorRef.current = null;
          editorInitialized.current = false;
          setEditorReady(false);
        }
      }
    };
  }, [isLongform]);

  // Load initial content into EditorJS for longform posts
  useEffect(() => {
    if (!isLongform || !editorReady || !editorRef.current || !content) return;

    const loadInitialContent = async () => {
      if (!editorRef.current) return;
      try {
        await editorRef.current.isReady;
        const editorJSData = convertMarkdownToEditorJS(content);
        await editorRef.current.render(editorJSData);
      } catch (error) {
        console.error("Error loading initial content into EditorJS:", error);
      }
    };

    const timeoutId = setTimeout(() => {
      void loadInitialContent();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [isLongform, editorReady, content]);

  const formatDateTimeForInput = (date: Date) => {
    const userTimezone = user?.timezone ?? "UTC";
    const dateInUserTz = new Date(
      date.toLocaleString("en-US", { timeZone: userTimezone }),
    );
    const year = dateInUserTz.getFullYear();
    const month = String(dateInUserTz.getMonth() + 1).padStart(2, "0");
    const day = String(dateInUserTz.getDate()).padStart(2, "0");
    const hours = String(dateInUserTz.getHours()).padStart(2, "0");
    const minutes = String(dateInUserTz.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    try {
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          if (file.type.startsWith("image/")) {
            return await resizeImage(file);
          }
          return file;
        }),
      );
      setNewFiles((prev) => [...prev, ...processedFiles]);
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error("Error processing files");
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string,
  ) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtagPresetTags(hashtags);
  };

  return {
    // State
    caption,
    setCaption,
    selectedQueueType,
    setSelectedQueueType,
    title,
    setTitle,
    summary,
    setSummary,
    content,
    setContent,
    image,
    setImage,
    scheduledFor,
    setScheduledFor,
    existingImages,
    newFiles,
    isUploadingImages,
    setIsUploadingImages,
    useHashtagPresets,
    setUseHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtagPresetTags,
    manualHashtags,
    setManualHashtags,
    editorRef,
    editorReady,
    // Handlers
    handleFileChange,
    removeExistingImage,
    removeNewFile,
    handleHashtagPresetSelect,
    formatDateTimeForInput,
  };
}

