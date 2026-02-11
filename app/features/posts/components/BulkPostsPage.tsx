import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import { Hash, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { type ToastMessage } from "~/components/types";
import { Button } from "~/components/ui/button";
import MediaModal from "~/components/ui/MediaModal";
import Toast from "~/components/ui/Toast";
import { useLocalDraft } from "~/features/posts/hooks/useComposerLocalDraft";
import {
  type BulkPost,
  type PreparedEvent,
  type QueueType,
  handleBulkQueueUpdate as handleBulkQueueUpdateHandler,
  handleBulkRecyclableToggle as handleBulkRecyclableToggleHandler,
  handleCaptionChange as handleCaptionChangeHandler,
  handleDateChange as handleDateChangeHandler,
  handleFileChange as handleFileChangeHandler,
  handleIsRecyclableChange as handleIsRecyclableChangeHandler,
  handleQueueTypeChange as handleQueueTypeChangeHandler,
  handleRemovePost as handleRemovePostHandler,
  handleScheduleIntervalClick as handleScheduleIntervalClickHandler,
} from "~/features/posts/server";
import {
  BulkPostsActionButtons,
  BulkPostsSchedulingPanel,
  BulkPostsTable,
  BulkPostsUploadArea,
  DraftPickerModal,
  PostConfirmation,
  PublishResultModal,
} from "~/features/posts/ui";
import { useBulkPostEvents } from "~/features/posts/useBulkPostEvents";
import { useBulkPostsState } from "~/features/posts/useBulkPostsState";
import { createBulkPostClientId } from "~/features/posts/utils/client-id";
import { getPostTypeFromPost } from "~/features/posts/utils/publish-result.utils";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { useOptionalUser } from "~/lib/remix-utils";
import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";
import { isVideoFile } from "~/utils/media-helpers";

function extractLoaderData(data: unknown): {
  tags: string[];
  queueTypes: QueueType[];
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  mode: string | null;
  groupId: string | null;
  bulkDraftGroupPosts: Array<{
    id: string;
    caption: string;
    fileUrl: string[];
    queueTypeId: string | null;
    queueType: { name: string } | null;
    scheduledAtUtc: Date | string | null;
    isRecyclable: boolean;
  }>;
} {
  const tags =
    data &&
    typeof data === "object" &&
    "tags" in data &&
    Array.isArray(data.tags)
      ? data.tags
      : [];
  const queueTypes =
    data &&
    typeof data === "object" &&
    "queueTypes" in data &&
    Array.isArray(data.queueTypes)
      ? data.queueTypes
      : [];
  const hashTagPresets =
    data &&
    typeof data === "object" &&
    "hashTagPresets" in data &&
    Array.isArray(data.hashTagPresets)
      ? data.hashTagPresets
      : [];
  const mode =
    data && typeof data === "object" && "mode" in data
      ? (data as { mode?: unknown }).mode
      : null;
  const groupId =
    data && typeof data === "object" && "groupId" in data
      ? (data as { groupId?: unknown }).groupId
      : null;
  const bulkDraftGroupPosts =
    data &&
    typeof data === "object" &&
    "bulkDraftGroupPosts" in data &&
    Array.isArray(
      (data as { bulkDraftGroupPosts?: unknown }).bulkDraftGroupPosts
    )
      ? (data as { bulkDraftGroupPosts: unknown[] }).bulkDraftGroupPosts
      : [];

  return {
    tags: tags as string[],
    queueTypes: queueTypes as QueueType[],
    hashTagPresets: hashTagPresets as Array<{
      id: string;
      name: string;
      tags: string;
    }>,
    mode: typeof mode === "string" ? mode : null,
    groupId: typeof groupId === "string" ? groupId : null,
    bulkDraftGroupPosts: bulkDraftGroupPosts as Array<{
      id: string;
      caption: string;
      fileUrl: string[];
      queueTypeId: string | null;
      queueType: { name: string } | null;
      scheduledAtUtc: Date | string | null;
      isRecyclable: boolean;
    }>,
  };
}

function getPageTitle(mode: string | null): string {
  if (mode === "recycle") {
    return "Recycle & Schedule Posts";
  }
  if (mode === "repost") {
    return "Schedule Reposts (Kind 6)";
  }
  if (mode === "quote") {
    return "Schedule Quote Posts";
  }
  return "Bulk Schedule Posts";
}

interface SubmitButtonProps {
  isSubmitting: boolean;
  isProcessing: boolean;
  isPreviewSubmitting: boolean;
  postsCount: number;
  preparationProgress?: {
    current: number;
    total: number;
    stage: string;
  };
  validationInvalid?: boolean;
}

function SubmitButton({
  isSubmitting,
  isProcessing,
  isPreviewSubmitting,
  postsCount,
  preparationProgress,
  validationInvalid,
}: SubmitButtonProps) {
  const disabled =
    isSubmitting ||
    isProcessing ||
    isPreviewSubmitting ||
    (validationInvalid ?? false);
  const showProgress =
    isPreviewSubmitting &&
    preparationProgress !== undefined &&
    preparationProgress.total > 0;

  const getButtonContent = () => {
    if (isPreviewSubmitting) {
      return (
        <div className="flex w-full flex-col items-center gap-2">
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {preparationProgress?.stage ?? "Validating & Preparing..."}
          </span>
          {showProgress ? (
            <div className="w-full">
              <div className="mb-1 text-xs text-white/80">
                Step {preparationProgress.current} of{" "}
                {preparationProgress.total}
              </div>
              <div className="h-2 w-full rounded-full bg-white/20">
                <div
                  className="h-2 rounded-full bg-white transition-all duration-300"
                  style={{
                    width: `${
                      (preparationProgress.current /
                        preparationProgress.total) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      );
    }
    if (isSubmitting) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Uploading Media Files...
        </span>
      );
    }
    if (isProcessing) {
      return "Processing Media Files...";
    }
    return `Preview ${postsCount} Post${postsCount !== 1 ? "s" : ""}`;
  };

  return (
    <button
      type="submit"
      disabled={disabled}
      className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 w-full min-w-0 flex-1 rounded-lg p-4 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0"
    >
      {getButtonContent()}
    </button>
  );
}

/** Build fileUrl array for a post (for save-as-draft payload). */
function getFileUrlArrayForDraft(post: BulkPost): string[] {
  if (Array.isArray(post.fileUrl)) {
    return post.fileUrl.filter((u): u is string => typeof u === "string");
  }
  if (typeof post.fileUrl === "string" && post.fileUrl.trim() !== "") {
    return [post.fileUrl];
  }
  return [];
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- Page component with many features; splitting would fragment state */
export default function BulkPostsPage() {
  const data = useLoaderData<{
    tags: string[];
    queueTypes: QueueType[];
    hashTagPresets: Array<{ id: string; name: string; tags: string }>;
    mode: string | null;
  }>();
  const {
    tags,
    queueTypes,
    hashTagPresets,
    mode,
    groupId,
    bulkDraftGroupPosts,
  } = extractLoaderData(data);
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
  const isSubmitting = fetcher.state !== "idle";
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
  const [showConfirmation, setShowConfirmation] = useState(false);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Modal state for bulk scheduling success
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

  const bulkDraftKey = "bulk-posts-draft";
  const {
    restored: bulkLocalRestored,
    saveSnapshot: saveBulkLocalSnapshot,
    clearSnapshot: clearBulkLocalSnapshot,
  } = useLocalDraft<{
    rows: Array<{
      caption: string;
      queueType: string;
      scheduledFor: string;
      fileUrl?: string | string[];
      isRecyclable: boolean;
    }>;
    savedAt: number;
  }>(bulkDraftKey, !!groupId, 2000);

  const bulkLocalRestoredAppliedRef = useRef(false);
  useEffect(() => {
    if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: restored can be partial
      !bulkLocalRestored?.rows?.length ||
      groupId ||
      bulkLocalRestoredAppliedRef.current
    )
      return;
    bulkLocalRestoredAppliedRef.current = true;
    const initialPosts: BulkPost[] = bulkLocalRestored.rows.map((r) => ({
      clientId: createBulkPostClientId(),
      files: [],
      caption: r.caption,
      queueType: r.queueType,
      scheduledFor: r.scheduledFor,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive for parsed JSON
      isRecyclable: r.isRecyclable ?? false,
      fileUrl: r.fileUrl,
    }));
    setPosts(initialPosts);
  }, [bulkLocalRestored, groupId, setPosts]);

  useEffect(() => {
    if (groupId) return;
    saveBulkLocalSnapshot({
      rows: posts.map((p) => ({
        caption: p.caption,
        queueType: p.queueType,
        scheduledFor: p.scheduledFor,
        fileUrl: p.fileUrl,
        isRecyclable: p.isRecyclable,
      })),
    });
  }, [groupId, posts, saveBulkLocalSnapshot]);

  useEffect(() => {
    if (fetcher.state === "submitting") {
      clearBulkLocalSnapshot();
    }
  }, [fetcher.state, clearBulkLocalSnapshot]);

  // Prefill table when opening a bulk draft group
  useEffect(() => {
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- API/DB types may be optional */
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
          caption: p.caption ?? "",
          queueType: p.queueType?.name ?? "unassigned",
          scheduledFor: scheduledAt
            ? String(Math.floor(scheduledAt.getTime() / 1000))
            : "",
          isRecyclable: p.isRecyclable ?? false,
          fileUrl: Array.isArray(p.fileUrl)
            ? p.fileUrl
            : (p.fileUrl ?? undefined),
        };
      });
      setPosts(initialPosts);
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
  }, [bulkDraftGroupPosts.length]); // eslint-disable-line react-hooks/exhaustive-deps -- only run when opening a group

  // Use extracted hooks
  useBulkPostsState({ mode, posts, setPosts });
  const { prepareEvents, validatePostsForPreview } = useBulkPostEvents({
    posts,
    fetcher,
    user,
    tags,
    useHashtagPresets,
    selectedHashtags,
    setToast,
    setPreparedEvents,
    setShowConfirmation,
    setIsPreviewSubmitting,
    setIsProcessing,
    setPreparationProgress,
  });

  const validationResult = useMemo(
    () => validatePostsForPreview(),
    [validatePostsForPreview]
  );

  // Fetch upload provider on component mount
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
        const { handleErrorSafely } = require("~/lib/error-handler.client") as {
          handleErrorSafely: (
            error: unknown,
            context: { component: string; action: string }
          ) => void;
        };
        handleErrorSafely(err, {
          component: "BulkPosts",
          action: "fetchUploadProvider",
        });
      }
    })();
  }, []);

  // Wrapper functions that delegate to extracted handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const userDeps = user
      ? {
          id: user.id,
          timezone: user.timezone ?? undefined,
          scheduleInterval: scheduleIntervals,
        }
      : null;
    void handleFileChangeHandler(e, {
      posts,
      setPosts,
      user: userDeps,
      scheduleIntervals,
      setIsProcessing,
      setProcessingProgress,
      setFirstItemTimeManuallyChanged,
    });
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

  const handleQueueTypeChange = async (index: number, value: string) => {
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
    const userDeps = user
      ? {
          id: user.id,
          timezone: user.timezone ?? undefined,
          scheduleInterval: scheduleIntervals,
        }
      : null;
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

  // Posts changes now silent for production
  useEffect(() => {
    // State tracking disabled for production
  }, [posts]);

  // Memoize preview URLs and file types (one array per row)
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

  // Cleanup object URLs when component unmounts or posts change
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

  // Check for bulk scheduling success URL param
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

      // Use setTimeout to avoid setState in effect warning
      setTimeout(() => {
        setModalPostId(firstPostId);
      }, 0);

      // Fetch post data using fetch directly for API routes
      void (async () => {
        try {
          const res = await fetch(`/api/posts/${firstPostId}`);
          if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
          }
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
            error?: string;
          };

          if (data.post || data.longFormPost) {
            setTimeout(() => {
              setModalPost(data.post ?? null);
              setModalLongFormPost(data.longFormPost ?? null);
              setShowPublishModal(true);
            }, 0);
            // Clear URL params to prevent re-showing on refresh
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete("bulkScheduled");
            newSearchParams.delete("count");
            newSearchParams.delete("firstPostId");
            newSearchParams.delete("lastScheduledAt");
            newSearchParams.delete("queueSummary");
            setSearchParams(newSearchParams, { replace: true });
          }
        } catch (error) {
          console.error("Failed to fetch post data:", error);
          // Reset state on error
          setTimeout(() => {
            setModalPostId(null);
          }, 0);
        }
      })();
    }
  }, [searchParams, modalPostId, showPublishModal, setSearchParams]);

  const [bulkDraftPickerOpen, setBulkDraftPickerOpen] = useState(false);

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
          ? formatForDateTimeLocal(addHours(now, 1), userTimezone)
          : "",
      isRecyclable: false,
    }));
    setPosts((prev) => [...prev, ...newPosts]);
  };

  const handleRowFileSelect = async (index: number, file: File | null) => {
    if (!file) return;
    const { isVideoFile } = await import("~/utils/media-helpers");
    const MAX_IMAGE = 10 * 1024 * 1024;
    const MAX_VIDEO = 100 * 1024 * 1024;
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

  const handleSaveDraftFromTable = () => {
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
    if (groupId) {
      formData.append("groupId", groupId);
    }
    const currentUrl = new URL(window.location.href);
    const actionUrl = `/dashboard/bulkposts${currentUrl.search}`;
    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
      action: actionUrl,
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{getPageTitle(mode)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {mode !== "repost" && mode !== "quote" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addEmptyRows(1)}
                disabled={isProcessing}
              >
                + Add 1 Post
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addEmptyRows(5)}
                disabled={isProcessing}
              >
                + Add 5
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addEmptyRows(10)}
                disabled={isProcessing}
              >
                + Add 10
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBulkDraftPickerOpen(true)}
          >
            Open draft
          </Button>
        </div>
      </div>
      <DraftPickerModal
        open={bulkDraftPickerOpen}
        onClose={() => setBulkDraftPickerOpen(false)}
        type="bulk"
        onSelect={(id) => navigate(`/dashboard/bulkposts?groupId=${id}`)}
      />
      {displayedHashtags && displayedHashtags.length <= 10 ? (
        <div className="bg-muted text-foreground mb-6 inline-flex items-center gap-1 rounded px-2 py-1 text-xs leading-4 font-semibold">
          <Hash
            className="inline-block size-4 opacity-75"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          <span>{displayedHashtags}</span>
        </div>
      ) : null}

      {!showConfirmation ? (
        <fetcher.Form
          onSubmit={(e) => {
            void prepareEvents(e);
          }}
          className="w-full"
          encType="multipart/form-data"
        >
          {mode !== "repost" && mode !== "quote" ? (
            <BulkPostsUploadArea
              isProcessing={isProcessing}
              processingProgress={processingProgress}
              onFileChange={handleFileChange}
              uploadProvider={uploadProvider}
            />
          ) : null}

          <BulkPostsActionButtons
            posts={posts}
            isProcessing={isProcessing}
            scheduleIntervals={scheduleIntervals}
            queueTypes={queueTypes}
            hashTagPresets={hashTagPresets}
            selectedHashtagPresetId={selectedHashtagPresetId}
            useHashtagPresets={useHashtagPresets}
            handleScheduleIntervalClick={handleScheduleIntervalClick}
            handleBulkQueueUpdate={(queueType) =>
              void handleBulkQueueUpdate(queueType)
            }
            handleHashtagPresetSelect={handleHashtagPresetSelect}
            setUseHashtagPresets={setUseHashtagPresets}
            handleBulkRecyclableToggle={handleBulkRecyclableToggle}
            onRepostAll={
              mode !== "repost" && mode !== "quote"
                ? handleRepostAll
                : undefined
            }
          />

          {posts.length > 0 && mode !== "repost" && mode !== "quote" ? (
            <BulkPostsSchedulingPanel
              posts={posts}
              setPosts={setPosts}
              scheduleIntervals={scheduleIntervals}
              userTimezone={user?.timezone ?? "UTC"}
              disabled={isProcessing}
            />
          ) : null}

          {(mode === "quote" || mode === "repost") && posts.length === 0 ? (
            <div className="border-border bg-muted/30 rounded-lg border p-6 text-center">
              <p className="text-foreground mb-2 font-medium">
                No posts to schedule.
              </p>
              <p className="text-muted-foreground mb-4 text-sm">
                Select regular posts (not articles) from Published and try
                &quot;Schedule {mode === "quote" ? "quote" : "repost"}&quot;
                again.
              </p>
              <a
                href="/dashboard/published"
                className="text-primary font-medium hover:underline"
              >
                Go to Published
              </a>
            </div>
          ) : null}

          {posts.length > 0 ? (
            <>
              <BulkPostsTable
                posts={posts}
                queueTypes={queueTypes}
                previewData={previewData}
                handleCaptionChange={handleCaptionChange}
                handleDateChange={handleDateChange}
                handleIsRecyclableChange={handleIsRecyclableChange}
                handleRemovePost={handleRemovePost}
                handleQueueTypeChange={(index, value) =>
                  void handleQueueTypeChange(index, value)
                }
                handleMediaClick={handleMediaClick}
                validationErrorsByIndex={validationResult.byPost}
                onRowFileSelect={
                  mode !== "repost" && mode !== "quote"
                    ? (idx, file) => void handleRowFileSelect(idx, file)
                    : undefined
                }
                onRowFileRemove={
                  mode !== "repost" && mode !== "quote"
                    ? handleRowFileRemove
                    : undefined
                }
                onRepostSchedulesChange={
                  mode !== "repost" && mode !== "quote"
                    ? handleRepostSchedulesChange
                    : undefined
                }
                onQuoteSchedulesChange={
                  mode !== "repost" && mode !== "quote"
                    ? handleQuoteSchedulesChange
                    : undefined
                }
                showAlsoSchedule={Boolean(
                  mode !== "repost" && mode !== "quote"
                )}
              />

              {validationResult.isValid === false ? (
                <div
                  className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
                  role="alert"
                >
                  <p className="font-medium">
                    Fix the following before preview:
                  </p>
                  <ul className="mt-1 list-inside list-disc">
                    {validationResult.errors.slice(0, 5).map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                    {validationResult.errors.length > 5 ? (
                      <li>… and {validationResult.errors.length - 5} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    posts.length === 0 ||
                    isSubmitting ||
                    isProcessing ||
                    isPreviewSubmitting
                  }
                  onClick={handleSaveDraftFromTable}
                  className="w-full sm:w-auto"
                >
                  Save as draft
                </Button>
                <SubmitButton
                  isSubmitting={isSubmitting}
                  isProcessing={isProcessing}
                  isPreviewSubmitting={isPreviewSubmitting}
                  postsCount={posts.length}
                  preparationProgress={preparationProgress}
                  validationInvalid={!validationResult.isValid}
                />
              </div>
            </>
          ) : null}
        </fetcher.Form>
      ) : (
        <PostConfirmation
          preparedEvents={preparedEvents}
          posts={posts}
          postsCount={posts.length}
          groupId={groupId}
        />
      )}

      {/* Toast Notification */}
      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}

      {/* Media Modal */}
      {selectedMedia ? (
        <MediaModal
          src={selectedMedia}
          alt="Media content"
          isOpen={isMediaModalOpen}
          onClose={handleCloseMediaModal}
        />
      ) : null}

      {/* Bulk Scheduling Success Modal */}
      {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
        <PublishResultModal
          isOpen={showPublishModal}
          postId={modalPostId}
          publishAttemptId={null} // Scheduled posts don't have publishAttemptId yet
          action="schedule"
          postType={getPostTypeFromPost(modalPost, modalLongFormPost)}
          scheduledFor={
            modalPost?.scheduledAtUtc ??
            modalLongFormPost?.scheduledAtUtc ??
            null
          }
          bulkCount={bulkPostCount}
          lastScheduledAt={bulkSuccessLastAt}
          queueSummary={bulkSuccessQueueSummary ?? undefined}
          onCreateNew={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            setBulkPostCount(null);
            setBulkSuccessLastAt(null);
            setBulkSuccessQueueSummary(null);
            // Reset form state and navigate to fresh bulk post page
            setPosts([]);
            setPreparedEvents([]);
            setShowConfirmation(false);
            navigate(`/dashboard/bulkposts${mode ? `?mode=${mode}` : ""}`, {
              replace: true,
            });
          }}
          onViewPage={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            setBulkPostCount(null);
            setBulkSuccessLastAt(null);
            setBulkSuccessQueueSummary(null);
            navigate("/dashboard/scheduled");
          }}
        />
      ) : null}
    </div>
  );
}
