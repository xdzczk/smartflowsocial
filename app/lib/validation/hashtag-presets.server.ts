/**
 * Validation utilities for HashTagPreset from loader responses
 * Replaces unsafe type casts with runtime validation
 */

import { z } from "zod";

import { logError } from "~/lib/error-logger.server";
import type { HashTagPreset } from "~/features/posts/types";

import { hashTagPresetSchema } from "./schemas/loader-responses.schemas";

/**
 * Safely validate and convert unknown array to HashTagPreset[]
 * Returns empty array if validation fails (logs error but doesn't throw)
 * Normalizes createdAt/updatedAt from string | Date to Date | undefined
 */
export function validateHashTagPresets(
  value: unknown,
): HashTagPreset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validated: HashTagPreset[] = [];
  
  for (const item of value) {
    try {
      const parsed = hashTagPresetSchema.parse(item);
      // Normalize createdAt/updatedAt from string | Date to Date | undefined
      validated.push({
        id: parsed.id,
        name: parsed.name,
        tags: parsed.tags,
        description: parsed.description ?? undefined,
        userId: parsed.userId,
        createdAt: parsed.createdAt instanceof Date 
          ? parsed.createdAt 
          : typeof parsed.createdAt === "string" 
            ? new Date(parsed.createdAt) 
            : undefined,
        updatedAt: parsed.updatedAt instanceof Date 
          ? parsed.updatedAt 
          : typeof parsed.updatedAt === "string" 
            ? new Date(parsed.updatedAt) 
            : undefined,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logError(error, {
          message: "Invalid HashTagPreset structure in array",
          context: { issues: error.issues, item: JSON.stringify(item) },
        });
      }
      // Skip invalid items, continue with valid ones
    }
  }

  return validated;
}

