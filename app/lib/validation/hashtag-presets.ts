/**
 * Client-safe validation utilities for HashTagPreset from loader responses
 * This file can be imported in both server and client code
 */

import type { HashTagPreset } from "~/features/posts/types";

import { hashTagPresetSchema } from "./schemas/loader-responses.schemas";

/**
 * Safely validate and convert unknown array to HashTagPreset[]
 * Returns empty array if validation fails (doesn't throw)
 * Normalizes createdAt/updatedAt from string | Date to Date | undefined
 * Client-safe version (no server-only logging)
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
        description: parsed.description,
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
    } catch {
      // Skip invalid items, continue with valid ones
      // Client-safe version doesn't log errors
    }
  }

  return validated;
}

