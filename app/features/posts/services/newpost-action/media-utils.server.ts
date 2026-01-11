/**
 * Media utility functions
 */

/**
 * Determine if a file URL is a video based on extension
 */
export function isVideoFile(fileUrl: string | string[]): boolean {
  const videoExtensions = [
    ".mp4",
    ".webm",
    ".ogg",
    ".mov",
    ".avi",
    ".mkv",
    ".m4v",
  ];

  const url = Array.isArray(fileUrl) ? fileUrl[0] : fileUrl;
  if (!url || typeof url !== "string") {
    return false;
  }

  const lowerUrl = url.toLowerCase();
  return videoExtensions.some((ext) => lowerUrl.endsWith(ext));
}
