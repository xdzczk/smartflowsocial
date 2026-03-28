export type MediaClass = "image" | "video" | "unknown";

export interface MediaPolicyInput {
  mimeType: string;
  sizeBytes: number;
}

export interface MediaPolicyResult {
  allowed: boolean;
  reason?: string;
  mediaClass: MediaClass;
  maxBytes: number;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

function detectMediaClass(mimeType: string): MediaClass {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "unknown";
}

export function evaluateMediaPolicy(
  input: MediaPolicyInput
): MediaPolicyResult {
  const mediaClass = detectMediaClass(input.mimeType);

  if (mediaClass === "image") {
    if (!ALLOWED_IMAGE_TYPES.has(input.mimeType)) {
      return {
        allowed: false,
        reason: "unsupported_image_type",
        mediaClass,
        maxBytes: MAX_IMAGE_BYTES,
      };
    }
    if (input.sizeBytes > MAX_IMAGE_BYTES) {
      return {
        allowed: false,
        reason: "image_too_large",
        mediaClass,
        maxBytes: MAX_IMAGE_BYTES,
      };
    }
    return { allowed: true, mediaClass, maxBytes: MAX_IMAGE_BYTES };
  }

  if (mediaClass === "video") {
    if (!ALLOWED_VIDEO_TYPES.has(input.mimeType)) {
      return {
        allowed: false,
        reason: "unsupported_video_type",
        mediaClass,
        maxBytes: MAX_VIDEO_BYTES,
      };
    }
    if (input.sizeBytes > MAX_VIDEO_BYTES) {
      return {
        allowed: false,
        reason: "video_too_large",
        mediaClass,
        maxBytes: MAX_VIDEO_BYTES,
      };
    }
    return { allowed: true, mediaClass, maxBytes: MAX_VIDEO_BYTES };
  }

  return {
    allowed: false,
    reason: "unsupported_media_type",
    mediaClass: "unknown",
    maxBytes: 0,
  };
}
