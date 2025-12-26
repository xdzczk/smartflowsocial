/**
 * Posts Feature Server Functions
 * 
 * This file re-exports all post-related server functions from their domain-specific modules.
 * This maintains backward compatibility while allowing better organization.
 * 
 * @deprecated Import directly from services/ subdirectory for better tree-shaking
 */

// Scheduled Posts
export {
  getScheduledDashboardData,
  handleScheduledPostAction,
} from "./services/scheduled-posts.server";

// Posted Posts
export { getPostedDashboardData } from "./services/posted-posts.server";

// Recyclable Posts
export {
  getRecyclableDashboardData,
  handleRecyclablePostAction,
} from "./services/recyclable-posts.server";

// Bulk Posts
export { getBulkPostsDashboardData } from "./services/bulk-posts.server";
