/**
 * Upload preview handler
 * Handles preview actions for file uploads
 */

export interface UploadPreviewResult {
  success: boolean;
  fileUrls?: string[];
  error?: string;
}

/**
 * Handle upload preview action
 */
export function handleUploadPreview(formData: FormData): UploadPreviewResult {
  const files = formData.getAll("files");
  const scheduledForValue = formData.get("scheduledFor");
  const captionValue = formData.get("caption");
  const queueTypeValue = formData.get("queueType");

  const scheduledFor = scheduledForValue ? String(scheduledForValue) : null;
  const caption = captionValue ? String(captionValue) : null;
  const queueType = queueTypeValue ? String(queueTypeValue) : null;

  // Validate files are not empty and are valid URLs
  const hasValidFiles = files.some((file) => {
    try {
      const fileStr =
        typeof file === "string"
          ? file
          : file instanceof File
            ? file.name
            : String(file);
      new URL(fileStr); // Check if valid URL
      return true;
    } catch {
      return false;
    }
  });

  if (!hasValidFiles) {
    return {
      success: false,
      error: "Upload failed, please try again",
    };
  }

  const fileUrls: Array<{
    fileUrl: string;
    scheduledFor: string | null;
    caption: string | null;
    queueType: string | null;
  }> = files.map((fileUrl) => {
    const fileUrlStr =
      typeof fileUrl === "string"
        ? fileUrl
        : fileUrl instanceof File
          ? fileUrl.name
          : String(fileUrl);
    return {
      fileUrl: fileUrlStr,
      scheduledFor,
      caption,
      queueType,
    };
  });

  return { success: true, fileUrls: fileUrls.map((f) => f.fileUrl) };
}
