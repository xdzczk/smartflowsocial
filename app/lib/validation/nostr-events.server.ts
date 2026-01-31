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
 * Normalize a single tag element - converts object to array
 */
function normalizeTagElement(tag: unknown): string[] {
  // If already an array, return as string array
  if (Array.isArray(tag)) {
    return tag.map((item) => String(item));
  }

  // If it's an object, convert to array
  if (typeof tag === "object" && tag !== null && !Array.isArray(tag)) {
    const tagObj = tag as Record<string, unknown>;
    const keys = Object.keys(tagObj);

    // Try numeric keys first (most common case: { "0": "t", "1": "hashtag" })
    const numericKeys = keys
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    if (numericKeys.length > 0 && numericKeys[0] === 0) {
      // Check if keys are sequential (0, 1, 2, ...)
      const lastKey = numericKeys[numericKeys.length - 1];
      if (lastKey !== undefined) {
        const isSequential =
          numericKeys.length === lastKey + 1 &&
          numericKeys.every((n, i) => n === i);
        if (isSequential) {
          return numericKeys.map((n) => String(tagObj[String(n)] ?? ""));
        }
      }
    }

    // Fallback: convert all values to array (preserve order if possible)
    return Object.values(tagObj).map((item) => String(item ?? ""));
  }

  // Fallback: convert to string array
  return [String(tag ?? "")];
}

/**
 * Normalize tags array - converts objects with numeric keys back to arrays
 * This fixes an issue where Prisma JSON storage might serialize arrays as objects
 */
function normalizeTags(tags: unknown): string[][] {
  if (!tags) {
    return [];
  }

  // If it's already an array, normalize each element
  if (Array.isArray(tags)) {
    return tags.map((tag) => normalizeTagElement(tag));
  }

  // If tags is an object (not an array), try to convert it
  // Note: tags is truthy here due to early return above, but we check typeof for type narrowing
  if (typeof tags === "object" && !Array.isArray(tags)) {
    const tagsObj = tags as Record<string, unknown>;
    const keys = Object.keys(tagsObj);

    // Try numeric keys first
    const numericKeys = keys
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    if (numericKeys.length > 0 && numericKeys[0] === 0) {
      // Check if keys are sequential
      const lastKey = numericKeys[numericKeys.length - 1];
      if (lastKey !== undefined) {
        const isSequential =
          numericKeys.length === lastKey + 1 &&
          numericKeys.every((n, i) => n === i);
        if (isSequential) {
          return numericKeys.map((n) =>
            normalizeTagElement(tagsObj[String(n)])
          );
        }
      }
    }

    // Fallback: convert all values to array of arrays
    return Object.values(tagsObj).map((tag) => normalizeTagElement(tag));
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
 * Recursively normalize all events in a data structure
 * This is used to normalize loader response data before validation
 * Preserves Date objects and other non-event data
 * Only normalizes objects that contain signedEvent or nostrEvent fields
 */
export function normalizeLoaderResponseData(data: unknown): unknown {
  // Preserve primitives, null, and Date objects
  if (!data || typeof data !== "object") {
    return data;
  }

  // Preserve Date objects as-is
  if (data instanceof Date) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => normalizeLoaderResponseData(item));
  }

  const obj = data as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Preserve Date objects
    if (value instanceof Date) {
      normalized[key] = value;
    } else if (key === "signedEvent" || key === "nostrEvent") {
      // Normalize event objects
      normalized[key] = normalizeEvent(value);
    } else if (
      key === "scheduledPosts" ||
      key === "posts" ||
      key === "longformPosts" ||
      key === "pastPosts" ||
      key === "scheduledLongFormPosts" ||
      key === "pastLongFormPosts"
    ) {
      // Recursively normalize arrays of posts - these always need to be checked
      if (Array.isArray(value)) {
        normalized[key] = value.map((post) => {
          if (
            post &&
            typeof post === "object" &&
            !Array.isArray(post) &&
            !(post instanceof Date)
          ) {
            const postObj = post as Record<string, unknown>;
            const normalizedPost: Record<string, unknown> = {};
            // Copy all properties, preserving Date objects
            for (const [postKey, postValue] of Object.entries(postObj)) {
              if (postValue instanceof Date) {
                normalizedPost[postKey] = postValue;
              } else if (
                postKey === "signedEvent" ||
                postKey === "nostrEvent"
              ) {
                // Normalize event objects within posts
                normalizedPost[postKey] = normalizeEvent(postValue);
              } else {
                normalizedPost[postKey] = postValue;
              }
            }
            return normalizedPost;
          }
          return post;
        });
      } else {
        normalized[key] = value;
      }
    } else if (key === "flowItems") {
      // Flow items: array of { type, data } where data has signedEvent/nostrEvent
      if (Array.isArray(value)) {
        normalized[key] = value.map((item) => {
          if (
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            "data" in item &&
            (item as Record<string, unknown>)["data"] &&
            typeof (item as Record<string, unknown>)["data"] === "object"
          ) {
            const itemObj = item as Record<string, unknown>;
            const dataObj = itemObj["data"] as Record<string, unknown>;
            const normalizedData: Record<string, unknown> = {};
            for (const [dataKey, dataValue] of Object.entries(dataObj)) {
              if (dataValue instanceof Date) {
                normalizedData[dataKey] = dataValue;
              } else if (
                dataKey === "signedEvent" ||
                dataKey === "nostrEvent"
              ) {
                normalizedData[dataKey] = normalizeEvent(dataValue);
              } else {
                normalizedData[dataKey] = dataValue;
              }
            }
            return { ...itemObj, data: normalizedData };
          }
          return item;
        });
      } else {
        normalized[key] = value;
      }
    } else {
      // For other fields, check if they need normalization
      // Check if this is an object that might contain events
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        const valueObj = value as Record<string, unknown>;
        // Recursively normalize if it has event fields or contains post arrays
        if (
          "signedEvent" in valueObj ||
          "nostrEvent" in valueObj ||
          "pastPosts" in valueObj ||
          "scheduledPosts" in valueObj ||
          "posts" in valueObj ||
          "longformPosts" in valueObj ||
          "scheduledLongFormPosts" in valueObj ||
          "pastLongFormPosts" in valueObj
        ) {
          normalized[key] = normalizeLoaderResponseData(value);
        } else {
          // Preserve objects without event fields (like user, hashTagPresets, etc.)
          normalized[key] = value;
        }
      } else {
        // Preserve other values as-is (primitives, arrays that aren't post arrays, etc.)
        normalized[key] = value;
      }
    }
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
