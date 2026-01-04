/**
 * Validation module exports
 * Central entry point for all validation schemas and utilities
 */

// Settings schemas (server-side)
export * from "./schemas/settings.schemas";

// Settings schemas (client-side, optimized for React Hook Form)
export * from "./schemas/settings.client.schemas";

// Post schemas (excluding postActionSchema to avoid conflict with posts-actions.schemas)
// Note: postActionSchema is exported from posts-actions.schemas.ts
export {
  textPostSchema,
  imagePostSchema,
  longformPostSchema,
  bulkPostSchema,
  newPostActionSchema,
  newLongformPostActionSchema,
  bulkPostsActionSchema,
  uploadImagesPreviewSchema,
  signAndScheduleSchema,
  saveAsDraftSchema,
} from "./schemas/posts.schemas";

// Post client schemas
export * from "./schemas/posts.client.schemas";
export { draftEditClientSchema } from "./schemas/posts.client.schemas";

// Post action schemas (includes postActionSchema)
export * from "./schemas/posts-actions.schemas";

// Post action client schemas
export * from "./schemas/posts-actions.client.schemas";

// Search client schemas
export * from "./schemas/search.client.schemas";

// Template schemas
export * from "./schemas/templates.schemas";

// Payment schemas
export * from "./schemas/payments.schemas";

// Server-side validation utilities
export * from "./utils.server";

// Client-side validation utilities
// Note: Do not re-export client-only utilities through index.ts to avoid bundling issues
// Import directly from "./utils.client" in client components
// export * from "./utils.client";

// React Hook Form hooks
export * from "./hooks/useRemixForm";

