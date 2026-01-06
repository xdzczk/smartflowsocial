/**
 * Validation utilities for settings loader data
 * Replaces unsafe type casts with runtime validation
 */

import { z } from "zod";

import { logError } from "~/lib/error-logger.server";

import {
  subscriptionSchema,
  availablePlanSchema,
  paymentHistoryItemSchema,
  accountChildSchema,
  accountsSchema,
} from "./schemas/settings-loader.schemas";

/**
 * Safely validate and convert subscription data
 * Returns null if validation fails
 */
export function validateSubscription(
  value: unknown
): z.infer<typeof subscriptionSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return subscriptionSchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError(error, {
        message: "Invalid subscription structure from loader",
        context: { issues: error.issues },
      });
    }
    return null;
  }
}

/**
 * Safely validate and convert available plans array
 * Returns empty array if validation fails
 */
export function validateAvailablePlans(
  value: unknown
): Array<z.infer<typeof availablePlanSchema>> {
  if (!Array.isArray(value)) {
    return [];
  }

  const validated: Array<z.infer<typeof availablePlanSchema>> = [];

  for (const item of value) {
    try {
      validated.push(availablePlanSchema.parse(item));
    } catch (error) {
      if (error instanceof z.ZodError) {
        logError(error, {
          message: "Invalid available plan structure in array",
          context: { issues: error.issues },
        });
      }
      // Skip invalid items, continue with valid ones
    }
  }

  return validated;
}

/**
 * Safely validate and convert payment history array
 * Returns empty array if validation fails
 */
export function validatePaymentHistory(
  value: unknown
): Array<z.infer<typeof paymentHistoryItemSchema>> {
  if (!Array.isArray(value)) {
    return [];
  }

  const validated: Array<z.infer<typeof paymentHistoryItemSchema>> = [];

  for (const item of value) {
    try {
      validated.push(paymentHistoryItemSchema.parse(item));
    } catch (error) {
      if (error instanceof z.ZodError) {
        logError(error, {
          message: "Invalid payment history item structure in array",
          context: { issues: error.issues },
        });
      }
      // Skip invalid items, continue with valid ones
    }
  }

  return validated;
}

/**
 * Safely validate and convert account children array
 * Returns empty array if validation fails
 */
export function validateAccountChildren(
  value: unknown
): Array<z.infer<typeof accountChildSchema>> {
  if (!Array.isArray(value)) {
    return [];
  }

  const validated: Array<z.infer<typeof accountChildSchema>> = [];

  for (const item of value) {
    try {
      validated.push(accountChildSchema.parse(item));
    } catch (error) {
      if (error instanceof z.ZodError) {
        logError(error, {
          message: "Invalid account child structure in array",
          context: { issues: error.issues },
        });
      }
      // Skip invalid items, continue with valid ones
    }
  }

  return validated;
}

/**
 * Safely validate and convert accounts data
 * Returns null if validation fails
 */
export function validateAccounts(
  value: unknown
): z.infer<typeof accountsSchema> {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return accountsSchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError(error, {
        message: "Invalid accounts structure from loader",
        context: { issues: error.issues },
      });
    }
    return null;
  }
}
