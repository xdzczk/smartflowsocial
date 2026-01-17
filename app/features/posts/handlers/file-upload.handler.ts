/**
 * File Upload Handler for Bulk Posts
 *
 * Handles file selection, validation, and processing for bulk uploads
 */

import { resizeImage } from "~/features/upload/image-resize";
import { logClientError } from "~/lib/error-handler.client";
import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";
import { isVideoFile } from "~/utils/media-helpers";

import type { BulkPostsHandlerDeps } from "../types";
// File size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

/**
 * Handle file selection and processing for bulk uploads
 */
export async function handleFileChange(
  e: React.ChangeEvent<HTMLInputElement>,
  deps: Pick<
    BulkPostsHandlerDeps,
    | "posts"
    | "setPosts"
    | "user"
    | "scheduleIntervals"
    | "setIsProcessing"
    | "setProcessingProgress"
    | "setFirstItemTimeManuallyChanged"
  >
): Promise<void> {
  const {
    posts,
    setPosts,
    user,
    scheduleIntervals,
    setIsProcessing,
    setProcessingProgress,
    setFirstItemTimeManuallyChanged,
  } = deps;
  const selectedFiles = Array.from(e.target.files ?? []);

  // Check total size
  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    alert("Total file size exceeds 100MB. Please select smaller files.");
    return Promise.resolve();
  }

  // Check individual file size limits
  for (const file of selectedFiles) {
    const isVideo = isVideoFile(file);
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      alert(
        `Video file ${file.name} exceeds 100MB limit. Please select a smaller file.`
      );
      return Promise.resolve();
    } else if (!isVideo && file.size > MAX_IMAGE_SIZE) {
      alert(
        `Image file ${file.name} exceeds 10MB limit. Please select a smaller file.`
      );
      return Promise.resolve();
    }
  }

  setIsProcessing(true);
  setProcessingProgress({ current: 0, total: selectedFiles.length });

  // Process files in chunks to prevent memory overload
  const CHUNK_SIZE = 10;
  const processedFiles: File[] = [];

  try {
    for (let i = 0; i < selectedFiles.length; i += CHUNK_SIZE) {
      const chunk = selectedFiles.slice(i, i + CHUNK_SIZE);
      const chunkProcessed = await Promise.all(
        chunk.map(async (file) => {
          // For image files, resize and process. For video files, use as is.
          if (isVideoFile(file)) {
            return file; // Return video files as-is
          } else {
            // Process image files - resize and remove metadata
            return await resizeImage(file);
          }
        })
      );
      processedFiles.push(...chunkProcessed);

      // Update progress
      setProcessingProgress({
        current: i + chunk.length,
        total: selectedFiles.length,
      });

      // Allow browser to breathe between chunks
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    logClientError(error instanceof Error ? error : new Error(String(error)), {
      component: "bulkposts",
      action: "handleFileChange",
      fileCount: selectedFiles.length,
    });
    alert("Error processing media files. Please try again.");
    setIsProcessing(false);
    return Promise.resolve();
  }

  const newPosts = processedFiles.map((file, index) => {
    // Get current date in user's timezone using Temporal
    const userTimezone = user?.timezone ?? "UTC";
    const now = nowInTimezone(userTimezone);

    // Add index+4 hours to schedule 4 post per hour (default)
    const hoursToAdd = index + Number(scheduleIntervals?.[0] ?? 4);
    const scheduledZoned = addHours(now, hoursToAdd);

    // Format for datetime-local input
    const scheduledFor = formatForDateTimeLocal(scheduledZoned, userTimezone);

    return {
      file,
      caption: "",
      queueType: "unassigned",
      isRecyclable: false,
      scheduledFor,
    };
  });

  setPosts([...posts, ...newPosts]);
  setIsProcessing(false);
  // Reset flag when new files are uploaded
  setFirstItemTimeManuallyChanged(false);
}
