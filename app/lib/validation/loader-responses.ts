/**
 * Client-safe validation utilities for Remix loader responses
 * This file can be imported in both server and client code
 */

import type { z } from "zod";

import { normalizeLoaderResponseData } from "~/lib/validation/normalize-loader-response-data";

/**
 * Safe validate loader response - returns validated data or null if validation fails
 * Use this when you want to handle validation errors gracefully
 * This version is safe to use in client-side code
 *
 * Normalizes loader payloads the same way as server-side validation so client checks
 * do not reject valid data due to Prisma JSON tag quirks on nested events.
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
