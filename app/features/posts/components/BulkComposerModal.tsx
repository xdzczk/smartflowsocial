/**
 * In-page bulk composer as a modal for Published and Scheduled pages.
 * Reuses the same flow as BulkPostsPage but without redirecting.
 */

import { useFetcher } from "@remix-run/react";
import { Hash, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type ToastMessage } from "~/components/types";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import MediaModal from "~/components/ui/MediaModal";
import Toast from "~/components/ui/Toast";
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
  PostConfirmation,
  PublishResultModal,
} from "~/features/posts/ui";
import { useBulkPostEvents } from "~/features/posts/useBulkPostEvents";
import { getPostTypeFromPost } from "~/features/posts/utils/publish-result.utils";
import type { User } from "~/features/user";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import type { UserData } from "~/lib/validation/user-data";
import { isVideoFile } from "~/utils/media-helpers";

export type BulkComposerMode = "recycle" | "repost" | "quote" | "reschedule";

export interface BulkComposerModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after successful schedule (e.g. clear selection). */
  onSuccess?: () => void;
  mode: BulkComposerMode;
  initialPosts: BulkPost[];
  user: BulkComposerUser | null;
  /** Pre-loaded context; if not provided, modal will load from /dashboard/bulkposts */
  queueTypes?: QueueType[];
  hashTagPresets?: Array<{ id: string; name: string; tags: string }>;
  tags?: string[];
}

/** User shape accepted by bulk composer; full User is used internally for the hook. */
export type BulkComposerUser =
  | User
  | UserData
  | {
      id?: string;
      timezone?: string | null;
      scheduleInterval?: number[];
      timeFormat?: "12h" | "24h" | null;
    };

function getModalTitle(mode: BulkComposerMode): string {
  switch (mode) {
    case "recycle":
      return "Recycle & Schedule Posts";
    case "repost":
      return "Schedule Reposts (Kind 6)";
    case "quote":
      return "Schedule Quote Posts";
    case "reschedule":
      return "Edit & Reschedule Posts";
    default:
      return "Bulk Schedule Posts";
  }
}

const isRepostOrQuote = (mode: BulkComposerMode) =>
  mode === "repost" || mode === "quote";

interface BulkComposerFormTableSectionProps {
  posts: BulkPost[];
  validationResult: {
    isValid: boolean;
    errors: string[];
    byPost: Record<number, string[]>;
  };
  preparationProgress: { current: number; total: number; stage: string };
  isSubmitting: boolean;
  isProcessing: boolean;
  isPreviewSubmitting: boolean;
  queueTypes: QueueType[];
  previewData: Map<
    number,
    Array<{ url: string; isVideo: boolean; file: File }>
  >;
  showActions: boolean;
  userTimezone: string;
  handleCaptionChange: (index: number, value: string) => void;
  handleDateChange: (index: number, value: string) => void;
  handleIsRecyclableChange: (index: number, checked: boolean) => void;
  handleRemovePost: (index: number) => void;
  handleQueueTypeChange: (index: number, value: string) => Promise<void>;
  handleMediaClick: (mediaSrc: string) => void;
  handleRowFileSelect: (index: number, file: File | null) => Promise<void>;
  handleRowFileRemove: (index: number, mediaIndex: number) => void;
}

