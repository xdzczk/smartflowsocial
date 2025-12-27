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
 *   import { ... } from "~/features/upload/components/..."  // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  UploadResult,
} from "./types";

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

export {
  resizeImage as resizeImageClient,
} from "./image-resize";

// ============================================================================
// Client-side Upload
// ============================================================================

export {
  uploadFile,
  uploadMultipleFiles,
} from "./upload.client";

// ============================================================================
// Blossom-aware Upload Hook
// ============================================================================

export {
  useBlossomAwareUpload,
} from "./useBlossomAwareUpload";

// ============================================================================
// Components (Public API)
// ============================================================================

export { BlossomMediaMirrorsSettings } from "./components/BlossomMediaMirrorsSettings";
export { UploadProviderSettings } from "./components/UploadProviderSettings";

