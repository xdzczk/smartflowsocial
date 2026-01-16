import { type FetcherWithComponents } from "@remix-run/react";
import { nip19 } from "nostr-tools";
import { useEffect, useRef, useCallback } from "react";

import { type ToastMessage } from "~/components/types";
import { uploadMultipleFiles } from "~/features/upload/upload.client";
import type { User } from "~/features/user";
import { logClientError } from "~/lib/error-handler.client";

import { type BulkPost, type PreparedEvent } from "./types";

const DEFAULT_RELAY_URL = "wss://relay.primal.net";

interface FetcherData {
  fileUrls?: Array<{ fileUrl: string; scheduledFor: string }>;
}

// ============================================================================
// Pure Helper Functions (moved outside component to avoid dependency issues)
// ============================================================================

function getFileUrlFromFetcher(
  fetcher: FetcherWithComponents<FetcherData>,
  index: number
): { fileUrl: string; scheduledFor: string } {
  const fetcherDataRaw = fetcher.data;
  const fetcherData =
    fetcherDataRaw &&
    typeof fetcherDataRaw === "object" &&
    !Array.isArray(fetcherDataRaw)
      ? (fetcherDataRaw as { fileUrls?: unknown })
      : null;
  const fileUrls =
    fetcherData &&
    "fileUrls" in fetcherData &&
    Array.isArray(fetcherData.fileUrls)
      ? fetcherData.fileUrls
      : null;
  const fileUrlItem =
    fileUrls?.[index] &&
    typeof fileUrls[index] === "object" &&
    fileUrls[index] !== null &&
    !Array.isArray(fileUrls[index])
      ? (fileUrls[index] as { fileUrl?: unknown; scheduledFor?: unknown })
      : null;
  const fileUrl =
    fileUrlItem &&
    "fileUrl" in fileUrlItem &&
    typeof fileUrlItem.fileUrl === "string"
      ? fileUrlItem.fileUrl
      : "";
  const scheduledFor =
    fileUrlItem &&
    "scheduledFor" in fileUrlItem &&
    typeof fileUrlItem.scheduledFor === "string"
      ? fileUrlItem.scheduledFor
      : "";

  return { fileUrl, scheduledFor };
}

function buildContent(
  fileUrl: string,
  caption: string,
  tagsString: string,
  user: User | null
): string {
  const addTags =
    user &&
    typeof user === "object" &&
    "showHashTagsinPosts" in user &&
    user.showHashTagsinPosts
      ? `${tagsString}`
      : "";

  const contentParts = [fileUrl, caption, addTags].filter(
    (part) => part !== ""
  );
  return contentParts.join("\n");
}

function convertTagsToArray(tagsString: string): string[][] {
  return tagsString
    .split(" ")
    .filter((tag: string) => tag.length > 0)
    .map((tag: string) => ["t", tag.replace("#", "")]);
}

function convertScheduledTime(
  scheduledForValue: string,
  userTimezone: string
): number {
  if (userTimezone !== "UTC" && userTimezone !== "Etc/GMT") {
    const utcDate = new Date(scheduledForValue);
    const userDate = new Date(scheduledForValue).toLocaleString("en-US", {
      timeZone: userTimezone,
    });
    const userOffset =
      (new Date(userDate).getTime() - new Date(scheduledForValue).getTime()) /
      60000;
    utcDate.setMinutes(utcDate.getMinutes() - userOffset);
    return utcDate.getTime();
  }
  const dateObj = new Date(scheduledForValue + "Z");
  return dateObj.getTime();
}

function parseOriginalFileUrl(originalFileUrl: string | string[]): string {
  if (Array.isArray(originalFileUrl)) {
    return originalFileUrl[0] ?? "";
  }
  if (typeof originalFileUrl === "string" && originalFileUrl.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(originalFileUrl);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return typeof (parsed as unknown[])[0] === "string"
          ? ((parsed as string[])[0] ?? "")
          : "";
      }
    } catch {
      return originalFileUrl;
    }
  }
  return typeof originalFileUrl === "string" ? originalFileUrl : "";
}

