/**
 * Validation utilities for Nostr events from Prisma JsonValue
 * Replaces unsafe type casts with runtime validation
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { logError } from "~/lib/error-logger.server";

import { normalizeEvent } from "./normalize-loader-response-data";
import {
  nostrEventSchema,
  signedEventSchema,
} from "./schemas/nostr-events.schemas";

/**
 * Safely validate and convert Prisma JsonValue to SignedEvent
 * Returns null if validation fails (logs error but does not throw)
 */
export function validateSignedEvent(
  value: Prisma.JsonValue | null | undefined
): z.infer<typeof signedEventSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
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
 * Returns null if validation fails (logs error but does not throw)
 */
export function validateNostrEvent(
  value: Prisma.JsonValue | null | undefined
): z.infer<typeof nostrEventSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
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
