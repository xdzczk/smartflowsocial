/**
 * Server-side validation utilities for Remix loader responses
 * Validates loader data before returning to ensure type safety
 */

import { z } from "zod";

import { ValidationError } from "~/lib/errors";

/**
 * Validate loader response data with Zod schema
 * Throws ValidationError if validation fails
 */
export function validateLoaderResponse<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T,
): z.infer<T> {
  try {
    return schema.parse(data);
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
  schema: T,
): z.infer<T> | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}