function getFileUrlFromPost(post: BulkPost): string {
  if (
    post.isKind6Repost &&
    post.originalFileUrl &&
    post.originalFileUrl.length > 0
  ) {
    return parseOriginalFileUrl(post.originalFileUrl);
  }
  if (Array.isArray(post.fileUrl)) {
    return typeof post.fileUrl[0] === "string" ? post.fileUrl[0] : "";
  }
  return typeof post.fileUrl === "string" ? post.fileUrl : "";
}

function _createFakeFileUrlData(posts: BulkPost[]): Array<{
  fileUrl: string;
  scheduledFor: string;
  queueType: string;
  isRecyclable: boolean;
}> {
  return posts.map((post) => ({
    fileUrl: getFileUrlFromPost(post),
    scheduledFor: post.scheduledFor,
    queueType: post.queueType,
    isRecyclable: post.isRecyclable,
  }));
}

function getUserTimezone(user: User | null): string {
  return user &&
    typeof user === "object" &&
    "timezone" in user &&
    typeof user.timezone === "string"
    ? user.timezone
    : "UTC";
}

function getDisplayFileUrl(post: BulkPost): string {
  if (!post.originalFileUrl || post.originalFileUrl.length === 0) {
    return "";
  }

  if (
    typeof post.originalFileUrl === "string" &&
    post.originalFileUrl.startsWith("[")
  ) {
    try {
      const parsed = JSON.parse(post.originalFileUrl) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0] ?? "";
      }
    } catch (_e) {
      return post.originalFileUrl ?? "";
    }
  }

  if (Array.isArray(post.originalFileUrl) && post.originalFileUrl.length > 0) {
    return post.originalFileUrl[0] ?? "";
  }

  return post.originalFileUrl as string;
}

function createKind6RepostEvent(
  post: BulkPost,
  scheduledTime: number
): PreparedEvent {
  const displayFileUrl = getDisplayFileUrl(post);
  return {
    fileUrl: displayFileUrl,
    scheduledFor: Math.floor(
      (post.scheduledFor ? new Date(post.scheduledFor).getTime() : Date.now()) /
        1000
    ),
    caption: "",
    queueType: post.queueType,
    isRecyclable: post.isRecyclable,
    originalPostId: post.originalPostId,
    originalEventId: post.originalEventId,
    originalEventPubkey: post.originalEventPubkey,
    events: {
      content: "",
      created_at: Math.floor(scheduledTime / 1000),
      kind: 6,
      tags: [
        ["e", post.originalEventId ?? "", DEFAULT_RELAY_URL],
        ["p", post.originalEventPubkey ?? ""],
      ],
    },
  };
}

function createLongformQuoteEvent(
  post: BulkPost,
  addTags: string,
  tagArray: string[][],
  scheduledTime: number,
  fileUrl: string
): PreparedEvent {
  const quoteContent = [post.caption, addTags.length > 10 ? "" : addTags]
    .filter(Boolean)
    .join("\n");

  let aTag: string[] | null = null;
  if (post.naddr) {
    try {
      const decoded = nip19.decode(post.naddr.replace("nostr:", ""));
      if (decoded.type === "naddr") {
        const { identifier, pubkey, kind } = decoded.data;
        aTag = [
          "a",
          `${kind}:${pubkey}:${identifier}`,
          DEFAULT_RELAY_URL,
          "mention",
        ];
      }
    } catch (e) {
      logClientError(
        e instanceof Error ? e : new Error(String(e)),
        {
          component: "useBulkPostEvents",
          action: "decodeNaddr",
          message: "Failed to decode naddr for longform quote",
        },
        "warning"
      );
    }
  }

  const quoteTags = [
    ...tagArray,
    ...(aTag ? [aTag] : []),
    ["p", post.originalEventPubkey ?? "", "", "mention"],
  ];

  return {
    fileUrl,
    scheduledFor: Math.floor(scheduledTime / 1000),
    caption: post.caption,
    queueType: post.queueType,
    isRecyclable: post.isRecyclable,
    originalPostId: post.originalPostId,
    originalEventId: post.originalEventId,
    originalEventPubkey: post.originalEventPubkey,
    events: {
      content: quoteContent,
      created_at: Math.floor(scheduledTime / 1000),
      kind: 1,
      tags: quoteTags,
      isQuotePost: true,
    },
  };
}

