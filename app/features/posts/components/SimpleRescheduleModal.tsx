import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

import { signEventFn } from "~/lib/nostr";
import { handleErrorSafely } from "~/lib/error-handler.client";
import type { PostData, LongFormPostData, UserData, QueueType } from "~/features/posts/types";

interface SimpleRescheduleModalProps {
  post: PostData | LongFormPostData;
  onClose: () => void;
  onConfirm: () => void;
  user?: UserData;
  queueTypes?: QueueType[];
}

export function SimpleRescheduleModal({
  post,
  onClose,
  onConfirm,
  user,
  queueTypes = [],
}: SimpleRescheduleModalProps) {
  const fetcher = useFetcher();
  const [isSigningEvent, setIsSigningEvent] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [selectedQueueType, setSelectedQueueType] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Determine if this is a longform post
  const isLongform = post?.title !== undefined;

  useEffect(() => {
    if (post) {
      if (isLongform) {
        setScheduledFor(post.publishedAt ? new Date(post.publishedAt) : null);
      } else {
        setScheduledFor(
          post.scheduledFor
            ? new Date(parseInt(post.scheduledFor) * 1000)
            : null,
        );
        setSelectedQueueType(post.queueType?.id || "");
      }
    }
  }, [post, isLongform]);

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.needsSigning) {
        return; // Keep modal open for re-signing
      }
      onConfirm();
    }
    if (fetcher.data?.error) {
      setSigningError(fetcher.data.error);
    }
  }, [fetcher.data, onConfirm]);

  const formatDateTimeForInput = (date: Date) => {
    const userTimezone = user?.timezone || "UTC";
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

  const validateDateTime = (dateTime: Date | null) => {
    if (!dateTime) {
      setValidationError("Please select a date and time");
      return false;
    }

    const now = new Date();
    const userTimezone = user?.timezone || "UTC";
    const nowInUserTz = new Date(
      now.toLocaleString("en-US", { timeZone: userTimezone }),
    );

    if (dateTime <= nowInUserTz) {
      setValidationError("Cannot schedule posts in the past");
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value ? new Date(e.target.value) : null;
    setScheduledFor(newValue);
    validateDateTime(newValue);
  };

  const handleSubmit = async () => {
    if (!post || !scheduledFor) return;

    if (!validateDateTime(scheduledFor)) {
      return;
    }

    try {
      setIsSigningEvent(true);
      setSigningError(null);

      const newTimeUnix = Math.floor(scheduledFor.getTime() / 1000);

      // Use the exact same content and tags from the original signed event
      const originalSignedEvent = post.signedEvent;
      const originalNostrEvent = post.nostrEvent;

      if (!originalSignedEvent || !originalNostrEvent) {
        throw new Error(
          "Original event not found. Cannot reschedule unsigned posts.",
        );
      }

      // Re-sign with the same content but new timestamp
      const { nostrEvent, signedEvent } = await signEventFn({
        content: originalSignedEvent.content, // Use exact same content
        created_at: newTimeUnix, // Only change the timestamp
        kind: originalSignedEvent.kind || (isLongform ? 30023 : 1),
        tags: originalSignedEvent.tags || [], // Use exact same tags
      });

      // Submit the reschedule action with signed event
      const formData = new FormData();
      formData.append(
        "_action",
        isLongform ? "rescheduleLongform" : "reschedule",
      );
      formData.append("postId", post.id);
      formData.append("newTime", newTimeUnix.toString());
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("nostrEvent", JSON.stringify(nostrEvent));

      if (!isLongform) {
        formData.append("overrideQueue", "false");
        if (selectedQueueType) {
          formData.append("queueTypeId", selectedQueueType);
        }
      }

      fetcher.submit(formData, { method: "post" });
    } catch (error: unknown) {
      const { handleAsyncErrorWithMessage, getErrorMessage } = await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "Failed to sign event. Please try again.",
        {
          component: "SimpleRescheduleModal",
          action: "handleReschedule",
        },
        false, // Don't show toast, we set signingError instead
      );
      setIsSigningEvent(false);
      setSigningError(getErrorMessage(error) || "Failed to sign event. Please try again.");
    }
  };

  const getFirstImage = () => {
    if (post?.fileUrl && post.fileUrl.length > 0) {
      try {
        const firstFileUrl = post.fileUrl[0];
        if (typeof firstFileUrl === "string") {
          try {
            const parsed = JSON.parse(firstFileUrl);
            return Array.isArray(parsed) ? parsed[0] : firstFileUrl;
          } catch {
            return firstFileUrl;
          }
        }
        return firstFileUrl;
      } catch (error) {
        handleErrorSafely(error, {
          component: "SimpleRescheduleModal",
          action: "getFirstImage",
        });
        return null;
      }
    }
    return null;
  };

  const formatDateTime = (date: Date) => {
    const userTimezone = user?.timezone || "UTC";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: userTimezone,
    });
  };

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Reschedule {isLongform ? "Article" : "Post"}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {/* Post preview */}
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <div className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                {isLongform ? "Article" : "Post"} Preview:
              </div>

              {/* Show image thumbnail if available */}
              {getFirstImage() ? (
                <div className="mb-2">
                  <div className="h-20 w-full overflow-hidden rounded-md">
                    <img
                      src={getFirstImage()!}
                      alt="Post preview"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              ) : null}

              <div className="text-sm text-gray-600 dark:text-gray-300">
                {isLongform
                  ? post.title || "Untitled Article"
                  : post.caption || "No caption"}
                {post.fileUrl && post.fileUrl.length > 0 ? (
                  <span className="ml-2 text-xs text-gray-500">
                    ({post.fileUrl.length} file
                    {post.fileUrl.length > 1 ? "s" : ""})
                  </span>
                ) : null}
              </div>
            </div>

            {/* New time */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                New scheduled time:
              </label>
              <div className="flex items-center space-x-2">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <input
                  type="datetime-local"
                  value={
                    scheduledFor ? formatDateTimeForInput(scheduledFor) : ""
                  }
                  onChange={handleDateTimeChange}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              {scheduledFor ? (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(scheduledFor)}
                </div>
              ) : null}
            </div>

            {/* Queue Type Selection for regular posts */}
            {!isLongform ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Queue Type:
                </label>
                <select
                  value={selectedQueueType}
                  onChange={(e) => setSelectedQueueType(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Manual (No Queue)</option>
                  {queueTypes.map((queueType) => (
                    <option key={queueType.id} value={queueType.id}>
                      {queueType.name}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedQueueType
                    ? "Post will be managed by the selected queue type"
                    : "Post will be manually scheduled"}
                </div>
              </div>
            ) : null}

            {/* Re-signing warning */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="flex items-start space-x-2">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Rescheduling this {isLongform ? "article" : "post"} requires
                    re-signing the Nostr event
                  </div>
                </div>
              </div>
            </div>

            {/* Validation error */}
            {validationError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <div className="text-sm text-red-800 dark:text-red-200">
                  {validationError}
                </div>
              </div>
            ) : null}

            {/* Error display */}
            {fetcher.data?.error || signingError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <div className="text-sm text-red-800 dark:text-red-200">
                  {fetcher.data?.error || signingError}
                </div>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                fetcher.state === "submitting" ||
                isSigningEvent ||
                !!validationError
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningEvent
                ? "Signing Event..."
                : fetcher.state === "submitting"
                  ? "Rescheduling..."
                  : "Confirm Reschedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
