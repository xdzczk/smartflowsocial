import { type FetcherWithComponents } from "@remix-run/react";
import { useEffect, useRef, useCallback, type FormEvent } from "react";

import { type ToastMessage } from "~/components/types";
import type { BulkComposerStage } from "~/features/posts/bulk-composer/types";
import { bulkPostMissingRequiredCaption } from "~/features/posts/components/bulk-composer/bulk-composer-post-card-utils";
import type { User } from "~/features/user";
import { safeConsoleInfo } from "~/lib/safe-console.client";
import { applyRandomScheduleWindow } from "~/lib/schedule-random";
import {
  formatForDateTimeLocal,
  nowInTimezone,
  nowMillis,
  nowUTC,
} from "~/lib/temporal";

import { type BulkPost, type PreparedEvent } from "./types";
import {
  runRepostOrQuotePreparation,
  runUploadPreparation,
} from "./utils/bulk-post-events-fetcher.utils";
import {
  type FetcherData,
  buildContent,
  convertScheduledTime,
  convertTagsToArray,
  createKind6RepostEvent,
  createQuotePostEvent,
  getFileUrlFromFetcher,
  getUserTimezone,
  showValidationErrorToast,
} from "./utils/bulk-post-events.utils";

/**
 * Check if we're in development mode for conditional logging
 */
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Development-only logging helper
 */
function devLog(...args: unknown[]): void {
  if (isDevelopment) {
    safeConsoleInfo(...args);
  }
}

