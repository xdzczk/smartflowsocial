/**
 * Upload Feature Public API
 *
 * This module exports the public API for file upload operations.
 * Internal implementation details are kept in components/ directory.
 *
 * Usage:
 *   import { uploadFileToS3, uploadFileToBlossom } from "~/features/upload";
 *
 * Do NOT import from internal paths like:
 *   import { ... } from "./components/..."  // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type { UploadResult } from "./types";

// ============================================================================
// S3 Upload (Server-side)
// ============================================================================

export {
  uploadBufferToS3,
  createS3Client,
  uploadEditorJSImage,
} from "./s3.server";

// ============================================================================
// Image Resize
// ============================================================================

export {
  processImageForWeb,
  getImageInfo,
  validateImageBuffer,
} from "./image-resize.server";

export { resizeImage as resizeImageClient } from "./image-resize";

// ============================================================================
// Client-side Upload
// ============================================================================

export { uploadFile, uploadMultipleFiles } from "./upload.client";
export {
  upload as uploadMedia,
  uploadMany as uploadMediaMany,
} from "./media.client";
export {
  UploadErrorCodes,
  type UploadErrorCode,
  defaultMessageForUploadError,
  inferUploadErrorCodeFromMessage,
  mapUnknownToUploadError,
  enrichFailedUploadResult,
} from "./upload-error-codes";
export {
  MEDIA_UPLOAD_ACCEPT_MIME,
  MEDIA_UPLOAD_MAX_IMAGE_BYTES,
  MEDIA_UPLOAD_MAX_VIDEO_BYTES,
  mediaUploadMaxBytesForVideo,
} from "./media-upload-limits";
export { preflightMediaUpload } from "./upload-preflight.client";
export type {
  PreflightFail,
  PreflightOk,
  PreflightResult,
} from "./upload-preflight.client";
export { logUploadFailure } from "./upload-failure-log.client";

// ============================================================================
// Blossom-aware Upload Hook
// ============================================================================

export { useBlossomAwareUpload } from "./useBlossomAwareUpload";
export {
  BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE,
  isBlossomMediaUploadBlocked,
} from "./blossom-upload-gate";
export { useBlossomUploadGate } from "./blossom-upload-gate-hook";

// ============================================================================
// Media metadata (Blossom uploads)
// ============================================================================

export {
  createMedia,
  createMediaIfMissing,
  listMediaForUser,
  getMediaAggregateForUser,
  getCanonicalOwnedBytesForUser,
  findMediaByIdForUser,
  deleteMediaById,
  deleteRemoteBlossomObject,
  type CreateMediaParams,
} from "./services/media.server";

export {
  issueBlossomBulkTokens,
  commitBlossomBatch,
  expireBlossomReservations,
  getActiveReservedBytesForPubkey,
  getBlossomReservationDriftStats,
  recordBlossomCompatUsage,
  type BulkTokenIssueResult,
  type CommitBatchResult,
  type CommitItem,
} from "./services/blossom-v2.server";

export {
  createMediaIngestIntent,
  commitMediaIngest,
  type MediaIntentFile,
  type MediaIntentResponse,
  type MediaCommitItem,
  type MediaCommitResponse,
} from "./services/media-ingest.server";

export {
  resolveMediaVariantUrl,
  getMediaAssetStatus,
} from "./services/media-delivery.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { BlossomMediaMirrorsSettings } from "./components/BlossomMediaMirrorsSettings";
export { UploadProviderSettings } from "./components/UploadProviderSettings";
