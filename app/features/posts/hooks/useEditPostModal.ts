import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

import {
  convertEditorJSToMarkdown,
  convertMarkdownToEditorJS,
} from "~/features/posts/utils/editorjs-conversion";
import { resizeImage } from "~/features/upload/image-resize";
import { logClientError } from "~/lib/error-handler.client";
import {
  editPostClientSchema,
  editLongformPostClientSchema,
} from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client";

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
  hashTagPresets: _hashTagPresets = [],
  isLongform,
}: UseEditPostModalProps) {
  // Get initial values for form
  const getInitialValues = () => {
    if (isLongform && post && typeof post === "object" && "title" in post) {
      const postTitle = typeof post.title === "string" ? post.title : "";
      const postSummary =
        typeof post.summary === "string" ? post.summary : "";
      const postImage = typeof post.image === "string" ? post.image : "";
      const publishedAt =
        post && typeof post === "object" && "publishedAt" in post
          ? post.publishedAt
          : null;
      const scheduledForStr = publishedAt
        ? new Date(publishedAt).toISOString().slice(0, 16)
        : "";
      const queueType =
        post &&
        typeof post === "object" &&
        "queueType" in post &&
        post.queueType &&
        typeof post.queueType === "object" &&
        "name" in post.queueType &&
        typeof post.queueType.name === "string"
          ? post.queueType.name
          : "";

      const hashTagPresetId =
        post &&
        typeof post === "object" &&
        "hashTagPresetId" in post &&
        typeof post.hashTagPresetId === "string"
          ? post.hashTagPresetId
          : undefined;

      return {
        title: postTitle,
        summary: postSummary,
        content: "",
        image: postImage,
        scheduledFor: scheduledForStr,
        queueType,
        useHashtagPresets: !!hashTagPresetId,
        hashTagPresetId,
        customTags: "",
      };
    } else {
      const postCaption =
        post &&
        typeof post === "object" &&
        "caption" in post &&
        typeof post.caption === "string"
          ? post.caption
          : "";
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
      const scheduledForValue =
        post && typeof post === "object" && "scheduledFor" in post
          ? (post as { scheduledFor?: unknown }).scheduledFor
          : null;
      const scheduledForStr =
        scheduledForValue && typeof scheduledForValue === "string"
          ? new Date(parseInt(scheduledForValue, 10) * 1000)
              .toISOString()
              .slice(0, 16)
          : "";

      const hashTagPresetId =
        post &&
        typeof post === "object" &&
        "hashTagPresetId" in post &&
        typeof post.hashTagPresetId === "string"
          ? post.hashTagPresetId
          : undefined;

      const existingHashtags =
        post &&
        typeof post === "object" &&
        "hashtags" in post &&
        typeof post.hashtags === "string"
          ? post.hashtags
          : "";

      return {
        caption: postCaption,
        queueType: queueTypeId,
        scheduledFor: scheduledForStr,
        isRecyclable: false,
        useHashtagPresets: !!hashTagPresetId,
        hashTagPresetId,
        manualHashtags: existingHashtags,
      };
    }
  };

  // Initialize form with React Hook Form
  const schema = isLongform
    ? editLongformPostClientSchema
    : editPostClientSchema;
  const form = useZodForm(schema, {
    defaultValues: getInitialValues(),
  });

  // Image/media handling (not part of form schema)
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Hashtag preset tags (derived state, not form field)
  const [selectedHashtagPresetTags, setSelectedHashtagPresetTags] =
    useState("");

  // EditorJS state for longform content
  const editorRef = useRef<EditorJSInstanceType | null>(null);
  const editorInitialized = useRef(false);
  const [editorReady, setEditorReady] = useState(false);

  // Load initial content for longform posts
  useEffect(() => {
    if (isLongform && post && typeof post === "object" && "content" in post) {
      const postContent =
        typeof post.content === "string" ? post.content : "";
      if (postContent) {
        form.setValue("content", postContent);
      }
    }
  }, [isLongform, post, form]);

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
                form.setValue("content", markdownContent);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLongform]);

  // Load initial content into EditorJS for longform posts
  const formContent = form.watch("content");
  useEffect(() => {
    if (!isLongform || !editorReady || !editorRef.current || !formContent) return;

    const loadInitialContent = async () => {
      if (!editorRef.current) return;
      try {
        await editorRef.current.isReady;
        const editorJSData = convertMarkdownToEditorJS(formContent);
        await editorRef.current.render(editorJSData);
      } catch (error: unknown) {
        console.error("Error loading initial content into EditorJS:", error);
      }
    };

    const timeoutId = setTimeout(() => {
      void loadInitialContent();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [isLongform, editorReady, formContent]);

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
    form.setValue("hashTagPresetId", presetId ?? undefined);
    form.setValue("useHashtagPresets", !!presetId);
    setSelectedHashtagPresetTags(hashtags);
  };

  // Watch form values for easy access
  const caption = isLongform ? "" : (form.watch("caption") ?? "");
  const title = isLongform ? (form.watch("title") ?? "") : "";
  const summary = isLongform ? (form.watch("summary") ?? "") : "";
  const content = isLongform ? (form.watch("content") ?? "") : "";
  const image = isLongform ? (form.watch("image") ?? "") : "";
  const scheduledForStr = form.watch("scheduledFor");
  const scheduledFor = scheduledForStr
    ? new Date(scheduledForStr)
    : null;
  const selectedQueueType = form.watch("queueType") ?? "";
  const useHashtagPresets = form.watch("useHashtagPresets") ?? false;
  const selectedHashtagPresetId = form.watch("hashTagPresetId") ?? null;
  const manualHashtags = isLongform ? "" : (form.watch("manualHashtags") ?? "");

  // Setter functions for backward compatibility
  const setCaption = (value: string) => {
    if (!isLongform) form.setValue("caption", value);
  };
  const setTitle = (value: string) => {
    if (isLongform) form.setValue("title", value);
  };
  const setSummary = (value: string) => {
    if (isLongform) form.setValue("summary", value);
  };
  const setImage = (value: string) => {
    if (isLongform) form.setValue("image", value);
  };
  const setScheduledFor = (value: Date | null) => {
    form.setValue(
      "scheduledFor",
      value ? value.toISOString().slice(0, 16) : "",
    );
  };
  const setSelectedQueueType = (value: string) => {
    form.setValue("queueType", value);
  };
  const setUseHashtagPresets = (value: boolean) => {
    form.setValue("useHashtagPresets", value);
  };
  const setManualHashtags = (value: string) => {
    if (!isLongform) form.setValue("manualHashtags", value);
  };
  const setContent = (value: string) => {
    if (isLongform) form.setValue("content", value);
  };

  return {
    // Form instance
    form,
    // Form values (for backward compatibility)
    caption,
    title,
    summary,
    content,
    image,
    scheduledFor,
    selectedQueueType,
    useHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtagPresetTags,
    manualHashtags,
    // Setter functions (for backward compatibility)
    setCaption,
    setTitle,
    setSummary,
    setImage,
    setScheduledFor,
    setSelectedQueueType,
    setUseHashtagPresets,
    setManualHashtags,
    setContent,
    // Non-form state
    existingImages,
    newFiles,
    isUploadingImages,
    setIsUploadingImages,
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
