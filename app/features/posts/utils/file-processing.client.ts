/**
 * File Processing Utilities
 * 
 * Client-side utilities for processing media files before upload.
 * Handles validation, size checking, and image resizing.
 */

import { toast } from "react-hot-toast";

import { resizeImage } from "~/features/upload/image-resize";
import { logClientError } from "~/lib/error-handler.client";

// File size limits
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos
export const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

/**
 * Check if a file type is acceptable (image or video)
 */
export function isAcceptableFile(file: File): boolean {
  const acceptedImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const acceptedVideoTypes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
  ];

  return (
    acceptedImageTypes.includes(file.type) ||
    acceptedVideoTypes.includes(file.type)
  );
}

/**
 * Validate file sizes
 * Returns array of error messages for oversized files
 */
export function validateFileSizes(files: File[]): string[] {
  const errors: string[] = [];

  for (const file of files) {
    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    const maxSizeMB = isImage ? 10 : 100;

    if (file.size > maxSize) {
      errors.push(`${file.name} exceeds ${maxSizeMB}MB limit`);
    }
  }

  return errors;
}

/**
 * Validate total size of files
 */
export function validateTotalSize(files: File[]): boolean {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return totalSize <= MAX_TOTAL_SIZE;
}

/**
 * Filter files to only acceptable types
 * Shows toast errors for invalid files
 */
export function filterAcceptableFiles(files: File[]): File[] {
  return files.filter((file) => {
    if (!isAcceptableFile(file)) {
      toast.error(`File type not supported: ${file.name}`);
      return false;
    }
    return true;
  });
}

/**
 * Process media files (resize images, leave videos as-is)
 * Returns processed files, falls back to original files on error
 */
export async function processMediaFiles(
  files: File[],
): Promise<{ processed: File[]; original: File[] }> {
  try {
    const processedFiles = await Promise.all(
      files.map(async (file) => {
        if (file.type.startsWith("image/")) {
          // Process images to remove metadata
          return await resizeImage(file);
        }
        // Videos are uploaded as-is (no processing needed)
        return file;
      }),
    );

    return {
      processed: processedFiles,
      original: files,
    };
  } catch (error) {
    logClientError(
      error instanceof Error ? error : new Error(String(error)),
      {
        component: "file-processing",
        action: "processMediaFiles",
        fileCount: files.length,
      },
    );
    toast.error("Error processing files. Using original files.");
    return {
      processed: files,
      original: files,
    };
  }
}

/**
 * Validate and process files for upload
 * Returns processed files or shows errors
 */
export async function validateAndProcessFiles(
  files: File[],
): Promise<File[] | null> {
  // Filter acceptable file types
  const validFiles = filterAcceptableFiles(files);
  if (validFiles.length === 0) {
    return null;
  }

  // Check individual file sizes
  const sizeErrors = validateFileSizes(validFiles);
  if (sizeErrors.length > 0) {
    sizeErrors.forEach((error) => toast.error(error));
    return null;
  }

  // Check total size
  if (!validateTotalSize(validFiles)) {
    toast.error("Total file size exceeds 100MB. Please select smaller files.");
    return null;
  }

  // Process files
  const { processed } = await processMediaFiles(validFiles);
  return processed;
}

