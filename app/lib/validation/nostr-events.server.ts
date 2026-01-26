/**
 * Validation utilities for Nostr events from Prisma JsonValue
 * Replaces unsafe type casts with runtime validation
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { logError } from "~/lib/error-logger.server";

import {
  nostrEventSchema,
  signedEventSchema,
} from "./schemas/nostr-events.schemas";

/**
 * Normalize tags array - converts objects with numeric keys back to arrays
 * This fixes an issue where Prisma JSON storage might serialize arrays as objects
 */
function normalizeTags(tags: unknown): string[][] {
  if (!tags) {
    return [];
  }

  // If it's already an array, validate and return
  if (Array.isArray(tags)) {
    return tags.map((tag) => {
      // If tag is already an array, return it
      if (Array.isArray(tag)) {
        return tag.map((item) => String(item));
      }
      // If tag is an object, try to convert it to an array
      if (typeof tag === "object" && tag !== null && !Array.isArray(tag)) {
        const tagObj = tag as Record<string, unknown>;
        // Convert object to array by iterating numeric keys
        const tagArray: string[] = [];
        let index = 0;
        while (String(index) in tagObj || index in tagObj) {
          const key = String(index) in tagObj ? String(index) : index;
          tagArray.push(String(tagObj[key] ?? ""));
          index++;
        }
        return tagArray;
      }
      // Fallback: convert to string array
      return [String(tag)];
    });
  }

  // If tags is an object (not an array), try to convert it
  // Note: tags is truthy here due to early return above, but we check typeof for type narrowing
  if (typeof tags === "object" && !Array.isArray(tags)) {
    const tagsObj = tags as Record<string, unknown>;
    const tagsArray: string[][] = [];
    let index = 0;
    while (String(index) in tagsObj || index in tagsObj) {
      const key = String(index) in tagsObj ? String(index) : index;
      const tag = tagsObj[key];
      if (Array.isArray(tag)) {
        tagsArray.push(tag.map((item) => String(item)));
      } else if (tag && typeof tag === "object" && !Array.isArray(tag)) {
        // Nested object - convert to array
        const tagObj = tag as Record<string, unknown>;
        const tagArray: string[] = [];
        let tagIndex = 0;
        while (String(tagIndex) in tagObj || tagIndex in tagObj) {
          const tagKey =
            String(tagIndex) in tagObj ? String(tagIndex) : tagIndex;
          tagArray.push(String(tagObj[tagKey] ?? ""));
          tagIndex++;
        }
        tagsArray.push(tagArray);
      } else {
        tagsArray.push([String(tag ?? "")]);
      }
      index++;
    }
    return tagsArray;
  }

  return [];
}

/**
 * Normalize event object - ensures tags are properly formatted as arrays
 */
function normalizeEvent(event: unknown): unknown {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return event;
  }

  const eventObj = event as Record<string, unknown>;
  const normalized = { ...eventObj };

  // Normalize tags if they exist
  if ("tags" in normalized) {
    normalized["tags"] = normalizeTags(normalized["tags"]);
  }

  return normalized;
}

/**
 * Safely validate and convert Prisma JsonValue to SignedEvent
 * Returns null if validation fails (logs error but doesn't throw)
 */
export function validateSignedEvent(
  value: Prisma.JsonValue | null | undefined
): z.infer<typeof signedEventSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    // Normalize tags before validation
    const normalized = normalizeEvent(value);
    return signedEventSchema.parse(normalized);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError(error, {
        message: "Invalid SignedEvent structure from Prisma",
        context: { issues: error.issues, value: JSON.stringify(value) },
      });
    }
    return null;
  }
}

/**
 * Safely validate and convert Prisma JsonValue to NostrEvent
 * Returns null if validation fails (logs error but doesn't throw)
 */
export function validateNostrEvent(
  value: Prisma.JsonValue | null | undefined
): z.infer<typeof nostrEventSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    // Normalize tags before validation
    const normalized = normalizeEvent(value);
    return nostrEventSchema.parse(normalized);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError(error, {
        message: "Invalid NostrEvent structure from Prisma",
        context: { issues: error.issues, value: JSON.stringify(value) },
      });
    }
    return null;
  }
}
