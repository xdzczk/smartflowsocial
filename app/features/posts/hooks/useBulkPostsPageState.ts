/**
 * State and handlers for the bulk posts page.
 * Extracted from BulkPostsPage to keep the page component under 400 LOC.
 */

import { useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { type ToastMessage } from "~/components/types";
import type {
  BulkBatchMode,
  BulkComposerStage,
} from "~/features/posts/bulk-composer/types";
import { useLocalDraft } from "~/features/posts/composer";
import {
  type BulkPost,
  type PreparedEvent,
  handleBulkQueueUpdate as handleBulkQueueUpdateHandler,
  handleBulkRecyclableToggle as handleBulkRecyclableToggleHandler,
  handleCaptionChange as handleCaptionChangeHandler,
  handleDateChange as handleDateChangeHandler,
  handleFileChange as handleFileChangeHandler,
  processBulkSelectedFiles,
  handleIsRecyclableChange as handleIsRecyclableChangeHandler,
  handleQueueTypeChange as handleQueueTypeChangeHandler,
  handleRemovePost as handleRemovePostHandler,
  handleScheduleIntervalClick as handleScheduleIntervalClickHandler,
} from "~/features/posts/server";
import type { RepostConditions } from "~/features/posts/types";
import {
  clearAllBulkPendingFiles,
  loadPendingFilesForClient,
  syncBulkPendingFilesFromPosts,
} from "~/features/posts/utils/bulk-pending-files-idb";
import { swapAdjacentBulkPostRowContent } from "~/features/posts/utils/bulk-post-reorder";
import { getFileUrlArrayForDraft } from "~/features/posts/utils/bulk-posts.client";
import { createBulkPostClientId } from "~/features/posts/utils/client-id";
import { BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE } from "~/features/upload/blossom-upload-gate";
import {
  MEDIA_UPLOAD_MAX_IMAGE_BYTES,
  MEDIA_UPLOAD_MAX_VIDEO_BYTES,
} from "~/features/upload/media-upload-limits";
import { useOptionalUser } from "~/lib/remix-utils";
import {
  addMinutes,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";

export interface UseBulkPostsPageStateProps {
  tags: string[];
  queueTypes: Array<{ id: string; name: string }>;
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  mode: string | null;
  groupId: string | null;
  /** When true, row / bulk file pickers are blocked for Blossom (no signer). */
  blossomMediaUploadBlocked?: boolean;
  bulkDraftGroupPosts: Array<{
    id: string;
    caption: string;
    fileUrl: string[];
    queueTypeId: string | null;
    queueType: { name: string } | null;
    scheduledAtUtc: Date | string | null;
    isRecyclable: boolean;
  }>;
}

const BULK_DRAFT_KEY = "bulk-posts-draft";

export function useBulkPostsPageState({
  tags,
  queueTypes,
  hashTagPresets: _hashTagPresets,
  mode: _mode,
  groupId,
  blossomMediaUploadBlocked = false,
  bulkDraftGroupPosts,
}: UseBulkPostsPageStateProps) {
  const [posts, setPosts] = useState<BulkPost[]>([]);
  const [displayedHashtags, setDisplayedHashtags] = useState<string | string[]>(
    tags
  );
  const [_selectedQueueType, setSelectedQueueType] = useState("unassigned");
  const fetcher = useFetcher<{
    success?: boolean;
    fileUrls?: Array<{
      fileUrl: string;
      scheduledFor: string;
      queueType: string;
    }>;
  }>();
  const userOptional = useOptionalUser();
  const user = userOptional ?? null;
  const scheduleIntervals = user?.scheduleInterval
    ? Array.isArray(user.scheduleInterval)
      ? user.scheduleInterval
          .map((s) => (typeof s === "string" ? parseInt(s, 10) : s))
          .filter((n): n is number => !isNaN(n))
      : []
    : undefined;

  const [preparedEvents, setPreparedEvents] = useState<PreparedEvent[]>([]);
  const [bulkComposerStage, setBulkComposerStage] =
    useState<BulkComposerStage>("build");
  const [bulkBatchMode, setBulkBatchMode] = useState<BulkBatchMode>("schedule");
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
    setDisplayedHashtags(tags);
    setSelectedQueueType("unassigned");
    setBulkScheduleRandomWindowMinutes(0);
  }, [bulkBatchMode, tags]);
  const [focusPostIndex, setFocusPostIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({
    current: 0,
    total: 0,
  });
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
  const [uploadProvider, setUploadProvider] = useState<string | null>(null);
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState<
    string | null
  >(null);
  const [selectedHashtags, setSelectedHashtags] = useState("");
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
  const [bulkRepostConditions, setBulkRepostConditions] =
    useState<RepostConditions | null>(null);
  const [bulkDraftPickerOpen, setBulkDraftPickerOpen] = useState(false);
  const [bulkScheduleRandomWindowMinutes, setBulkScheduleRandomWindowMinutes] =
    useState<0 | 5 | 10 | 15>(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    restored: bulkLocalRestored,
    saveSnapshot: saveBulkLocalSnapshot,
    flushSnapshot: flushBulkLocalSnapshot,
    clearSnapshot: clearBulkLocalSnapshot,
  } = useLocalDraft<{
    rows: Array<{
      /** Stable row id so pending File[] can be rehydrated from IndexedDB */
      clientId?: string;
      caption: string;
      queueType: string;
      scheduledFor: string;
      fileUrl?: string | string[];
      isRecyclable: boolean;
    }>;
    savedAt: number;
  }>(BULK_DRAFT_KEY, !!groupId, 2000);

  const postsRef = useRef<BulkPost[]>(posts);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const bulkLocalRestoredAppliedRef = useRef(false);
  useEffect(() => {
    interface Restored {
      rows: Array<{
        clientId?: string;
        caption: string;
        queueType: string;
        scheduledFor: string;
        fileUrl?: string | string[];
        isRecyclable: boolean;
      }>;
    }
    const restored = bulkLocalRestored as Restored | undefined | null;
    if (
      !restored ||
      restored.rows.length === 0 ||
      groupId ||
      bulkLocalRestoredAppliedRef.current
    )
      return;
    bulkLocalRestoredAppliedRef.current = true;

    void (async () => {
      const initialPosts: BulkPost[] = await Promise.all(
        restored.rows.map(async (r) => {
          const clientId =
            typeof r.clientId === "string" && r.clientId.length > 0
              ? r.clientId
              : createBulkPostClientId();
          const loaded = await loadPendingFilesForClient(clientId);
          const files = loaded ?? [];
          return {
            clientId,
            files,
            caption: r.caption,
            queueType: r.queueType,
            scheduledFor: r.scheduledFor,
            isRecyclable: r.isRecyclable,
            fileUrl: r.fileUrl,
          };
        })
      );
      setPosts(initialPosts);
    })();
  }, [bulkLocalRestored, groupId]);

  useEffect(() => {
    if (groupId) return;
    saveBulkLocalSnapshot({
      rows: posts.map((p) => ({
        clientId: p.clientId,
        caption: p.caption,
        queueType: p.queueType,
        scheduledFor: p.scheduledFor,
        fileUrl: p.fileUrl,
        isRecyclable: p.isRecyclable,
      })),
    });
  }, [groupId, posts, saveBulkLocalSnapshot]);

  const idbSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (groupId) return;
    if (idbSyncTimerRef.current) clearTimeout(idbSyncTimerRef.current);
    idbSyncTimerRef.current = setTimeout(() => {
      idbSyncTimerRef.current = null;
      void syncBulkPendingFilesFromPosts(posts);
    }, 2000);
    return () => {
      if (idbSyncTimerRef.current) clearTimeout(idbSyncTimerRef.current);
    };
  }, [groupId, posts]);

  const flushBulkDraftPersist = useCallback(() => {
    if (groupId) return;
    flushBulkLocalSnapshot({
      rows: postsRef.current.map((p) => ({
        clientId: p.clientId,
        caption: p.caption,
        queueType: p.queueType,
        scheduledFor: p.scheduledFor,
        fileUrl: p.fileUrl,
        isRecyclable: p.isRecyclable,
      })),
    });
    void syncBulkPendingFilesFromPosts(postsRef.current);
  }, [groupId, flushBulkLocalSnapshot]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushBulkDraftPersist();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flushBulkDraftPersist]);

  useEffect(() => {
    return () => {
      flushBulkDraftPersist();
    };
  }, [flushBulkDraftPersist]);

  useEffect(() => {
    if (fetcher.state === "submitting") {
      clearBulkLocalSnapshot();
      void clearAllBulkPendingFiles();
    }
  }, [fetcher.state, clearBulkLocalSnapshot]);

  useEffect(() => {
    if (bulkDraftGroupPosts.length > 0) {
      const initialPosts: BulkPost[] = bulkDraftGroupPosts.map((p) => {
        const scheduledAt =
          p.scheduledAtUtc instanceof Date
            ? p.scheduledAtUtc
            : typeof p.scheduledAtUtc === "string"
              ? new Date(p.scheduledAtUtc)
              : null;
        return {
          clientId: createBulkPostClientId(),
          files: [],
          caption: p.caption,
          queueType: p.queueType?.name ?? "unassigned",
          scheduledFor: scheduledAt
            ? String(Math.floor(scheduledAt.getTime() / 1000))
            : "",
          isRecyclable: p.isRecyclable,
          fileUrl: Array.isArray(p.fileUrl) ? p.fileUrl : p.fileUrl,
        };
      });
      setPosts(initialPosts);
    }
    // Only run when opening a group (bulkDraftGroupPosts from loader).
  }, [bulkDraftGroupPosts.length]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: prefill once when group opens

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user-upload-provider");
        const data: unknown = await res.json();
        const provider =
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          "provider" in data &&
          typeof (data as { provider?: unknown }).provider === "string"
            ? (data as { provider: string }).provider
            : null;
        setUploadProvider(provider);
      } catch (err: unknown) {
        const { handleErrorSafely } =
          await import("~/lib/error-handler.client");
        handleErrorSafely(err, {
          component: "BulkPosts",
          action: "fetchUploadProvider",
        });
      }
    })();
  }, []);

  useEffect(() => {
    const bulkScheduled = searchParams.get("bulkScheduled");
    const count = searchParams.get("count");
    const firstPostId = searchParams.get("firstPostId");
    const lastScheduledAt = searchParams.get("lastScheduledAt");
    const queueSummaryRaw = searchParams.get("queueSummary");
    if (
      bulkScheduled === "true" &&
      firstPostId &&
      !modalPostId &&
      !showPublishModal
    ) {
      const postCount = count ? parseInt(count, 10) : null;
      setBulkPostCount(postCount);
      setBulkSuccessLastAt(lastScheduledAt ?? null);
      try {
        setBulkSuccessQueueSummary(
          queueSummaryRaw
            ? (JSON.parse(queueSummaryRaw) as Record<string, number>)
            : null
        );
      } catch {
        setBulkSuccessQueueSummary(null);
      }
      setTimeout(() => setModalPostId(firstPostId), 0);
      void (async () => {
        try {
          const res = await fetch(`/api/posts/${firstPostId}`);
          if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
          const data = (await res.json()) as {
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
          if (data.post || data.longFormPost) {
            setTimeout(() => {
              setModalPost(data.post ?? null);
              setModalLongFormPost(data.longFormPost ?? null);
              setShowPublishModal(true);
            }, 0);
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete("bulkScheduled");
            newSearchParams.delete("count");
            newSearchParams.delete("firstPostId");
            newSearchParams.delete("lastScheduledAt");
            newSearchParams.delete("queueSummary");
            const nextQuery = newSearchParams.toString();
            const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
            // Avoid route revalidation/suspense while showing success modal.
            window.history.replaceState(window.history.state, "", nextUrl);
          }
        } catch {
          setTimeout(() => setModalPostId(null), 0);
        }
      })();
    }
  }, [searchParams, modalPostId, showPublishModal, setSearchParams]);

  const state = {
    posts,
    setPosts,
    displayedHashtags,
    setDisplayedHashtags,
    setSelectedQueueType,
    preparedEvents,
    setPreparedEvents,
    bulkComposerStage,
    setBulkComposerStage,
    bulkBatchMode,
    setBulkBatchMode,
    focusPostIndex,
    setFocusPostIndex,
    isProcessing,
    setIsProcessing,
    processingProgress,
    setProcessingProgress,
    preparationProgress,
    setPreparationProgress,
    firstItemTimeManuallyChanged,
    setFirstItemTimeManuallyChanged,
    isPreviewSubmitting,
    setIsPreviewSubmitting,
    toast,
    setToast,
    selectedMedia,
    setSelectedMedia,
    isMediaModalOpen,
    setIsMediaModalOpen,
    uploadProvider,
    useHashtagPresets,
    setUseHashtagPresets,
    selectedHashtagPresetId,
    setSelectedHashtagPresetId,
    selectedHashtags,
    setSelectedHashtags,
    showPublishModal,
    setShowPublishModal,
    modalPostId,
    setModalPostId,
    bulkSuccessLastAt,
    setBulkSuccessLastAt,
    bulkSuccessQueueSummary,
    setBulkSuccessQueueSummary,
    modalPost,
    setModalPost,
    modalLongFormPost,
    setModalLongFormPost,
    bulkPostCount,
    setBulkPostCount,
    bulkRepostConditions,
    setBulkRepostConditions,
    bulkDraftPickerOpen,
    setBulkDraftPickerOpen,
    bulkScheduleRandomWindowMinutes,
    setBulkScheduleRandomWindowMinutes,
    scheduleIntervals,
    user,
    fetcher,
    isSubmitting: fetcher.state !== "idle",
    navigate,
    setSearchParams,
  };

  const userDeps = user
    ? {
        id: user.id,
        timezone: user.timezone ?? undefined,
        scheduleInterval: scheduleIntervals,
      }
    : null;

  const bulkFileUploadDeps = {
    posts,
    setPosts,
    user: userDeps,
    scheduleIntervals,
    setIsProcessing,
    setProcessingProgress,
    setFirstItemTimeManuallyChanged,
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (blossomMediaUploadBlocked) {
      e.target.value = "";
      setToast({
        type: "error",
        message: BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE,
      });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    void handleFileChangeHandler(e, bulkFileUploadDeps);
  };

  const handleBulkFilesDropped = (files: File[]) => {
    if (blossomMediaUploadBlocked) {
      setToast({
        type: "error",
        message: BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE,
      });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    void processBulkSelectedFiles(files, bulkFileUploadDeps);
  };

  const handleCaptionChange = (index: number, value: string) => {
    handleCaptionChangeHandler(index, value, posts, setPosts);
  };

  const handleDateChange = (index: number, value: string) => {
    handleDateChangeHandler(
      index,
      value,
      posts,
      setPosts,
      setFirstItemTimeManuallyChanged
    );
    if (index !== 0 || !value || value.trim() === "") return;
    const firstQueueType = posts[0]?.queueType;
    if (!firstQueueType || firstQueueType === "unassigned") return;
    const updatedPosts = posts.map((post, postIndex) =>
      postIndex === 0 ? { ...post, scheduledFor: value } : post
    );
    void handleBulkQueueUpdateHandler(firstQueueType, {
      posts: updatedPosts,
      setPosts,
      queueTypes,
      tags,
      user: userDeps,
      setDisplayedHashtags,
      setSelectedQueueType,
      firstItemTimeManuallyChanged: true,
    });
  };

  const handleIsRecyclableChange = (index: number, checked: boolean) => {
    handleIsRecyclableChangeHandler(index, checked, posts, setPosts);
  };

  const handleMediaClick = (mediaSrc: string) => {
    setSelectedMedia(mediaSrc);
    setIsMediaModalOpen(true);
  };

  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setSelectedMedia(null);
  };

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string
  ) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtags(hashtags);
  };

  const handleBulkRecyclableToggle = () => {
    handleBulkRecyclableToggleHandler(posts, setPosts);
  };

  const handleRepostSchedulesChange = (
    index: number,
    list: Array<{ value: number; unit: "hours" | "minutes" }>
  ) => {
    setPosts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, repostSchedules: list } : p))
    );
  };

  const handleQuoteSchedulesChange = (
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
  };

  const handleRepostAll = (delay: {
    value: number;
    unit: "hours" | "minutes";
  }) => {
    setPosts((prev) =>
      prev.map((p) => ({
        ...p,
        repostSchedules: [{ value: delay.value, unit: delay.unit }],
      }))
    );
  };

  const handleIncludeHashtagsInNoteBodyChange = (
    index: number,
    checked: boolean
  ) => {
    setPosts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, includeHashtagsInNoteBody: checked } : p
      )
    );
  };

  const handleQueueTypeChange = async (index: number, value: string) => {
    await handleQueueTypeChangeHandler(index, value, {
      posts,
      setPosts,
      queueTypes,
      tags,
      user: userDeps,
      setDisplayedHashtags,
      setSelectedQueueType,
    });
  };

  const handleRemovePost = (index: number) => {
    handleRemovePostHandler(index, posts, setPosts);
  };

  const handleScheduleIntervalClick = (interval: number) => {
    handleScheduleIntervalClickHandler(
      interval,
      posts,
      setPosts,
      firstItemTimeManuallyChanged
    );
  };

  const handleBulkQueueUpdate = async (queueType: string) => {
    const count = posts.length;
    await handleBulkQueueUpdateHandler(queueType, {
      posts,
      setPosts,
      queueTypes,
      tags,
      user: userDeps,
      setDisplayedHashtags,
      setSelectedQueueType,
      firstItemTimeManuallyChanged,
    });
    setToast({
      type: "success",
      message: `Applied ${queueType} to ${count} post${count !== 1 ? "s" : ""}`,
    });
    setTimeout(() => setToast(null), 3000);
  };

  const addEmptyRows = (count: number) => {
    const userTimezone = user?.timezone ?? "UTC";
    const now = nowInTimezone(userTimezone);
    const newPosts: BulkPost[] = Array.from({ length: count }, (_, i) => ({
      clientId: createBulkPostClientId(),
      files: [],
      caption: "",
      queueType: "unassigned",
      scheduledFor:
        posts.length === 0 && i === 0
          ? formatForDateTimeLocal(addMinutes(now, 15), userTimezone)
          : "",
      isRecyclable: false,
      includeHashtagsInNoteBody: true,
    }));
    setPosts((prev) => [...prev, ...newPosts]);
  };

  const handleRowFileSelect = async (index: number, file: File | null) => {
    if (!file) return;
    if (blossomMediaUploadBlocked) {
      setToast({
        type: "error",
        message: BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE,
      });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    const { isVideoFile } = await import("~/utils/media-helpers");
    const MAX_IMAGE = MEDIA_UPLOAD_MAX_IMAGE_BYTES;
    const MAX_VIDEO = MEDIA_UPLOAD_MAX_VIDEO_BYTES;
    const isVideo = isVideoFile(file);
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
  };

  const handleRowFileRemove = (index: number, mediaIndex: number) => {
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
  };

  const duplicatePost = (index: number) => {
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
  };

  const handleReorderBulkPost = (index: number, direction: "up" | "down") => {
    setPosts((prev) => {
      const swapped = swapAdjacentBulkPostRowContent(prev, index, direction);
      if (swapped) {
        queueMicrotask(() => {
          setPreparedEvents([]);
        });
        return swapped;
      }
      return prev;
    });
  };

  const handleSaveDraftFromTable = (groupIdParam: string | null) => {
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
    if (groupIdParam) {
      formData.append("groupId", groupIdParam);
    }
    const currentUrl = new URL(window.location.href);
    const actionUrl = `/dashboard/bulkposts${currentUrl.search}`;
    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
      action: actionUrl,
    });
  };

  const handlers = {
    handleFileChange,
    handleCaptionChange,
    handleDateChange,
    handleIsRecyclableChange,
    handleMediaClick,
    handleCloseMediaModal,
    handleHashtagPresetSelect,
    handleBulkRecyclableToggle,
    handleRepostSchedulesChange,
    handleQuoteSchedulesChange,
    handleRepostAll,
    handleQueueTypeChange,
    handleRemovePost,
    handleScheduleIntervalClick,
    handleBulkQueueUpdate,
    addEmptyRows,
    handleRowFileSelect,
    handleRowFileRemove,
    handleSaveDraftFromTable,
    handleBulkFilesDropped,
    handleIncludeHashtagsInNoteBodyChange,
    duplicatePost,
    handleReorderBulkPost,
  };

  return { state, handlers };
}