function BulkComposerFormTableSection({
  posts,
  validationResult,
  preparationProgress,
  isSubmitting,
  isProcessing,
  isPreviewSubmitting,
  queueTypes,
  previewData,
  showActions,
  userTimezone,
  handleCaptionChange,
  handleDateChange,
  handleIsRecyclableChange,
  handleRemovePost,
  handleQueueTypeChange,
  handleMediaClick,
  handleRowFileSelect,
  handleRowFileRemove,
}: BulkComposerFormTableSectionProps) {
  return (
    <>
      <BulkPostsTable
        posts={posts}
        queueTypes={queueTypes}
        previewData={previewData}
        handleCaptionChange={handleCaptionChange}
        handleDateChange={handleDateChange}
        handleIsRecyclableChange={handleIsRecyclableChange}
        handleRemovePost={handleRemovePost}
        handleQueueTypeChange={(idx, value) => {
          void handleQueueTypeChange(idx, value);
        }}
        handleMediaClick={handleMediaClick}
        validationErrorsByIndex={validationResult.byPost}
        onRowFileSelect={
          showActions
            ? (idx, file) => {
                void handleRowFileSelect(idx, file);
              }
            : undefined
        }
        onRowFileRemove={showActions ? handleRowFileRemove : undefined}
        onRepostSchedulesChange={undefined}
        onQuoteSchedulesChange={undefined}
        showAlsoSchedule={showActions}
        userTimezone={userTimezone}
      />
      {!validationResult.isValid ? (
        <div
          className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"
          role="alert"
        >
          <p className="font-medium">Fix the following before preview:</p>
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
          type="submit"
          disabled={
            posts.length === 0 ||
            isSubmitting ||
            isProcessing ||
            isPreviewSubmitting ||
            !validationResult.isValid
          }
          className="w-full sm:w-auto"
        >
          {isPreviewSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {preparationProgress.stage || "Preparing..."}
            </span>
          ) : (
            `Preview ${posts.length} Post${posts.length !== 1 ? "s" : ""}`
          )}
        </Button>
      </div>
    </>
  );
}

interface BulkComposerModalContentProps {
  isLoadingContext: boolean;
  displayedHashtags: string | string[];
  showConfirmation: boolean;
  mode: BulkComposerMode;
  posts: BulkPost[];
  prepareEvents: (e: React.FormEvent<HTMLFormElement>) => void;
  validationResult: {
    isValid: boolean;
    errors: string[];
    byPost: Record<number, string[]>;
  };
  preparationProgress: { current: number; total: number; stage: string };
  isProcessing: boolean;
  isSubmitting: boolean;
  isPreviewSubmitting: boolean;
  scheduleIntervals: number[] | undefined;
  queueTypes: QueueType[];
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  selectedHashtagPresetId: string | null;
  useHashtagPresets: boolean;
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>;
  setUseHashtagPresets: (v: boolean) => void;
  submitAction: string;
  extraFormData: Record<string, string>;
  submitFetcher: ReturnType<typeof useFetcher<unknown>>;
  preparedEvents: PreparedEvent[];
  user: BulkComposerUser | null;
  previewData: Map<
    number,
    Array<{ url: string; isVideo: boolean; file: File }>
  >;
  handleScheduleIntervalClick: (interval: number) => void;
  handleBulkQueueUpdate: (queueType: string) => Promise<void>;
  handleHashtagPresetSelect: (
    presetId: string | null,
    hashtags: string
  ) => void;
  handleBulkRecyclableToggle: () => void;
  handleCaptionChange: (index: number, value: string) => void;
  handleDateChange: (index: number, value: string) => void;
  handleIsRecyclableChange: (index: number, checked: boolean) => void;
  handleRemovePost: (index: number) => void;
  handleQueueTypeChange: (index: number, value: string) => Promise<void>;
  handleMediaClick: (mediaSrc: string) => void;
  handleRowFileSelect: (index: number, file: File | null) => Promise<void>;
  handleRowFileRemove: (index: number, mediaIndex: number) => void;
}

function BulkComposerModalContent({
  isLoadingContext,
  displayedHashtags,
  showConfirmation,
  mode,
  posts,
  prepareEvents,
  validationResult,
  preparationProgress,
  isProcessing,
  isSubmitting,
  isPreviewSubmitting,
  scheduleIntervals,
  queueTypes,
  hashTagPresets,
  selectedHashtagPresetId,
  useHashtagPresets,
  setPosts,
  setUseHashtagPresets,
  submitAction,
  extraFormData,
  submitFetcher,
  preparedEvents,
  user,
  previewData,
  handleScheduleIntervalClick,
  handleBulkQueueUpdate,
  handleHashtagPresetSelect,
  handleBulkRecyclableToggle,
  handleCaptionChange,
  handleDateChange,
  handleIsRecyclableChange,
  handleRemovePost,
  handleQueueTypeChange,
  handleMediaClick,
  handleRowFileSelect,
  handleRowFileRemove,
}: BulkComposerModalContentProps) {
  const showActions = !isRepostOrQuote(mode);
  const userTimezone = user?.timezone ?? "UTC";

  if (isLoadingContext) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {displayedHashtags && String(displayedHashtags).length <= 80 ? (
        <div className="bg-muted text-foreground mb-4 inline-flex items-center gap-1 rounded px-2 py-1 text-xs leading-4 font-semibold">
          <Hash
            className="inline-block size-4 opacity-75"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          <span>{displayedHashtags}</span>
        </div>
      ) : null}

      {!showConfirmation ? (
        <form
          onSubmit={prepareEvents}
          className="w-full"
          encType="multipart/form-data"
        >
          {showActions ? (
            <BulkPostsActionButtons
              posts={posts}
              isProcessing={isProcessing}
              scheduleIntervals={scheduleIntervals}
              queueTypes={queueTypes}
              hashTagPresets={hashTagPresets}
              selectedHashtagPresetId={selectedHashtagPresetId}
              useHashtagPresets={useHashtagPresets}
              handleScheduleIntervalClick={handleScheduleIntervalClick}
              handleBulkQueueUpdate={(qt) => {
                void handleBulkQueueUpdate(qt);
              }}
              handleHashtagPresetSelect={handleHashtagPresetSelect}
              setUseHashtagPresets={setUseHashtagPresets}
              handleBulkRecyclableToggle={handleBulkRecyclableToggle}
              onRepostAll={(delay) =>
                setPosts((prev) =>
                  prev.map((p) => ({
                    ...p,
                    repostSchedules: [{ value: delay.value, unit: delay.unit }],
                  }))
                )
              }
            />
          ) : null}

          {posts.length > 0 && showActions ? (
            <BulkPostsSchedulingPanel
              posts={posts}
              setPosts={setPosts}
              scheduleIntervals={scheduleIntervals}
              userTimezone={userTimezone}
              disabled={isProcessing}
            />
          ) : null}

          {posts.length > 0 ? (
            <BulkComposerFormTableSection
              posts={posts}
              validationResult={validationResult}
              preparationProgress={preparationProgress}
              isSubmitting={isSubmitting}
              isProcessing={isProcessing}
              isPreviewSubmitting={isPreviewSubmitting}
              queueTypes={queueTypes}
              previewData={previewData}
              showActions={showActions}
              userTimezone={userTimezone}
              handleCaptionChange={handleCaptionChange}
              handleDateChange={handleDateChange}
              handleIsRecyclableChange={handleIsRecyclableChange}
              handleRemovePost={handleRemovePost}
              handleQueueTypeChange={handleQueueTypeChange}
              handleMediaClick={handleMediaClick}
              handleRowFileSelect={handleRowFileSelect}
              handleRowFileRemove={handleRowFileRemove}
            />
          ) : null}
        </form>
      ) : (
        <PostConfirmation
          preparedEvents={preparedEvents}
          posts={posts}
          postsCount={posts.length}
          submitAction={submitAction}
          extraFormData={extraFormData}
          fetcher={submitFetcher}
          userTimezone={userTimezone}
          userTimeFormat={user?.timeFormat === "24h" ? "24h" : "12h"}
        />
      )}
    </>
  );
}

