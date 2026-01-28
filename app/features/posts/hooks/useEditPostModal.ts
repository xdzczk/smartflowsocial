import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

import {
  convertEditorJSToMarkdown,
  convertMarkdownToEditorJS,
} from "~/features/posts/utils/editorjs-conversion";
import { resizeImage } from "~/features/upload/image-resize";
import { logClientError } from "~/lib/error-handler.client";
import {
  formatForDateTimeLocal,
  fromDate,
  fromISOString,
  toDate,
} from "~/lib/temporal";
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

// ============================================================================
// Helper Functions for Initial Values
// ============================================================================

function getStringValue(
  post: PostData | LongFormPostData,
  key: string
): string {
  if (
    typeof post === "object" &&
    key in post &&
    typeof (post as unknown as Record<string, unknown>)[key] === "string"
  ) {
    const value = (post as unknown as Record<string, string>)[key];
    return value ?? "";
  }
  return "";
}

function getQueueTypeName(post: PostData | LongFormPostData): string {
  if (
    typeof post === "object" &&
    "queueType" in post &&
    (post as { queueType: unknown }).queueType &&
    typeof (post as { queueType: unknown }).queueType === "object" &&
    "name" in (post as { queueType: { name?: unknown } }).queueType &&
    typeof (post as { queueType: { name: string } }).queueType.name === "string"
  ) {
    return (post as { queueType: { name: string } }).queueType.name;
  }
  return "";
}

function getQueueTypeId(post: PostData | LongFormPostData): string {
  if (
    typeof post === "object" &&
    "queueType" in post &&
    (post as { queueType: unknown }).queueType &&
    typeof (post as { queueType: unknown }).queueType === "object" &&
    "id" in (post as { queueType: { id?: unknown } }).queueType &&
    typeof (post as { queueType: { id: string } }).queueType.id === "string"
  ) {
    return (post as { queueType: { id: string } }).queueType.id;
  }
  return "";
}

function getHashTagPresetId(
  post: PostData | LongFormPostData
): string | undefined {
  if (
    typeof post === "object" &&
    "hashTagPresetId" in post &&
    typeof (post as { hashTagPresetId: unknown }).hashTagPresetId === "string"
  ) {
    return (post as { hashTagPresetId: string }).hashTagPresetId;
  }
  return undefined;
}

function formatScheduledForFromDate(
  date: Date | string | null,
  userTimezone = "UTC"
): string {
  if (!date) return "";
  try {
    const zoned = fromDate(new Date(date), userTimezone);
    return formatForDateTimeLocal(zoned, userTimezone);
  } catch {
    // Fallback - still use Temporal for 100% consistency
    try {
      const zoned = fromISOString(String(date), userTimezone);
      return formatForDateTimeLocal(zoned, userTimezone);
    } catch {
      // Fallback - try with Date conversion
      try {
        const zoned = fromDate(new Date(date), userTimezone);
        return formatForDateTimeLocal(zoned, userTimezone);
      } catch {
        return new Date(date).toISOString().slice(0, 16);
      }
    }
  }
}

function getLongformInitialValues(post: PostData | LongFormPostData): {
  title: string;
  summary: string;
  content: string;
  image: string;
  scheduledFor: string;
  queueType: string;
  useHashtagPresets: boolean;
  hashTagPresetId: string | undefined;
  customTags: string;
} {
  const publishedAt =
    typeof post === "object" && "publishedAt" in post ? post.publishedAt : null;
  const scheduledAtUtc =
    typeof post === "object" && "scheduledAtUtc" in post
      ? (post as { scheduledAtUtc?: unknown }).scheduledAtUtc
      : null;
  const scheduledCandidateRaw = scheduledAtUtc ?? publishedAt;
  const scheduledCandidate =
    scheduledCandidateRaw instanceof Date
      ? scheduledCandidateRaw
      : typeof scheduledCandidateRaw === "string"
        ? scheduledCandidateRaw
        : null;

  return {
    title: getStringValue(post, "title"),
    summary: getStringValue(post, "summary"),
    content: "",
    image: getStringValue(post, "image"),
    scheduledFor: formatScheduledForFromDate(scheduledCandidate, "UTC"),
    queueType: getQueueTypeName(post),
    useHashtagPresets: !!getHashTagPresetId(post),
    hashTagPresetId: getHashTagPresetId(post),
    customTags: "",
  };
}

function getRegularPostInitialValues(post: PostData | LongFormPostData): {
  caption: string;
  queueType: string;
  scheduledFor: string;
  isRecyclable: boolean;
  useHashtagPresets: boolean;
  hashTagPresetId: string | undefined;
  manualHashtags: string;
} {
  const scheduledAtUtcValue =
    typeof post === "object" && "scheduledAtUtc" in post
      ? (post as { scheduledAtUtc?: unknown }).scheduledAtUtc
      : null;
  const scheduledAtUtc =
    scheduledAtUtcValue instanceof Date
      ? scheduledAtUtcValue
      : typeof scheduledAtUtcValue === "string"
        ? scheduledAtUtcValue
        : null;

  return {
    caption: getStringValue(post, "caption"),
    queueType: getQueueTypeId(post),
    scheduledFor: formatScheduledForFromDate(scheduledAtUtc, "UTC"),
    isRecyclable: false,
    useHashtagPresets: !!getHashTagPresetId(post),
    hashTagPresetId: getHashTagPresetId(post),
    manualHashtags: getStringValue(post, "hashtags"),
  };
}

