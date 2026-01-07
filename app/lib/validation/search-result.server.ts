/**
 * Validation utilities for search result data
 * Replaces unsafe type casts with runtime validation
 */

import { z } from "zod";

import { logError } from "~/lib/error-logger.server";

import {
  searchResultDataSchema,
  searchResultDisplaySchema,
  searchStatsSchema,
} from "./schemas/search-result.schemas";

/**
 * Safely validate and convert search result data from fetcher
 * Returns null if validation fails
 */
export function validateSearchResultData(
  value: unknown
): z.infer<typeof searchResultDataSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return searchResultDataSchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError(error, {
        message: "Invalid search result data structure from fetcher",
        context: { issues: error.issues },
      });
    }
    return null;
  }
}

/**
 * Safely validate and convert search result display data
 * Returns null if validation fails
 */
export function validateSearchResultDisplay(
  value: unknown
): z.infer<typeof searchResultDisplaySchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return searchResultDisplaySchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError(error, {
        message: "Invalid search result display structure",
        context: { issues: error.issues },
      });
    }
    return null;
  }
}

/**
 * Safely validate and convert search stats
 * Returns null if validation fails
 */
export function validateSearchStats(
  value: unknown
): z.infer<typeof searchStatsSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return searchStatsSchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError(error, {
        message: "Invalid search stats structure",
        context: { issues: error.issues },
      });
    }
    return null;
  }
}

