/**
 * State and handlers for the bulk composer modal.
 * Extracted from BulkComposerModal to keep the modal shell under 350 LOC.
 */

import { useFetcher } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type ToastMessage } from "~/components/types";
import type {
  BulkBatchMode,
  BulkComposerStage,
} from "~/features/posts/bulk-composer/types";
import { bulkPostMissingRequiredCaption } from "~/features/posts/components/bulk-composer/bulk-composer-post-card-utils";
import {
  type BulkPost,
  type PreparedEvent,
  type QueueType,
  handleBulkQueueUpdate as handleBulkQueueUpdateHandler,
  handleBulkRecyclableToggle as handleBulkRecyclableToggleHandler,
  handleCaptionChange as handleCaptionChangeHandler,
  handleDateChange as handleDateChangeHandler,
  handleIsRecyclableChange as handleIsRecyclableChangeHandler,
  handleQueueTypeChange as handleQueueTypeChangeHandler,
  handleRemovePost as handleRemovePostHandler,
  handleScheduleIntervalClick as handleScheduleIntervalClickHandler,
} from "~/features/posts/server";
import type { RepostConditions } from "~/features/posts/types";
import { useBulkPostEvents } from "~/features/posts/useBulkPostEvents";
import { getFileUrlArrayForDraft } from "~/features/posts/utils/bulk-posts.client";
import { createBulkPostClientId } from "~/features/posts/utils/client-id";
import {
  BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE,
  useBlossomUploadGate,
} from "~/features/upload";
import {
  MEDIA_UPLOAD_MAX_IMAGE_BYTES,
  MEDIA_UPLOAD_MAX_VIDEO_BYTES,
} from "~/features/upload/media-upload-limits";
import type { User } from "~/features/user";
import { isVideoFile } from "~/utils/media-helpers";

import type {
  BulkComposerMode,
  BulkComposerUser,
} from "../utils/bulk-composer-modal.utils";

export interface UseBulkComposerModalStateProps {
  open: boolean;
  initialPosts: BulkPost[];
  mode: BulkComposerMode;
  user: BulkComposerUser | null;
  queueTypesProp?: QueueType[];
  hashTagPresetsProp?: Array<{ id: string; name: string; tags: string }>;
  tagsProp?: string[];
  onSuccess?: () => void;
  onClose: () => void;
}

