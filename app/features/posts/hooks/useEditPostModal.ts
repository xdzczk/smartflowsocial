import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

import { resizeImage } from "~/features/upload/image-resize";
import { logClientError } from "~/lib/error-handler.client";
import {
  convertEditorJSToMarkdown,
  convertMarkdownToEditorJS,
} from "~/lib/nostr";

import type {
  PostData,
  LongFormPostData,
  UserData,
  HashTagPreset,
} from "../types";
import type {
  EditorJSInstance as EditorJSInstanceType,
  EditorJSAPI,
} from "../types/editorjs.types";

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
  const captionValue =
    post &&
    typeof post === "object" &&
    "caption" in post &&
    typeof post.caption === "string"
      ? post.caption
      : "";
  const [caption, setCaption] = useState(captionValue);
  const queueTypeId =
    post &&
    typeof post === "object" &&
    "queueType" in post &&
    post.queueType &&
    typeof post.queueType === "object" &&
    "id" in post.queueType &&
    typeof post.queueType.id === "string"
      ? post.queueType.id
      : "";
  const [selectedQueueType, setSelectedQueueType] = useState(queueTypeId);

  // Form fields for longform posts
  const titleValue =
    post &&
    typeof post === "object" &&
    "title" in post &&
    typeof post.title === "string"
      ? post.title
      : "";
  const [title, setTitle] = useState(titleValue);
  const summaryValue =
    post &&
    typeof post === "object" &&
    "summary" in post &&
    typeof post.summary === "string"
      ? post.summary
      : "";
  const [summary, setSummary] = useState(summaryValue);
  const [content, setContent] = useState("");
  const imageValue =
    post &&
    typeof post === "object" &&
    "image" in post &&
    typeof post.image === "string"
      ? post.image
      : "";
  const [image, setImage] = useState(imageValue);

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
      if (isLongform && post && typeof post === "object" && "title" in post) {
        const postTitle = typeof post.title === "string" ? post.title : "";
        const postSummary =
          typeof post.summary === "string" ? post.summary : "";
        const postImage = typeof post.image === "string" ? post.image : "";
        const postContent =
          typeof post.content === "string" ? post.content : "";
        setTitle(postTitle);
        setSummary(postSummary);
        setImage(postImage);
        setContent(postContent);
        const publishedAt =
          post && typeof post === "object" && "publishedAt" in post
            ? post.publishedAt
            : null;
        setScheduledFor(publishedAt ? new Date(publishedAt) : null);
      } else if (
        !isLongform &&
        post &&
        typeof post === "object" &&
        "caption" in post
      ) {
        const postCaption =
          typeof post.caption === "string" ? post.caption : "";
        setCaption(postCaption);
        const queueType =
          post &&
          typeof post === "object" &&
          "queueType" in post &&
          post.queueType &&
          typeof post.queueType === "object" &&
          "id" in post.queueType &&
          typeof post.queueType.id === "string"
            ? post.queueType.id
            : "";
        setSelectedQueueType(queueType);
        const scheduledForValue =
          post && typeof post === "object" && "scheduledFor" in post
            ? (post as { scheduledFor?: unknown }).scheduledFor
            : null;
        setScheduledFor(
          scheduledForValue && typeof scheduledForValue === "string"
            ? new Date(parseInt(scheduledForValue, 10) * 1000)
            : null,
        );

        // Parse existing images
        const fileUrl =
          post && typeof post === "object" && "fileUrl" in post
            ? post.fileUrl
            : null;
        if (fileUrl && Array.isArray(fileUrl)) {
          const urls = fileUrl
            .map((url: unknown) => {
              if (typeof url === "string" && url.startsWith("[")) {
                try {
                  const parsed: unknown = JSON.parse(url);
                  return Array.isArray(parsed)
                    ? parsed.filter(
                        (item): item is string => typeof item === "string",
                      )
                    : [url];
                } catch {
                  return [url];
                }
              }
              return Array.isArray(url)
                ? url.filter((item): item is string => typeof item === "string")
                : typeof url === "string"
                  ? [url]
                  : [];
            })
            .flat();
          setExistingImages(
            urls.filter(
              (url): url is string => typeof url === "string" && url.length > 0,
            ),
          );
        }

        // Parse existing hashtags
        const existingHashtags =
          post &&
          typeof post === "object" &&
          "hashtags" in post &&
          typeof post.hashtags === "string"
            ? post.hashtags
            : "";
        if (existingHashtags) {
          setManualHashtags(existingHashtags);
        }

        // Check if post uses hashtag preset
        const hashTagPresetId =
          post &&
          typeof post === "object" &&
          "hashTagPresetId" in post &&
          typeof post.hashTagPresetId === "string"
            ? post.hashTagPresetId
            : null;
        if (hashTagPresetId && hashTagPresets.length > 0) {
          const preset = hashTagPresets.find((p) => p.id === hashTagPresetId);
          if (preset) {
            setUseHashtagPresets(true);
            setSelectedHashtagPresetId(preset.id);
            const presetTags =
              typeof preset.tags === "string" ? preset.tags : "";
            setSelectedHashtagPresetTags(presetTags);
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

          const toolsConfig = {
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

                      const resultRaw: unknown = await response.json();
                      const result =
                        resultRaw &&
                        typeof resultRaw === "object" &&
                        !Array.isArray(resultRaw)
                          ? (resultRaw as {
                              success?: unknown;
                              file?: unknown;
                              error?: unknown;
                            })
                          : {};
                      const success =
                        typeof result.success === "number"
                          ? result.success
                          : undefined;
                      const fileResult =
                        result.file &&
                        typeof result.file === "object" &&
                        !Array.isArray(result.file)
                          ? (result.file as { url?: unknown })
                          : undefined;
                      const fileUrl =
                        fileResult && typeof fileResult.url === "string"
                          ? fileResult.url
                          : undefined;
                      const error =
                        typeof result.error === "string"
                          ? result.error
                          : undefined;

                      if (success === 1 && fileUrl) {
                        return {
                          success: 1,
                          file: {
                            url: fileUrl,
                          },
                        };
                      } else {
                        throw new Error(error ?? "Upload failed");
                      }
                    } catch (error: unknown) {
                      const { handleAsyncError } = await import(
                        "~/lib/error-handler.client"
                      );
                      handleAsyncError(
                        error,
                        {
                          component: "EditPostModal",
                          action: "uploadImage",
                        },
                        false,
                      );
                      throw error;
                    }
                  },
                },
              },
            },
          };

          const editorInstance = new EditorJS({
            holder: "longform-editorjs",
            minHeight: 300,
            // @ts-expect-error - EditorJS types don't match exactly but work at runtime
            tools: toolsConfig,
            // @ts-expect-error - EditorJS onChange signature doesn't match types but works at runtime
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onChange: async (api: EditorJSAPI) => {
              try {
                const outputData = await api.saver.save();
                const markdownContent = convertEditorJSToMarkdown(outputData);
                setContent(markdownContent);
              } catch (error: unknown) {
                console.error("Editor save error:", error);
              }
            },
          }) as EditorJSInstanceType;

          editorRef.current = editorInstance;
          await editorRef.current.isReady;
          setEditorReady(true);
        } catch (error: unknown) {
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
      } catch (error: unknown) {
        console.error("Error loading initial content into EditorJS:", error);
      }
    };

    const timeoutId = setTimeout(() => {
      void loadInitialContent();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [isLongform, editorReady, content]);

  const formatDateTimeForInput = (date: Date) => {
    const userTimezone =
      user &&
      typeof user === "object" &&
      "timezone" in user &&
      typeof user.timezone === "string"
        ? user.timezone
        : "UTC";
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
    const selectedFiles = Array.from(e.target.files ?? []);
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
    } catch (error: unknown) {
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