interface UseBulkPostEventsProps {
  posts: BulkPost[];
  fetcher: FetcherWithComponents<FetcherData>;
  user: User | null;
  tags: string[];
  useHashtagPresets: boolean;
  selectedHashtags: string;
  setToast: (toast: ToastMessage | null) => void;
  setPreparedEvents: (events: PreparedEvent[]) => void;
  setBulkComposerStage: (stage: BulkComposerStage) => void;
  setIsPreviewSubmitting: (isSubmitting: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setPreparationProgress?: (progress: {
    current: number;
    total: number;
    stage: string;
  }) => void;
  /** Extra form fields to append on submit (e.g. _inModal for in-page composer). */
  extraFormData?: Record<string, string>;
  /** Submit action URL (e.g. /dashboard/bulkposts?mode=quote for modal). */
  submitAction?: string;
  /** Per post: actual publish time = random within ±N minutes of nominal schedule (0 = off). */
  scheduleRandomWindowMinutes?: number;
}

export function useBulkPostEvents({
  posts,
  fetcher,
  user,
  tags,
  useHashtagPresets,
  selectedHashtags,
  setToast,
  setPreparedEvents,
  setBulkComposerStage,
  setIsPreviewSubmitting,
  setIsProcessing: _setIsProcessing,
  setPreparationProgress,
  extraFormData,
  submitAction,
  scheduleRandomWindowMinutes = 0,
}: UseBulkPostEventsProps) {
  const isWaitingForUpload = useRef(false);

  // Validation function to check if all posts are ready for preview
  const validatePostsForPreview = (): {
    isValid: boolean;
    errors: string[];
    byPost: Record<number, string[]>;
  } => {
    const errors: string[] = [];
    const byPost: Record<number, string[]> = {};

    posts.forEach((post, index) => {
      const rowErrors: string[] = [];

      if (bulkPostMissingRequiredCaption(post)) {
        const msg = "Caption is required when there is no media";
        rowErrors.push(msg);
        errors.push(`Post ${index + 1}: ${msg}`);
      }

      // Schedule time is set
      if (!post.scheduledFor || post.scheduledFor.trim() === "") {
        const msg = "Schedule time is required";
        rowErrors.push(msg);
        errors.push(`Post ${index + 1}: ${msg}`);
      }

      // Schedule time is in the future
      if (post.scheduledFor && post.scheduledFor.trim() !== "") {
        const userTimezone = user?.timezone ?? "UTC";
        const nowInUserTz = nowInTimezone(userTimezone);
        const nowFormatted = formatForDateTimeLocal(nowInUserTz, userTimezone);
        if (post.scheduledFor <= nowFormatted) {
          const msg = "Schedule time must be in the future";
          rowErrors.push(msg);
          errors.push(`Post ${index + 1}: ${msg}`);
        }
      }

      if (rowErrors.length > 0) {
        byPost[index] = rowErrors;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      byPost,
    };
  };

  const processEvents = useCallback(async () => {
    const processStartTime = nowMillis();
    const { nowUTC } = await import("~/lib/temporal");
    devLog(
      `[BulkPosts] processEvents started at ${nowUTC().toInstant().toString()}`
    );

    // Calculate total steps based on whether we had uploads
    const filesToUpload = posts.flatMap((post) => post.files);
    const totalSteps = filesToUpload.length > 0 ? filesToUpload.length + 3 : 4;
    const baseStep = filesToUpload.length > 0 ? filesToUpload.length + 1 : 1;

    const updateProgress = (stage: string, step: number) => {
      setPreparationProgress?.({
        current: baseStep + step - 1,
        total: totalSteps,
        stage,
      });
    };

    // Step 2: Fetch hashtags (step 1 was server processing)
    updateProgress("Fetching hashtags...", 2);
    const hashtagStartTime = nowMillis();
    // First, collect unique queue types and fetch hashtags in batch
    // This prevents making one API call per post, which can be very slow for bulk operations
    const uniqueQueueTypes = new Set(
      posts
        .map((post) => post.queueType)
        .filter((qt) => qt && qt !== "unassigned")
    );

    // Fetch hashtags for all unique queue types in parallel
    const hashtagCache = new Map<string, string>();

    if (!useHashtagPresets && uniqueQueueTypes.size > 0) {
      const hashtagPromises = Array.from(uniqueQueueTypes).map(
        async (queueType) => {
          try {
            const res = await fetch("/api/effective-hashtags", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: user?.id,
                queueTypeName: queueType,
              }),
            });
            const dataRaw: unknown = await res.json();
            const data =
              dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
                ? (dataRaw as { hashtags?: unknown })
                : {};
            const hashtags =
              typeof data.hashtags === "string" ? data.hashtags : null;
            return {
              queueType,
              hashtags: hashtags ?? tags.join(" "),
            };
          } catch {
            return { queueType, hashtags: tags.join(" ") };
          }
        }
      );

      const hashtagResults = await Promise.all(hashtagPromises);
      hashtagResults.forEach(({ queueType, hashtags }) => {
        hashtagCache.set(queueType, hashtags);
      });
      const hashtagTime = nowMillis() - hashtagStartTime;
      devLog(
        `[BulkPosts] Hashtags fetched in ${hashtagTime}ms (${uniqueQueueTypes.size} unique queue types)`
      );
    } else {
      const hashtagTime = nowMillis() - hashtagStartTime;
      devLog(
        `[BulkPosts] Skipped hashtag fetch (using presets) in ${hashtagTime}ms`
      );
    }

    // Step 3: Prepare events
    updateProgress("Preparing events...", 3);
    const eventCreationStartTime = nowMillis();
    // Now create events using cached hashtags
    const events = await Promise.all(
      posts.map(async (post, index) => {
        // Get effective hashtags from cache or use preset
        let effectiveHashtags: string;
        if (useHashtagPresets && selectedHashtags) {
          effectiveHashtags = selectedHashtags;
        } else if (useHashtagPresets && !selectedHashtags) {
          // If hashtag presets are enabled but no preset is selected, use empty string
          effectiveHashtags = "";
        } else if (post.queueType && post.queueType !== "unassigned") {
          effectiveHashtags =
            hashtagCache.get(post.queueType) ?? tags.join(" ");
        } else {
          effectiveHashtags = tags.join(" ");
        }

        const tagsString = effectiveHashtags;
        const { fileUrl, scheduledFor: scheduledForValue } =
          getFileUrlFromFetcher(fetcher.data, index);
        const content = buildContent(
          fileUrl,
          post.caption,
          tagsString,
          post.includeHashtagsInNoteBody !== false
        );
        const tagArray = convertTagsToArray(tagsString);
        const userTimezone = getUserTimezone(user);
        let scheduledTime = convertScheduledTime(
          scheduledForValue,
          userTimezone
        );
        if (scheduleRandomWindowMinutes > 0) {
          const nominalUnix = Math.floor(scheduledTime / 1000);
          const actualUnix = applyRandomScheduleWindow(
            nominalUnix,
            scheduleRandomWindowMinutes
          );
          scheduledTime = actualUnix * 1000;
        }

        const addTags =
          post.includeHashtagsInNoteBody !== false ? `${tagsString}` : "";

        // Handle kind 6 reposts differently
        if (post.isKind6Repost) {
          return createKind6RepostEvent(post, scheduledTime);
        }

        if (post.isQuotePost) {
          return createQuotePostEvent(
            post,
            addTags,
            tagArray,
            scheduledTime,
            fileUrl[0] ?? ""
          );
        }

        // Regular post
        return {
          fileUrl,
          scheduledFor: Math.floor(scheduledTime / 1000),
          caption: post.caption,
          queueType: post.queueType,
          isRecyclable: post.isRecyclable,
          originalPostId: post.originalPostId,
          events: {
            content,
            created_at: Math.floor(scheduledTime / 1000),
            kind: 1,
            tags: tagArray,
          },
        };
      })
    );
    const eventCreationTime = nowMillis() - eventCreationStartTime;
    devLog(
      `[BulkPosts] Events created in ${eventCreationTime}ms (${posts.length} posts)`
    );

    // Step 4: Finalize
    updateProgress("Finalizing...", 4);
    setPreparedEvents(events);
    setBulkComposerStage("review");

    const totalTime = nowMillis() - processStartTime;
    devLog(`[BulkPosts] processEvents completed in ${totalTime}ms total`);

    // Reset loading state when events are processed successfully
    setIsPreviewSubmitting(false);

    // Reset progress after a short delay to show completion
    setTimeout(() => {
      setPreparationProgress?.({ current: 0, total: 0, stage: "" });
    }, 500);
  }, [
    posts,
    useHashtagPresets,
    selectedHashtags,
    user,
    tags,
    fetcher,
    setPreparedEvents,
    setBulkComposerStage,
    setIsPreviewSubmitting,
    setPreparationProgress,
    scheduleRandomWindowMinutes,
  ]);