export function useEditPostModal({
  post,
  user,
  hashTagPresets: _hashTagPresets = [],
  isLongform,
}: UseEditPostModalProps) {
  // Get initial values for form
  const getInitialValues = () => {
    if (isLongform && typeof post === "object" && "title" in post) {
      return getLongformInitialValues(post);
    }
    return getRegularPostInitialValues(post);
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
    if (isLongform && typeof post === "object" && "content" in post) {
      const postContent = typeof post.content === "string" ? post.content : "";
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
              class: (await (async () => {
                const embedModule = (await import("@editorjs/embed")) as {
                  default: unknown;
                };
                return embedModule.default as new (config?: {
                  services?: Record<string, boolean>;
                }) => unknown;
              })()) as new (config?: {
                services?: Record<string, boolean>;
              }) => unknown,
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
                        }
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
                      const { handleAsyncError } =
                        await import("~/lib/error-handler.client");
                      handleAsyncError(
                        error,
                        {
                          component: "EditPostModal",
                          action: "uploadImage",
                        },
                        false
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
            // eslint-disable-next-line @typescript-eslint/no-misused-promises -- EditorJS onChange is async but types don't reflect this
            onChange: async (api: EditorJSAPI) => {
              try {
                const outputData = await api.saver.save();
                const markdownContent = convertEditorJSToMarkdown(outputData);
                form.setValue("content", markdownContent);
              } catch (error: unknown) {
                logClientError(
                  error instanceof Error ? error : new Error(String(error)),
                  {
                    component: "useEditPostModal",
                    action: "editorOnChangeSave",
                    message: "Editor save error",
                  },
                  "warning"
                );
              }
            },
          }) as EditorJSInstanceType;

          editorRef.current = editorInstance;
          await editorRef.current.isReady;
          setEditorReady(true);
        } catch (error: unknown) {
          logClientError(
            error instanceof Error ? error : new Error(String(error)),
            {
              component: "useEditPostModal",
              action: "loadEditor",
              message: "Error loading EditorJS",
            }
          );
          editorInitialized.current = false;
        }
      }
    };

    void loadEditor();

    return () => {
      if (editorRef.current) {
        try {
          editorRef.current.destroy();
        } catch (error) {
          logClientError(
            error instanceof Error ? error : new Error(String(error)),
            {
              component: "useEditPostModal",
              action: "cleanup",
              message: "Error during editor cleanup",
            },
            "warning"
          );
        } finally {
          editorRef.current = null;
          editorInitialized.current = false;
          setEditorReady(false);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies are intentionally limited to avoid unnecessary re-renders
  }, [isLongform]);

  // Load initial content into EditorJS for longform posts
  const formContent = form.watch("content");
  useEffect(() => {
    if (!isLongform || !editorReady || !editorRef.current || !formContent)
      return;

    const loadInitialContent = async () => {
      if (!editorRef.current) return;
      try {
        await editorRef.current.isReady;
        const contentString =
          typeof formContent === "string" ? formContent : "";
        const editorJSData = convertMarkdownToEditorJS(contentString);
        await editorRef.current.render(editorJSData);
      } catch (error: unknown) {
        logClientError(
          error instanceof Error ? error : new Error(String(error)),
          {
            component: "useEditPostModal",
            action: "loadInitialContent",
            message: "Error loading initial content into EditorJS",
          },
          "warning"
        );
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
    try {
      const zoned = fromDate(date, userTimezone);
      return formatForDateTimeLocal(zoned, userTimezone);
    } catch {
      // Fallback - try again with error handling
      try {
        const zoned = fromDate(date, "UTC");
        const userZoned = zoned.withTimeZone(userTimezone);
        return formatForDateTimeLocal(userZoned, userTimezone);
      } catch {
        // Final fallback - manual format (should rarely happen)
        const dateInUserTz = new Date(
          date.toLocaleString("en-US", { timeZone: userTimezone })
        );
        const year = dateInUserTz.getFullYear();
        const month = String(dateInUserTz.getMonth() + 1).padStart(2, "0");
        const day = String(dateInUserTz.getDate()).padStart(2, "0");
        const hours = String(dateInUserTz.getHours()).padStart(2, "0");
        const minutes = String(dateInUserTz.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      }
    }
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
        })
      );
      setNewFiles((prev) => [...prev, ...processedFiles]);
    } catch (error: unknown) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: "useEditPostModal",
          action: "handleFileChange",
          message: "Error processing files",
        }
      );
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
    hashtags: string
  ) => {
    form.setValue("hashTagPresetId", presetId ?? undefined);
    form.setValue("useHashtagPresets", !!presetId);
    setSelectedHashtagPresetTags(hashtags);
  };

  // Watch form values for easy access
  const caption = isLongform ? "" : String(form.watch("caption") ?? "");
  const title = isLongform ? String(form.watch("title") ?? "") : "";
  const summary = isLongform ? String(form.watch("summary") ?? "") : "";
  const content = isLongform ? String(form.watch("content") ?? "") : "";
  const image = isLongform ? String(form.watch("image") ?? "") : "";
  const scheduledForStr = form.watch("scheduledFor");
  // Use Temporal for consistency
  const scheduledFor = scheduledForStr
    ? (() => {
        try {
          const zoned = fromISOString(scheduledForStr, "UTC");
          return toDate(zoned);
        } catch {
          // Fallback - try with Date conversion
          try {
            const zoned = fromDate(new Date(scheduledForStr), "UTC");
            return toDate(zoned);
          } catch {
            return new Date(scheduledForStr);
          }
        }
      })()
    : null;
  const selectedQueueType = String(form.watch("queueType") ?? "");
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
  const useHashtagPresets = Boolean(form.watch("useHashtagPresets") ?? false);
  const selectedHashtagPresetId = form.watch("hashTagPresetId") ?? null;
  const manualHashtags = isLongform
    ? ""
    : String(form.watch("manualHashtags") ?? "");

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
      value ? value.toISOString().slice(0, 16) : ""
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