function createRegularQuoteEvent(
  post: BulkPost,
  addTags: string,
  tagArray: string[][],
  scheduledTime: number,
  fileUrl: string
): PreparedEvent {
  const neventEncoded = nip19.neventEncode({
    id: post.originalEventId ?? "",
    relays: [DEFAULT_RELAY_URL],
    author: post.originalEventPubkey,
  });

  const quoteContent = [
    post.caption,
    `nostr:${neventEncoded}`,
    addTags.length > 10 ? "" : addTags,
  ]
    .filter(Boolean)
    .join("\n");

  const quoteTags = [
    ...tagArray,
    ["e", post.originalEventId ?? "", DEFAULT_RELAY_URL, "mention"],
    ["p", post.originalEventPubkey ?? "", "", "mention"],
  ];

  return {
    fileUrl,
    scheduledFor: Math.floor(scheduledTime / 1000),
    caption: post.caption,
    queueType: post.queueType,
    isRecyclable: post.isRecyclable,
    originalPostId: post.originalPostId,
    originalEventId: post.originalEventId,
    originalEventPubkey: post.originalEventPubkey,
    events: {
      content: quoteContent,
      created_at: Math.floor(scheduledTime / 1000),
      kind: 1,
      tags: quoteTags,
      isQuotePost: true,
    },
  };
}

