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
 *   import { ... } from "./components/..."  // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type { Asset, AssetUploadOptions, AssetFetcher } from "./types";

// ============================================================================
// Asset Hooks
// ============================================================================

export { useAssetManagement } from "./useAssetManagement";

export { useAssetUpload } from "./useAssetUpload";

// ============================================================================
// Components (Public API)
// ============================================================================

export { AssetPagination } from "./components/AssetPagination";
export { AssetsTab } from "./components/AssetsTab";
export { UploadTab } from "./components/UploadTab";
export { default as AssetBrowser } from "./components/AssetBrowser";
