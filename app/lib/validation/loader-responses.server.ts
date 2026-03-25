/**
 * Server-side validation utilities for Remix loader responses
 * Validates loader data before returning to ensure type safety
 */

import { z } from "zod";

import { ValidationError } from "~/lib/errors";
import { normalizeLoaderResponseData } from "~/lib/validation/normalize-loader-response-data";

/**
 * Validate loader response data with Zod schema
 * Throws ValidationError if validation fails
 *
 * Note: This function normalizes malformed tags in events before validation
 * to handle cases where Prisma JSON storage serializes arrays as objects
 */
export function validateLoaderResponse<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T
): z.infer<T> {
  try {
    // Normalize data before validation to fix malformed tags
    const normalizedData = normalizeLoaderResponseData(data);
    return schema.parse(normalizedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));
      throw new ValidationError("Loader response validation failed", {
        errors: errorDetails,
      });
    }
    throw error;
  }
}

/**
 * Safe validate loader response - returns validated data or null if validation fails
 * Use this when you want to handle validation errors gracefully
 */
export function safeValidateLoaderResponse<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T
): z.infer<T> | null {
  try {
    const normalizedData = normalizeLoaderResponseData(data);
    return schema.parse(normalizedData);
  } catch {
    return null;
  }
}
