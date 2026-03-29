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

// ============================================================================
// Blossom-aware Upload Hook
// ============================================================================

export { useBlossomAwareUpload } from "./useBlossomAwareUpload";
export {
  BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE,
  isBlossomMediaUploadBlocked,
  useBlossomUploadGate,
} from "./blossom-upload-gate.client";

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