  async function startPrepareFlow() {
    devLog(
      "[BulkPosts] Starting preparation at",
      nowUTC().toInstant().toString()
    );

    const { isValid, errors } = validatePostsForPreview();
    if (!isValid) {
      showValidationErrorToast(errors, setToast);
      return;
    }

    setIsPreviewSubmitting(true);
    const filesToUpload = posts.flatMap((post) => post.files);
    const totalSteps = filesToUpload.length > 0 ? filesToUpload.length + 3 : 4;
    setPreparationProgress?.({
      current: 0,
      total: totalSteps,
      stage: "Preparing...",
    });

    try {
      const hasRepostOrQuote =
        posts.some((post) => post.isRepost && post.fileUrl) ||
        posts.some((post) => post.isKind6Repost) ||
        posts.some((post) => post.isQuotePost);

      if (hasRepostOrQuote) {
        runRepostOrQuotePreparation(posts, fetcher, setPreparationProgress);
        return;
      }

      const ok = await runUploadPreparation({
        posts,
        fetcher,
        setPreparationProgress,
        extraFormData,
        submitAction,
        isWaitingForUploadRef: isWaitingForUpload,
        setToast,
        setIsPreviewSubmitting,
        log: devLog,
      });
      if (!ok) return;
    } catch (error: unknown) {
      const { handleAsyncErrorWithMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "An error occurred while preparing posts. Please try again.",
        { component: "useBulkPostEvents", action: "prepareEvents" },
        false
      );
      setToast({
        type: "error",
        message: "An error occurred while preparing posts. Please try again.",
      });
      setTimeout(() => setToast(null), 5000);
      setIsPreviewSubmitting(false);
    }
  }

  const prepareEvents = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void startPrepareFlow();
  };

  // Add event listener for repost events
  useEffect(() => {
    const handleRepostEventsPrepared = () => {
      // Manually trigger the event creation logic
      const fetcherDataRaw = fetcher.data;
      const fetcherData =
        fetcherDataRaw &&
        typeof fetcherDataRaw === "object" &&
        !Array.isArray(fetcherDataRaw)
          ? (fetcherDataRaw as { fileUrls?: unknown })
          : null;
      if (
        fetcherData &&
        "fileUrls" in fetcherData &&
        Array.isArray(fetcherData.fileUrls)
      ) {
        // Update progress - server processing complete, starting event preparation
        setPreparationProgress?.({
          current: 1,
          total: 4,
          stage: "Processing reposts, preparing events...",
        });
        void processEvents();
      }
    };

    document.addEventListener(
      "repostEventsPrepared",
      handleRepostEventsPrepared
    );

    return () => {
      document.removeEventListener(
        "repostEventsPrepared",
        handleRepostEventsPrepared
      );
    };
  }, [fetcher.data, processEvents, setPreparationProgress]);

  // Watch for upload completion
  useEffect(() => {
    const fetcherDataRaw = fetcher.data;
    const fetcherData =
      fetcherDataRaw &&
      typeof fetcherDataRaw === "object" &&
      !Array.isArray(fetcherDataRaw)
        ? (fetcherDataRaw as { fileUrls?: unknown })
        : null;
    if (
      isWaitingForUpload.current &&
      fetcher.state === "idle" &&
      fetcherData &&
      "fileUrls" in fetcherData &&
      Array.isArray(fetcherData.fileUrls)
    ) {
      devLog(
        `[BulkPosts] Server response received at ${nowUTC().toInstant().toString()}`
      );
      isWaitingForUpload.current = false;

      // Update progress - server processing complete, starting event preparation
      setPreparationProgress?.({
        current: 1,
        total: 4,
        stage: "Server processing complete, preparing events...",
      });

      void processEvents();
    }
  }, [fetcher.state, fetcher.data, processEvents, setPreparationProgress]);

  return { prepareEvents, startPrepareFlow, validatePostsForPreview };
}
