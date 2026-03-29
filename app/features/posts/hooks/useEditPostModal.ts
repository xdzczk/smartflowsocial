import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

import {
  BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE,
  useBlossomUploadGate,
} from "~/features/upload";
import { resizeImage } from "~/features/upload/image-resize";
import { logClientError } from "~/lib/error-handler.client";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
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

import {
  type PostData,
  type LongFormPostData,
  type UserData,
  type HashTagPreset,
  type QueueType,
  defaultIncludeHashtagsForQueueSelection,
} from "../types";

interface UseEditPostModalProps {
  post: PostData | LongFormPostData;
  user?: UserData;
  hashTagPresets?: HashTagPreset[];
  queueTypes?: QueueType[];
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
  queueTypes = [],
  isLongform,
}: UseEditPostModalProps) {
  const { dateLocale } = useFormattedDate();
  const { mediaUploadBlocked } = useBlossomUploadGate();

  // Get initial values for form
  const getInitialValues = () => {
    if (isLongform && typeof post === "object" && "title" in post) {
      const lf = getLongformInitialValues(post);
      return {
        ...lf,
        includeHashtagsInNoteBody: defaultIncludeHashtagsForQueueSelection(
          lf.queueType,
          queueTypes
        ),
      };
    }
    const regular = getRegularPostInitialValues(post);
    return {
      ...regular,
      includeHashtagsInNoteBody: defaultIncludeHashtagsForQueueSelection(
        regular.queueType,
        queueTypes
      ),
    };
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

  // Longform: Tiptap editor lives in EditLongFormFormFields; ref to flush before submit
  const longformEditorApiRef = useRef<{ flushSync: () => void } | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Load initial content for longform posts into form (editor gets it via initialMarkdown prop)
  useEffect(() => {
    if (isLongform && typeof post === "object" && "content" in post) {
      const postContent = typeof post.content === "string" ? post.content : "";
      if (postContent) {
        form.setValue("content", postContent);
      }
    }
  }, [isLongform, post, form]);

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
          date.toLocaleString(dateLocale, { timeZone: userTimezone })
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
    if (mediaUploadBlocked) {
      e.target.value = "";
      toast.error(BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE);
      return;
    }
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
  const includeHashtagsInNoteBody = form.watch("includeHashtagsInNoteBody");

  useEffect(() => {
    if (isLongform) return;
    form.setValue(
      "includeHashtagsInNoteBody",
      defaultIncludeHashtagsForQueueSelection(selectedQueueType, queueTypes)
    );
  }, [selectedQueueType, queueTypes, isLongform, form]);

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
  const setIncludeHashtagsInNoteBody = (value: boolean) => {
    form.setValue("includeHashtagsInNoteBody", value);
  };
  const setContent = (value: string) => {
    if (isLongform) form.setValue("content", value);
  };

  return {
    // Form instance (exposed for getValues after flushSync in longform)
    form,
    // Longform: ref to flush editor before submit
    longformEditorApiRef,
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
    includeHashtagsInNoteBody,
    // Setter functions (for backward compatibility)
    setCaption,
    setTitle,
    setSummary,
    setImage,
    setScheduledFor,
    setSelectedQueueType,
    setUseHashtagPresets,
    setManualHashtags,
    setIncludeHashtagsInNoteBody,
    setContent,
    // Non-form state
    existingImages,
    newFiles,
    isUploadingImages,
    setIsUploadingImages,
    editorReady,
    setEditorReady,
    // Handlers
    handleFileChange,
    removeExistingImage,
    removeNewFile,
    handleHashtagPresetSelect,
    formatDateTimeForInput,
    mediaUploadBlocked,
  };
}
