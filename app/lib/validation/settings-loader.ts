/**
 * Client-safe validation utilities for settings loader data
 * This file can be imported in both server and client code
 */

import type { z } from "zod";

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
 * Client-safe version (no server-only logging)
 */
export function validateSubscription(
  value: unknown,
): z.infer<typeof subscriptionSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return subscriptionSchema.parse(value);
  } catch {
    // Client-safe version doesn't log errors
    return null;
  }
}

/**
 * Safely validate and convert available plans array
 * Returns empty array if validation fails
 * Client-safe version (no server-only logging)
 */
export function validateAvailablePlans(
  value: unknown,
): z.infer<typeof availablePlanSchema>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validated: z.infer<typeof availablePlanSchema>[] = [];

  for (const item of value) {
    try {
      validated.push(availablePlanSchema.parse(item));
    } catch {
      // Skip invalid items, continue with valid ones
      // Client-safe version doesn't log errors
    }
  }

  return validated;
}

/**
 * Safely validate and convert payment history array
 * Returns empty array if validation fails
 * Client-safe version (no server-only logging)
 */
export function validatePaymentHistory(
  value: unknown,
): z.infer<typeof paymentHistoryItemSchema>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validated: z.infer<typeof paymentHistoryItemSchema>[] = [];

  for (const item of value) {
    try {
      validated.push(paymentHistoryItemSchema.parse(item));
    } catch {
      // Skip invalid items, continue with valid ones
      // Client-safe version doesn't log errors
    }
  }

  return validated;
}

/**
 * Safely validate and convert account children array
 * Returns empty array if validation fails
 * Client-safe version (no server-only logging)
 */
export function validateAccountChildren(
  value: unknown,
): z.infer<typeof accountChildSchema>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validated: z.infer<typeof accountChildSchema>[] = [];

  for (const item of value) {
    try {
      validated.push(accountChildSchema.parse(item));
    } catch {
      // Skip invalid items, continue with valid ones
      // Client-safe version doesn't log errors
    }
  }

  return validated;
}

/**
 * Safely validate and convert accounts data
 * Returns null if validation fails
 * Client-safe version (no server-only logging)
 */
export function validateAccounts(
  value: unknown,
): z.infer<typeof accountsSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return accountsSchema.parse(value);
  } catch {
    // Client-safe version doesn't log errors
    return null;
  }
}

