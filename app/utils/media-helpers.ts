/**
 * Media file type detection utilities
 * Extracted from dashboard.bulkposts.tsx for reusability
 */

const VIDEO_MIME_TYPES = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "video/avi",
    "video/x-msvideo",
    "video/mkv",
    "video/x-matroska",
    "video/3gpp",
    "video/x-flv",
];

const VIDEO_EXTENSIONS = [
    ".mp4",
    ".webm",
    ".ogg",
    ".mov",
    ".avi",
    ".mkv",
    ".m4v",
    ".3gp",
    ".flv",
];

const VIDEO_EXTENSION_REGEX = /\.(mp4|webm|ogg|mov|avi|mkv|m4v|3gp|flv)$/i;

/**
 * Detect if a file is a video based on MIME type or file extension
 */
export function isVideoFile(file: File | null | undefined): boolean {
    if (!file) return false;
    return (
        VIDEO_MIME_TYPES.includes(file.type) || VIDEO_EXTENSION_REGEX.test(file.name)
    );
}

/**
 * Detect if a URL points to a video file based on extension
 */
export function isVideoUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => lowerUrl.includes(ext));
}

/**
 * Get the post type based on file or URL
 */
export function getPostType(
    file?: File | null,
    url?: string | null
): "VIDEO" | "IMAGE" {
    if (file && isVideoFile(file)) return "VIDEO";
    if (url && isVideoUrl(url)) return "VIDEO";
    return "IMAGE";
}
