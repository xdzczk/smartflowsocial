/**
 * Zod schemas for queue job payloads
 *
 * These schemas validate job payloads at the queue boundary to ensure
 * type safety and backward compatibility across schema versions.
 */

import { z } from "zod";

/**
 * Schema for SignedEvent (Nostr event)
 */
const signedEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string(),
});

/**
 * Schema for PostJobData
 * Used for scheduled posts queue
 */
export const postJobDataSchema = z.object({
  postId: z.string().min(1, "postId is required"),
  userId: z.string().min(1, "userId is required"),
  signedEvent: signedEventSchema,
  correlationId: z.string().optional(),
  schemaVersion: z.string().optional(), // For versioning support
});

/**
 * Schema for LongFormPostJobData
 * Used for scheduled longform posts queue
 */
export const longFormPostJobDataSchema = z.object({
  postId: z.string().min(1, "postId is required"),
  userId: z.string().min(1, "userId is required"),
  signedEvent: signedEventSchema,
  correlationId: z.string().optional(),
  schemaVersion: z.string().optional(), // For versioning support
});

/**
 * Validate PostJobData payload
 * Returns validated data or throws ZodError
 */
export function validatePostJobData(
  data: unknown
): z.infer<typeof postJobDataSchema> {
  return postJobDataSchema.parse(data);
}

/**
 * Validate PostJobData payload safely
 * Returns result object with success flag
 */
export function safeValidatePostJobData(data: unknown):
  | {
      success: true;
      data: z.infer<typeof postJobDataSchema>;
    }
  | {
      success: false;
      error: z.ZodError;
    } {
  const result = postJobDataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate LongFormPostJobData payload
 * Returns validated data or throws ZodError
 */
export function validateLongFormPostJobData(
  data: unknown
): z.infer<typeof longFormPostJobDataSchema> {
  return longFormPostJobDataSchema.parse(data);
}

/**
 * Validate LongFormPostJobData payload safely
 * Returns result object with success flag
 */
export function safeValidateLongFormPostJobData(data: unknown):
  | {
      success: true;
      data: z.infer<typeof longFormPostJobDataSchema>;
    }
  | {
      success: false;
      error: z.ZodError;
    } {
  const result = longFormPostJobDataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
