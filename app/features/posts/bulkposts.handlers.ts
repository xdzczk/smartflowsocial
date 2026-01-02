/**
 * Handler functions for Bulk Posts feature
 *
 * This file re-exports all handlers from their individual modules.
 * This maintains backward compatibility while allowing better organization.
 *
 * @deprecated Import directly from handlers/ subdirectory for better tree-shaking
 */

// Re-export types for consumers
export type { QueueType, BulkPostsHandlerDeps } from "~/features/posts/types";

// File upload handler
export { handleFileChange } from "./handlers/file-upload.handler";

// Post state handlers
export {
  handleCaptionChange,
  handleDateChange,
  handleRemovePost,
} from "./handlers/post-state.handler";

// Recyclable handlers
export {
  handleIsRecyclableChange,
  handleBulkRecyclableToggle,
} from "./handlers/recyclable.handler";

// Schedule interval handler
export { handleScheduleIntervalClick } from "./handlers/schedule-interval.handler";

// Hashtag handler
export { updateDisplayedHashtags } from "./handlers/hashtag.handler";

// Queue type handlers
export {
  handleQueueTypeChange,
  handleBulkQueueUpdate,
} from "./handlers/queue-type.handler";