function createQuotePostEvent(
  post: BulkPost,
  addTags: string,
  tagArray: string[][],
  scheduledTime: number,
  fileUrl: string
): PreparedEvent {
  if (post.isLongformQuote) {
    return createLongformQuoteEvent(
      post,
      addTags,
      tagArray,
      scheduledTime,
      fileUrl
    );
  }
  return createRegularQuoteEvent(
    post,
    addTags,
    tagArray,
    scheduledTime,
    fileUrl
  );
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
  setShowConfirmation: (show: boolean) => void;
  setIsPreviewSubmitting: (isSubmitting: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setPreparationProgress?: (progress: {
    current: number;
    total: number;
    stage: string;
  }) => void;
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
  setShowConfirmation,
  setIsPreviewSubmitting,
  setIsProcessing: _setIsProcessing,
  setPreparationProgress,
}: UseBulkPostEventsProps) {
  const isWaitingForUpload = useRef(false);

  // Validation function to check if all posts are ready for preview
  const validatePostsForPreview = () => {
    const errors: string[] = [];

    posts.forEach((post, index) => {
      // Check if schedule time is set
      if (!post.scheduledFor || post.scheduledFor.trim() === "") {
        errors.push(`Post ${index + 1}: Schedule time is required`);
      }

      // Check if schedule time is in the future
      if (post.scheduledFor) {
        const userTimezone = user?.timezone ?? "UTC";

        // The scheduledFor value is in user's timezone (from datetime-local input)
        // We need to compare it with current time in the same user timezone
        // Get current time in user's timezone as a comparable string
        const nowInUserTz = new Date()
          .toLocaleString("en-US", {
            timeZone: userTimezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5");

        // Compare as strings since both are in the same format (YYYY-MM-DDTHH:mm)
        // This avoids timezone conversion issues
        if (post.scheduledFor <= nowInUserTz) {
          errors.push(`Post ${index + 1}: Schedule time must be in the future`);
        }
      }

      // Check if queue type is assigned (for new uploads)
      if (
        !post.isRepost &&
        !post.isKind6Repost &&
        !post.isQuotePost &&
        post.queueType === "unassigned"
      ) {
        errors.push(`Post ${index + 1}: Please assign a queue type`);
      }
    });

    return { isValid: errors.length === 0, errors };
  };

  const processEvents = useCallback(async () => {
    const processStartTime = Date.now();
    console.info(
      `[BulkPosts] processEvents started at ${new Date().toISOString()}`
    );
    const totalSteps = 4; // Server processing, Fetching hashtags, Preparing events, Finalizing

    const updateProgress = (stage: string, step: number) => {
      setPreparationProgress?.({
        current: step,
        total: totalSteps,
        stage,
      });
    };

    // Step 2: Fetch hashtags (step 1 was server processing)
    updateProgress("Fetching hashtags...", 2);
    const hashtagStartTime = Date.now();
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
      const hashtagTime = Date.now() - hashtagStartTime;
      console.info(
        `[BulkPosts] Hashtags fetched in ${hashtagTime}ms (${uniqueQueueTypes.size} unique queue types)`
      );
    } else {
      const hashtagTime = Date.now() - hashtagStartTime;
      console.info(
        `[BulkPosts] Skipped hashtag fetch (using presets) in ${hashtagTime}ms`
      );
    }

    // Step 3: Prepare events
    updateProgress("Preparing events...", 3);
    const eventCreationStartTime = Date.now();
    // Now create events using cached hashtags
    const events = await Promise.all(
      posts.map(async (post, index) => {
        // Get effective hashtags from cache or use preset
        let effectiveHashtags: string;
        if (useHashtagPresets && selectedHashtags) {
          effectiveHashtags = selectedHashtags;
        } else if (post.queueType && post.queueType !== "unassigned") {
          effectiveHashtags =
            hashtagCache.get(post.queueType) ?? tags.join(" ");
        } else {
          effectiveHashtags = tags.join(" ");
        }

        const tagsString = effectiveHashtags;
        const { fileUrl, scheduledFor: scheduledForValue } =
          getFileUrlFromFetcher(fetcher, index);
        const content = buildContent(fileUrl, post.caption, tagsString, user);
        const tagArray = convertTagsToArray(tagsString);
        const userTimezone = getUserTimezone(user);
        const scheduledTime = convertScheduledTime(
          scheduledForValue,
          userTimezone
        );

        const addTags =
          user &&
          typeof user === "object" &&
          "showHashTagsinPosts" in user &&
          user.showHashTagsinPosts
            ? `${tagsString}`
            : "";

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
            fileUrl
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
    const eventCreationTime = Date.now() - eventCreationStartTime;
    console.info(
      `[BulkPosts] Events created in ${eventCreationTime}ms (${posts.length} posts)`
    );

    // Step 4: Finalize
    updateProgress("Finalizing...", 4);
    setPreparedEvents(events);
    setShowConfirmation(true);

    const totalTime = Date.now() - processStartTime;
    console.info(`[BulkPosts] processEvents completed in ${totalTime}ms total`);

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
    setShowConfirmation,
    setIsPreviewSubmitting,
    setPreparationProgress,
  ]);

  const prepareEvents = async (e: React.FormEvent) => {
    e.preventDefault();
    console.info(
      "[BulkPosts] Starting preparation at",
      new Date().toISOString()
    );

    // Validate posts before proceeding
    const { isValid, errors } = validatePostsForPreview();
    if (!isValid) {
      // Show toast notification with validation errors
      const errorMessage =
        errors.length === 1
          ? (errors[0] ?? "Validation error")
          : `${errors.length} issues found:\n• ${errors.slice(0, 3).join("\n• ")}${errors.length > 3 ? "\n• And more..." : ""}`;

      setToast({
        type: "error",
        message: errorMessage,
      });

      // Hide toast after 5 seconds
      setTimeout(() => setToast(null), 5000);
      return;
    }

    // Set loading state for preview submission
    setIsPreviewSubmitting(true);

    // Show initial progress immediately
    setPreparationProgress?.({
      current: 0,
      total: 4, // Uploading (if needed), Waiting for server, Fetching hashtags, Preparing events, Finalizing
      stage: "Preparing...",
    });

    try {
      // Check if this is a repost with existing URLs, kind 6 repost, or quote post
      const hasRepostData = posts.some((post) => post.isRepost && post.fileUrl);
      const hasKind6RepostData = posts.some((post) => post.isKind6Repost);
      const hasQuotePostData = posts.some((post) => post.isQuotePost);

      if (hasRepostData || hasKind6RepostData || hasQuotePostData) {
        // For reposts and quote posts, create fake upload response with existing URLs
        const fakeFileUrls = _createFakeFileUrlData(posts);

        // Simulate the fetcher response
        // Note: Direct assignment to fetcher.data is not recommended, but this is a workaround for repost flow
        (fetcher as { data?: unknown }).data = { fileUrls: fakeFileUrls };

        // Update progress - skipping upload, going straight to processing
        setPreparationProgress?.({
          current: 1,
          total: 4,
          stage: "Processing reposts...",
        });

        // Trigger the event creation manually
        const customEvent = new CustomEvent("repostEventsPrepared");
        document.dispatchEvent(customEvent);
      } else {
        // Use client-side upload system
        const filesToUpload = posts
          .map((post) => post.file)
          .filter((file) => file !== null);

        if (filesToUpload.length > 0) {
          try {
            // Update progress for upload phase
            setPreparationProgress?.({
              current: 0,
              total: 4,
              stage: "Uploading files...",
            });

            const uploadStartTime = Date.now();
            // Upload all files using the new upload system
            const uploadResults = await uploadMultipleFiles(filesToUpload);
            const uploadTime = Date.now() - uploadStartTime;
            console.info(
              `[BulkPosts] Uploads completed in ${uploadTime}ms (${filesToUpload.length} files)`
            );

            // Check for failed uploads
            const failedUploads = uploadResults.filter(
              (result) => !result.success
            );
            if (failedUploads.length > 0) {
              const errorMessages = failedUploads
                .map((result) => result.error)
                .join(", ");
              throw new Error(`Upload failed: ${errorMessages}`);
            }

            // Map upload results back to posts (maintaining order)
            let uploadIndex = 0;
            const mappedResults = posts.map((post) => {
              if (post.file) {
                return uploadResults[uploadIndex++];
              }
              return { success: true, file: { url: "" } }; // Placeholder for posts without files
            });

            // Update progress - waiting for server
            setPreparationProgress?.({
              current: 1,
              total: 4,
              stage: "Processing uploads...",
            });

            // Send results to server
            const formData = new FormData();
            formData.append("uploadResults", JSON.stringify(mappedResults));
            posts.forEach((post) => {
              formData.append("scheduledDates", post.scheduledFor);
              formData.append("queueTypes", post.queueType);
              formData.append("isRecyclable", post.isRecyclable.toString());
            });
            formData.append("_action", "_upload_images_preview");

            console.info(
              `[BulkPosts] Submitting to server at ${new Date().toISOString()}`
            );

            // Submit to server for processing
            isWaitingForUpload.current = true;
            fetcher.submit(formData, {
              method: "post",
            });
          } catch (error: unknown) {
            const { handleAsyncErrorWithMessage, getErrorMessage } =
              await import("~/lib/error-handler.client");
            const errorMessage = `Upload failed: ${getErrorMessage(error)}`;
            handleAsyncErrorWithMessage(
              error,
              errorMessage,
              {
                component: "useBulkPostEvents",
                action: "prepareEvents",
              },
              false // Don't show toast, we set toast state instead
            );
            setToast({
              type: "error",
              message: errorMessage,
            });
            setTimeout(() => setToast(null), 5000);
            setIsPreviewSubmitting(false);
            return;
          }
        } else {
          // No files to upload, just proceed with existing URLs (for reposts/quotes)
          // Update progress - waiting for server
          setPreparationProgress?.({
            current: 1,
            total: 4,
            stage: "Processing...",
          });

          const formData = new FormData();
          formData.append("uploadResults", JSON.stringify([])); // Empty results for no uploads
          posts.forEach((post) => {
            formData.append("scheduledDates", post.scheduledFor);
            formData.append("queueTypes", post.queueType);
            formData.append("isRecyclable", post.isRecyclable.toString());
          });
          formData.append("_action", "_upload_images_preview");

          console.info(
            `[BulkPosts] Submitting to server (no uploads) at ${new Date().toISOString()}`
          );

          // Submit to server for processing
          isWaitingForUpload.current = true;
          fetcher.submit(formData, {
            method: "post",
          });
        }
      }
    } catch (error: unknown) {
      const { handleAsyncErrorWithMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "An error occurred while preparing posts. Please try again.",
        {
          component: "useBulkPostEvents",
          action: "prepareEvents",
        },
        false // Don't show toast, we set toast state instead
      );
      setToast({
        type: "error",
        message: "An error occurred while preparing posts. Please try again.",
      });

      // Hide toast after 5 seconds
      setTimeout(() => setToast(null), 5000);
      setIsPreviewSubmitting(false);
    }
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
      console.info(
        `[BulkPosts] Server response received at ${new Date().toISOString()}`
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

  return { prepareEvents };
}
