/**
 * Assets Feature Public API
 * 
 * This module exports the public API for asset management operations.
 * Internal implementation details are kept in components/ directory.
 * 
 * Usage:
 *   import { useAssetManagement, useAssetUpload } from "~/features/assets";
 * 
 * Do NOT import from internal paths like:
 *   import { ... } from "~/features/assets/components/..."  // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  Asset,
  AssetUploadOptions,
} from "./types";

// ============================================================================
// Asset Hooks
// ============================================================================

export {
  useAssetManagement,
} from "./useAssetManagement";

export {
  useAssetUpload,
} from "./useAssetUpload";



