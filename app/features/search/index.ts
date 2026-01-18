/**
 * Search Feature Public API
 *
 * This module exports the public API for search-related operations.
 * Internal implementation details are kept in services/, hooks/, and components/ directories.
 *
 * Usage:
 *   import { handleSearchAction } from "~/features/search";
 *
 * Do NOT import from internal paths like:
 *   import { ... } from "./services/..."  // ❌ Bad
 *   import { ... } from "./hooks/..."      // ❌ Bad
 */

// ============================================================================
// Search Actions
// ============================================================================

export { handleSearchEvent as handleSearchAction } from "./services/search-action.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { SearchForm } from "./components/SearchForm";
export { SearchResult } from "./components/SearchResult";
export { SearchToast } from "./components/SearchToast";
export { default as SearchPostsPage } from "./components/SearchPostsPage";

// ============================================================================
// Hooks (Public API)
// ============================================================================

export { useSearchState } from "./hooks/useSearchState";

// ============================================================================
// Loaders (Public API)
// ============================================================================

export { loadSearchData } from "./services/search-loader.server";
