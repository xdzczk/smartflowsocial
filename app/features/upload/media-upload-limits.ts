/**
 * Shared client-side limits for image/video uploads across composer, bulk, and preflight.
 */

/** Accepted attachment MIME types (image/*, video/*) — same semantics as composer filter. */
export const MEDIA_UPLOAD_ACCEPT_MIME = /^image\/|^video\//;

export const MEDIA_UPLOAD_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MEDIA_UPLOAD_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function mediaUploadMaxBytesForVideo(isVideo: boolean): number {
  return isVideo ? MEDIA_UPLOAD_MAX_VIDEO_BYTES : MEDIA_UPLOAD_MAX_IMAGE_BYTES;
}
