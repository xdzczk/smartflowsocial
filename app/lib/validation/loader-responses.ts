/**
 * Client-safe validation utilities for Remix loader responses
 * This file can be imported in both server and client code
 */

import type { z } from "zod";

/**
 * Safe validate loader response - returns validated data or null if validation fails
 * Use this when you want to handle validation errors gracefully
 * This version is safe to use in client-side code
 */
export function safeValidateLoaderResponse<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T
): z.infer<T> | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}
