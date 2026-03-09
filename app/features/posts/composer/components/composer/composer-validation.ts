/**
 * Composer-specific validation helpers.
 * Schema lives in ~/lib/validation; this module adds reusable validators and messages.
 */

export const COMPOSER_CONTENT_REQUIRED = "Post content cannot be empty";
export const COMPOSER_SCHEDULE_FUTURE = "Schedule time must be in the future.";
export const COMPOSER_UPLOAD_WAIT = "Please wait for uploads to finish.";
export const COMPOSER_REMOVE_FAILED_ATTACHMENTS =
  "Remove or retry failed attachments before publishing.";

/** Validate content is non-empty (for single post submit). */
export function validateContentRequired(content: string): string | null {
  if (!content.trim()) return COMPOSER_CONTENT_REQUIRED;
  return null;
}

/** Validate scheduled time is in the future (unix ms). */
export function validateScheduleFuture(scheduledUnixMs: number): string | null {
  if (scheduledUnixMs < Date.now()) return COMPOSER_SCHEDULE_FUTURE;
  return null;
}