export function BulkComposerModal({
  open,
  onClose,
  onSuccess,
  mode,
  initialPosts,
  user,
  queueTypes: queueTypesProp,
  hashTagPresets: hashTagPresetsProp,
  tags: tagsProp,
}: BulkComposerModalProps) {
  const [posts, setPosts] = useState<BulkPost[]>([]);
  const [displayedHashtags, setDisplayedHashtags] = useState<string | string[]>(
    Array.isArray(tagsProp) ? tagsProp.join(" ") : ""
  );
  const [preparedEvents, setPreparedEvents] = useState<PreparedEvent[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const isSubmitting = submitFetcher.state !== "idle";

  const submitAction =
    mode !== "reschedule"
      ? `/dashboard/bulkposts?mode=${mode}`
      : "/dashboard/bulkposts";
  const extraFormData = { _inModal: "1" };

  const { prepareEvents } = useBulkPostEvents({
    posts,
    fetcher: submitFetcher,
    user: user as User | null,
    tags: Array.isArray(tags) ? tags : [],
    useHashtagPresets,
    selectedHashtags,
    setToast,
    setPreparedEvents,
    setShowConfirmation,
    setIsPreviewSubmitting,
    setIsProcessing,
    setPreparationProgress,
    extraFormData,
    submitAction,
  });

  const validationResult = useMemo(() => {
    const errors: string[] = [];
    const byPost: Record<number, string[]> = {};
    const hasMedia = (post: BulkPost) =>
      post.files.length > 0 ||
      (Array.isArray(post.fileUrl) && post.fileUrl.length > 0) ||
      (typeof post.fileUrl === "string" && post.fileUrl.trim() !== "");
    posts.forEach((post, index) => {
      const rowErrors: string[] = [];
      const caption = post.caption || "";
      const scheduledFor = post.scheduledFor || "";
      if (!hasMedia(post) && !caption.trim()) {
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
    setShowConfirmation(false);
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

  const _handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setProcessingProgress: () => {},
        setFirstItemTimeManuallyChanged,
      });
    },
    [posts, user, scheduleIntervals]
  );

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

      // Recalculate interval-expanded times when first post anchor is edited.
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
    [posts, queueTypes, scheduleIntervals, setDisplayedHashtags, tags, user]
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
    setShowConfirmation(false);
    onSuccess?.();
    onClose();
  }, [onSuccess, onClose]);

  const isLoadingContext =
    !queueTypesProp &&
    !hashTagPresetsProp &&
    (contextFetcher.state === "loading" ||
      contextFetcher.state === "submitting");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="flex max-h-[90dvh] max-w-4xl flex-col overflow-hidden p-0"
        hideCloseButton={false}
      >
        <DialogTitle className="sr-only">{getModalTitle(mode)}</DialogTitle>
        <div className="border-border flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{getModalTitle(mode)}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <BulkComposerModalContent
            isLoadingContext={isLoadingContext}
            displayedHashtags={displayedHashtags}
            showConfirmation={showConfirmation}
            mode={mode}
            posts={posts}
            prepareEvents={(e) => {
              e.preventDefault();
              void prepareEvents(e);
            }}
            validationResult={validationResult}
            preparationProgress={preparationProgress}
            isProcessing={isProcessing}
            isSubmitting={isSubmitting}
            isPreviewSubmitting={isPreviewSubmitting}
            scheduleIntervals={scheduleIntervals}
            queueTypes={queueTypes}
            hashTagPresets={hashTagPresets}
            selectedHashtagPresetId={selectedHashtagPresetId}
            useHashtagPresets={useHashtagPresets}
            setPosts={setPosts}
            setUseHashtagPresets={setUseHashtagPresets}
            submitAction={submitAction}
            extraFormData={extraFormData}
            submitFetcher={submitFetcher}
            preparedEvents={preparedEvents}
            user={user}
            previewData={previewData}
            handleScheduleIntervalClick={handleScheduleIntervalClick}
            handleBulkQueueUpdate={handleBulkQueueUpdate}
            handleHashtagPresetSelect={handleHashtagPresetSelect}
            handleBulkRecyclableToggle={handleBulkRecyclableToggle}
            handleCaptionChange={handleCaptionChange}
            handleDateChange={handleDateChange}
            handleIsRecyclableChange={handleIsRecyclableChange}
            handleRemovePost={handleRemovePost}
            handleQueueTypeChange={handleQueueTypeChange}
            handleMediaClick={handleMediaClick}
            handleRowFileSelect={handleRowFileSelect}
            handleRowFileRemove={handleRowFileRemove}
          />
        </div>

        {toast ? (
          <div className="flex-shrink-0 p-4 pt-0">
            <Toast toast={toast} onClose={() => setToast(null)} />
          </div>
        ) : null}

        {selectedMedia ? (
          <MediaModal
            src={selectedMedia}
            alt="Media content"
            isOpen={isMediaModalOpen}
            onClose={handleCloseMediaModal}
          />
        ) : null}

        {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
          <PublishResultModal
            isOpen={showPublishModal}
            postId={modalPostId}
            publishAttemptId={null}
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
            onCreateNew={handleSuccessClose}
            onViewPage={handleSuccessClose}
            onGoToDashboard={handleSuccessClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
