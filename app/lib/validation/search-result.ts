/**
 * Client-safe validation utilities for search result data
 * This file can be imported in both server and client code
 */

import type { z } from "zod";

import {
  searchResultDataSchema,
  searchResultDisplaySchema,
  searchStatsSchema,
} from "./schemas/search-result.schemas";

/**
 * Safely validate and convert search result data from fetcher
 * Returns null if validation fails
 * Client-safe version (no server-only logging)
 */
export function validateSearchResultData(
  value: unknown
): z.infer<typeof searchResultDataSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return searchResultDataSchema.parse(value);
  } catch {
    // Client-safe version doesn't log errors
    return null;
  }
}

/**
 * Safely validate and convert search result display data
 * Returns null if validation fails
 * Client-safe version (no server-only logging)
 */
export function validateSearchResultDisplay(
  value: unknown
): z.infer<typeof searchResultDisplaySchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return searchResultDisplaySchema.parse(value);
  } catch {
    // Client-safe version doesn't log errors
    return null;
  }
}

/**
 * Safely validate and convert search stats
 * Returns null if validation fails
 * Client-safe version (no server-only logging)
 */
export function validateSearchStats(
  value: unknown
): z.infer<typeof searchStatsSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return searchStatsSchema.parse(value);
  } catch {
    // Client-safe version doesn't log errors
    return null;
  }
}
