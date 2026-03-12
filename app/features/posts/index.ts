/**
 * Posts Feature Public API
 *
 * This module re-exports from server.ts and ui.ts for backward compatibility.
 * For better tree-shaking and clearer boundaries, prefer:
 *   - import { ... } from "~/features/posts/server" for server-side code
 *   - import { ... } from "~/features/posts/ui" for client-side code
 *
 * Usage:
 *   import { loadDashboardData } from "~/features/posts/server";
 *   import { loadScheduledData } from "~/features/posts/server/scheduling";
 *   import { AllContentListing } from "~/features/posts/ui";
 *
 * Legacy usage (still works but not recommended):
 *   import { getScheduledDashboardData, AllContentListing } from "~/features/posts";
 */

// Re-export everything from server and ui modules
// This maintains backward compatibility while encouraging better import patterns
export * from "./server";
export * from "./ui";
