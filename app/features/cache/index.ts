/**
 * Cache Feature Public API
 * 
 * This module exports the public API for cache operations.
 * 
 * Usage:
 *   import { fetchFromCache } from "~/features/cache";
 * 
 * Do NOT import from internal paths:
 *   import { ... } from "~/features/cache/primalCache.server"  // ❌ Bad - use this module instead
 */

// ============================================================================
// Primal Cache
// ============================================================================

export {
  fetchFromCache,
} from "./primalCache.server";