export function useBulkComposerModalState({
  open,
  initialPosts,
  mode,
  user,
  queueTypesProp,
  hashTagPresetsProp,
  tagsProp,
  onSuccess,
  onClose,
}: UseBulkComposerModalStateProps) {
  const [posts, setPosts] = useState<BulkPost[]>([]);
  const [displayedHashtags, setDisplayedHashtags] = useState<string | string[]>(
    Array.isArray(tagsProp) ? tagsProp.join(" ") : ""
  );
  const [preparedEvents, setPreparedEvents] = useState<PreparedEvent[]>([]);
  const [bulkComposerStage, setBulkComposerStage] =
    useState<BulkComposerStage>("build");
  const [bulkBatchMode, setBulkBatchMode] = useState<BulkBatchMode>("schedule");
  const [focusPostIndex, setFocusPostIndex] = useState<number | null>(null);
  const [processingProgress] = useState({
    current: 0,
    total: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [repostConditions, setRepostConditions] =
    useState<RepostConditions | null>(null);
  const [preparationProgress, setPreparationProgress] = useState({
    current: 0,
    total: 0,
    stage: "",
  });
  const [firstItemTimeManuallyChanged, setFirstItemTimeManuallyChanged] =
    useState(false);
  const [isPreviewSubmitting, setIsPreviewSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState<
    string | null
  >(null);
  const [selectedHashtags, setSelectedHashtags] = useState("");
  const [bulkScheduleRandomWindowMinutes, setBulkScheduleRandomWindowMinutes] =
    useState<0 | 5 | 10 | 15>(0);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [bulkSuccessLastAt, setBulkSuccessLastAt] = useState<string | null>(
    null
  );
  const [bulkSuccessQueueSummary, setBulkSuccessQueueSummary] = useState<Record<
    string,
    number
  > | null>(null);
  const [modalPost, setModalPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | null;
  } | null>(null);
  const [modalLongFormPost, setModalLongFormPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | null;
  } | null>(null);
  const [bulkPostCount, setBulkPostCount] = useState<number | null>(null);

  const { mediaUploadBlocked: blossomMediaUploadBlocked } =
    useBlossomUploadGate();

  const contextFetcher = useFetcher<{
    tags?: string[];
    queueTypes?: QueueType[];
    hashTagPresets?: Array<{ id: string; name: string; tags: string }>;
  }>();
  const submitFetcher = useFetcher<{
    success?: boolean;
    fileUrls?: Array<{
      fileUrl: string;
      scheduledFor: string;
      queueType: string;
    }>;
    bulkScheduled?: boolean;
    count?: number;
    firstPostId?: string;
    lastScheduledAt?: string;
    queueSummary?: Record<string, number>;
  }>();

  const scheduleIntervals = useMemo(() => {
    const raw = user?.scheduleInterval;
    if (!raw) return;
    return Array.isArray(raw)
      ? raw
          .map((s) => (typeof s === "string" ? parseInt(s, 10) : s))
          .filter((n): n is number => !isNaN(n))
      : undefined;
  }, [user?.scheduleInterval]);

  const queueTypes = useMemo(
    () => queueTypesProp ?? contextFetcher.data?.queueTypes ?? [],
    [queueTypesProp, contextFetcher.data?.queueTypes]
  );
  const hashTagPresets =
    hashTagPresetsProp ?? contextFetcher.data?.hashTagPresets ?? [];
  const defaultPreset = hashTagPresets.find((p) => p.name === "Default");
  const tags = useMemo(() => {
    const fromProp = tagsProp ?? contextFetcher.data?.tags;
    if (fromProp && Array.isArray(fromProp)) return fromProp;
    const presetTags = defaultPreset?.tags;
    return presetTags != null && presetTags !== ""
      ? String(presetTags).split(/\s+/).filter(Boolean).sort()
      : [];
  }, [tagsProp, contextFetcher.data?.tags, defaultPreset?.tags]);

  const prevBulkBatchModeRef = useRef<BulkBatchMode>(bulkBatchMode);
  useEffect(() => {
    const prev = prevBulkBatchModeRef.current;
    prevBulkBatchModeRef.current = bulkBatchMode;
    if (prev !== "queue" || bulkBatchMode !== "schedule") return;
    setPosts((prevPosts) =>
      prevPosts.map((p) => ({
        ...p,
        queueType: "unassigned",
        scheduledFor: "",
      }))
    );
    setDisplayedHashtags(Array.isArray(tags) ? tags.join(" ") : "");
    setBulkScheduleRandomWindowMinutes(0);
  }, [bulkBatchMode, tags]);

  const isSubmitting = submitFetcher.state !== "idle";

  const submitAction =
    mode !== "reschedule"
      ? `/dashboard/bulkposts?mode=${mode}`
      : "/dashboard/bulkposts";
  const extraFormData = useMemo(() => ({ _inModal: "1" }), []);

  const { prepareEvents, startPrepareFlow } = useBulkPostEvents({
    posts,
    fetcher: submitFetcher,
    user: user as User | null,
    tags: Array.isArray(tags) ? tags : [],
    useHashtagPresets,
    selectedHashtags,
    setToast,
    setPreparedEvents,
    setBulkComposerStage,
    setIsPreviewSubmitting,
    setIsProcessing,
    setPreparationProgress,
    extraFormData,
    submitAction,
    scheduleRandomWindowMinutes: bulkScheduleRandomWindowMinutes,
  });

  const validationResult = useMemo(() => {
    const errors: string[] = [];
    const byPost: Record<number, string[]> = {};
    posts.forEach((post, index) => {
      const rowErrors: string[] = [];
      const scheduledFor = post.scheduledFor || "";
      if (bulkPostMissingRequiredCaption(post)) {
        rowErrors.push("Caption is required when there is no media");
        errors.push(
          `Post ${index + 1}: Caption is required when there is no media`
        );
      }
      if (!scheduledFor.trim()) {
        rowErrors.push("Schedule time is required");
        errors.push(`Post ${index + 1}: Schedule time is required`);
      }
      byPost[index] = rowErrors;
    });
    return {
      isValid: errors.length === 0,
      errors,
      byPost,
    };
  }, [posts]);

  const previewData = useMemo(() => {
    const data = new Map<
      number,
      Array<{ url: string; isVideo: boolean; file: File }>
    >();
    posts.forEach((post, index) => {
      const files = post.files;
      if (files.length > 0) {
        data.set(
          index,
          files.map((file) => {
            const url = URL.createObjectURL(file);
            const isVideo = isVideoFile(file);
            return { url, isVideo, file };
          })
        );
      }
    });
    return data;
  }, [posts]);

  useEffect(() => {
    return () => {
      previewData.forEach((arr) => {
        arr.forEach((item) => {
          if (typeof item.url === "string") {
            URL.revokeObjectURL(item.url);
          }
        });
      });
    };
  }, [previewData]);

  useEffect(() => {
    if (!open) return;
    setPosts(initialPosts.length > 0 ? initialPosts : []);
    setBulkComposerStage("build");
    setPreparedEvents([]);
    setToast(null);
    setShowPublishModal(false);
    setModalPostId(null);
    setModalPost(null);
    setModalLongFormPost(null);
    setBulkPostCount(null);
    setBulkSuccessLastAt(null);
    setBulkSuccessQueueSummary(null);
    if (
      !queueTypesProp &&
      !hashTagPresetsProp &&
      contextFetcher.state === "idle" &&
      !contextFetcher.data
    ) {
      const query = mode === "reschedule" ? "" : `?mode=${mode}`;
      contextFetcher.load(`/dashboard/bulkposts${query}`);
    }
  }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps -- only reset when open/mode change

  const initialPostsAppliedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initialPostsAppliedRef.current = false;
      return;
    }
    if (initialPosts.length > 0 && !initialPostsAppliedRef.current) {
      initialPostsAppliedRef.current = true;
      setPosts(initialPosts);
    }
  }, [open, initialPosts]);

  useEffect(() => {
    const data = submitFetcher.data;
    if (
      submitFetcher.state !== "idle" ||
      !data ||
      typeof data !== "object" ||
      !("bulkScheduled" in data) ||
      data.bulkScheduled !== true
    ) {
      return;
    }
    const firstPostId =
      "firstPostId" in data && typeof data.firstPostId === "string"
        ? data.firstPostId
        : null;
    if (!firstPostId) return;
    setBulkPostCount(
      "count" in data && typeof data.count === "number" ? data.count : null
    );
    setBulkSuccessLastAt(
      "lastScheduledAt" in data && typeof data.lastScheduledAt === "string"
        ? data.lastScheduledAt
        : null
    );
    setBulkSuccessQueueSummary(
      "queueSummary" in data &&
        data.queueSummary &&
        typeof data.queueSummary === "object"
        ? (data.queueSummary as Record<string, number>)
        : null
    );
    setModalPostId(firstPostId);
    void (async () => {
      try {
        const res = await fetch(`/api/posts/${firstPostId}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          post?: {
            id: string;
            publishAttemptId: string | null;
            currentState?: string | null;
            scheduledAtUtc?: string | null;
          };
          longFormPost?: {
            id: string;
            publishAttemptId: string | null;
            currentState?: string | null;
            scheduledAtUtc?: string | null;
          };
        };
        if (json.post || json.longFormPost) {
          setModalPost(json.post ?? null);
          setModalLongFormPost(json.longFormPost ?? null);
          setShowPublishModal(true);
        }
      } catch {
        setShowPublishModal(true);
      }
    })();
  }, [submitFetcher.state, submitFetcher.data]);

  const handleCaptionChange = useCallback(
    (index: number, value: string) => {
      handleCaptionChangeHandler(index, value, posts, setPosts);
    },
    [posts]
  );

  const handleDateChange = useCallback(
    (index: number, value: string) => {
      handleDateChangeHandler(
        index,
        value,
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged
      );
      if (index !== 0 || !value || value.trim() === "") {
        return;
      }
      const firstQueueType = posts[0]?.queueType;
      if (!firstQueueType || firstQueueType === "unassigned") {
        return;
      }
      const updatedPosts = posts.map((post, postIndex) =>
        postIndex === 0 ? { ...post, scheduledFor: value } : post
      );
      const userDeps = user
        ? {
            id: user.id,
            timezone: user.timezone ?? undefined,
            scheduleInterval: scheduleIntervals,
          }
        : null;
      void handleBulkQueueUpdateHandler(firstQueueType, {
        posts: updatedPosts,
        setPosts,
        queueTypes,
        tags: Array.isArray(tags) ? tags : [],
        user: userDeps,
        setDisplayedHashtags,
        setSelectedQueueType: () => {},
        firstItemTimeManuallyChanged: true,
      });
    },
    [posts, queueTypes, scheduleIntervals, tags, user]
  );

  const handleIsRecyclableChange = useCallback(
    (index: number, checked: boolean) => {
      handleIsRecyclableChangeHandler(index, checked, posts, setPosts);
    },
    [posts]
  );

  const handleMediaClick = useCallback((mediaSrc: string) => {
    setSelectedMedia(mediaSrc);
    setIsMediaModalOpen(true);
  }, []);

  const handleCloseMediaModal = useCallback(() => {
    setIsMediaModalOpen(false);
    setSelectedMedia(null);
  }, []);

  const handleHashtagPresetSelect = useCallback(
    (presetId: string | null, hashtags: string) => {
      setSelectedHashtagPresetId(presetId);
      setSelectedHashtags(hashtags);
    },
    []
  );

  const handleBulkRecyclableToggle = useCallback(() => {
    handleBulkRecyclableToggleHandler(posts, setPosts);
  }, [posts]);

  const handleRemovePost = useCallback(
    (index: number) => {
      handleRemovePostHandler(index, posts, setPosts);
    },
    [posts]
  );

  const handleScheduleIntervalClick = useCallback(
    (interval: number) => {
      handleScheduleIntervalClickHandler(
        interval,
        posts,
        setPosts,
        firstItemTimeManuallyChanged
      );
    },
    [posts, firstItemTimeManuallyChanged]
  );

  const handleBulkQueueUpdate = useCallback(
    async (queueType: string) => {
      const userDeps = user
        ? {
            id: user.id,
            timezone: user.timezone ?? undefined,
            scheduleInterval: scheduleIntervals,
          }
        : null;
      await handleBulkQueueUpdateHandler(queueType, {
        posts,
        setPosts,
        queueTypes,
        tags: Array.isArray(tags) ? tags : [],
        user: userDeps,
        setDisplayedHashtags,
        setSelectedQueueType: () => {},
        firstItemTimeManuallyChanged,
      });
    },
    [
      posts,
      user,
      queueTypes,
      tags,
      firstItemTimeManuallyChanged,
      scheduleIntervals,
    ]
  );

  const handleQueueTypeChange = useCallback(
    async (index: number, value: string) => {
      const userDeps = user
        ? {
            id: user.id,
            timezone: user.timezone ?? undefined,
            scheduleInterval: scheduleIntervals,
          }
        : null;
      await handleQueueTypeChangeHandler(index, value, {
        posts,
        setPosts,
        queueTypes,
        tags: Array.isArray(tags) ? tags : [],
        user: userDeps,
        setDisplayedHashtags,
        setSelectedQueueType: () => {},
      });
    },
    [posts, user, queueTypes, tags, scheduleIntervals]
  );

  const handleRowFileSelect = useCallback(
    async (index: number, file: File | null) => {
      if (!file) return;
      if (blossomMediaUploadBlocked) {
        setToast({
          type: "error",
          message: BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE,
        });
        setTimeout(() => setToast(null), 5000);
        return;
      }
      const { isVideoFile: isVideoFileFn } =
        await import("~/utils/media-helpers");
      const MAX_IMAGE = MEDIA_UPLOAD_MAX_IMAGE_BYTES;
      const MAX_VIDEO = MEDIA_UPLOAD_MAX_VIDEO_BYTES;
      const isVideo = isVideoFileFn(file);
      if (isVideo && file.size > MAX_VIDEO) {
        alert("Video exceeds 100MB limit.");
        return;
      }
      if (!isVideo && file.size > MAX_IMAGE) {
        alert("Image exceeds 10MB limit.");
        return;
      }
      let processed: File = file;
      if (!isVideo) {
        const { resizeImage } = await import("~/features/upload/image-resize");
        processed = await resizeImage(file);
      }
      setPosts((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, files: [...p.files, processed] } : p
        )
      );
    },
    [blossomMediaUploadBlocked]
  );

  const handleIncludeHashtagsInNoteBodyChange = useCallback(
    (index: number, checked: boolean) => {
      setPosts((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, includeHashtagsInNoteBody: checked } : p
        )
      );
    },
    []
  );

  const handleRowFileRemove = useCallback(
    (index: number, mediaIndex: number) => {
      setPosts((prev) =>
        prev.map((p, i) => {
          if (i !== index) return p;
          const files = p.files;
          const fileUrlArr = Array.isArray(p.fileUrl)
            ? p.fileUrl
            : typeof p.fileUrl === "string" && p.fileUrl
              ? [p.fileUrl]
              : [];
          if (mediaIndex < files.length) {
            return { ...p, files: files.filter((_, j) => j !== mediaIndex) };
          }
          const urlIndex = mediaIndex - files.length;
          if (urlIndex >= 0 && urlIndex < fileUrlArr.length) {
            const next = fileUrlArr.filter((_, j) => j !== urlIndex);
            return { ...p, fileUrl: next.length > 0 ? next : undefined };
          }
          return p;
        })
      );
    },
    []
  );

  const duplicatePost = useCallback(
    (index: number) => {
      const p = posts[index];
      if (!p) return;
      const copy: BulkPost = {
        ...p,
        clientId: createBulkPostClientId(),
        files: [...p.files],
      };
      setPosts((prev) => {
        const next = [...prev];
        next.splice(index + 1, 0, copy);
        return next;
      });
    },
    [posts]
  );

  const handleRepostSchedulesChange = useCallback(
    (
      index: number,
      list: Array<{ value: number; unit: "hours" | "minutes" }>
    ) => {
      setPosts((prev) =>
        prev.map((p, i) => (i === index ? { ...p, repostSchedules: list } : p))
      );
    },
    []
  );

  const handleQuoteSchedulesChange = useCallback(
    (
      index: number,
      list: Array<{
        value: number;
        unit: "hours" | "minutes";
        caption?: string;
      }>
    ) => {
      setPosts((prev) =>
        prev.map((p, i) => (i === index ? { ...p, quoteSchedules: list } : p))
      );
    },
    []
  );

  const handleRepostAll = useCallback(
    (delay: { value: number; unit: "hours" | "minutes" }) => {
      setPosts((prev) =>
        prev.map((p) => ({
          ...p,
          repostSchedules: [{ value: delay.value, unit: delay.unit }],
        }))
      );
    },
    []
  );

  const handleSaveBulkDraft = useCallback(() => {
    if (posts.length === 0) return;
    const formData = new FormData();
    posts.forEach((p) => {
      formData.append("fileUrl", JSON.stringify(getFileUrlArrayForDraft(p)));
      formData.append("caption", JSON.stringify(p.caption));
      formData.append("queueType", p.queueType);
      formData.append("scheduledFor", p.scheduledFor);
      formData.append("isRecyclable", p.isRecyclable ? "true" : "false");
      formData.append("originalPostId", p.originalPostId ?? "");
    });
    formData.append("_action", "save_as_draft");
    Object.entries(extraFormData).forEach(([k, v]) => formData.append(k, v));
    submitFetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
      action: submitAction,
    });
  }, [posts, submitFetcher, submitAction, extraFormData]);

  const handleSuccessClose = useCallback(() => {
    setShowPublishModal(false);
    setModalPostId(null);
    setModalPost(null);
    setModalLongFormPost(null);
    setBulkPostCount(null);
    setBulkSuccessLastAt(null);
    setBulkSuccessQueueSummary(null);
    setPosts([]);
    setPreparedEvents([]);
    setBulkComposerStage("build");
    onSuccess?.();
    onClose();
  }, [onSuccess, onClose]);

  const isLoadingContext =
    !queueTypesProp &&
    !hashTagPresetsProp &&
    (contextFetcher.state === "loading" ||
      contextFetcher.state === "submitting");

  return {
    state: {
      posts,
      displayedHashtags,
      preparedEvents,
      bulkComposerStage,
      setBulkComposerStage,
      bulkBatchMode,
      setBulkBatchMode,
      focusPostIndex,
      setFocusPostIndex,
      processingProgress,
      isProcessing,
      repostConditions,
      setRepostConditions,
      preparationProgress,
      isPreviewSubmitting,
      toast,
      setToast,
      selectedMedia,
      isMediaModalOpen,
      useHashtagPresets,
      selectedHashtagPresetId,
      setPosts,
      setUseHashtagPresets,
      showPublishModal,
      modalPostId,
      bulkSuccessLastAt,
      bulkSuccessQueueSummary,
      modalPost,
      modalLongFormPost,
      bulkPostCount,
      queueTypes,
      hashTagPresets,
      scheduleIntervals,
      tags,
      isSubmitting,
      submitAction,
      extraFormData,
      validationResult,
      previewData,
      isLoadingContext,
      bulkScheduleRandomWindowMinutes,
      setBulkScheduleRandomWindowMinutes,
      blossomMediaUploadBlocked,
    },
    handlers: {
      prepareEvents,
      startPrepareFlow,
      duplicatePost,
      handleRepostSchedulesChange,
      handleQuoteSchedulesChange,
      handleRepostAll,
      handleCaptionChange,
      handleDateChange,
      handleIsRecyclableChange,
      handleMediaClick,
      handleCloseMediaModal,
      handleHashtagPresetSelect,
      handleBulkRecyclableToggle,
      handleRemovePost,
      handleScheduleIntervalClick,
      handleBulkQueueUpdate,
      handleQueueTypeChange,
      handleIncludeHashtagsInNoteBodyChange,
      handleRowFileSelect,
      handleRowFileRemove,
      handleSuccessClose,
      handleSaveBulkDraft,
    },
    submitFetcher,
    contextFetcher,
  };
}
