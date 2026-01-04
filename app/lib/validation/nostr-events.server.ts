/**
 * Validation utilities for Nostr events from Prisma JsonValue
 * Replaces unsafe type casts with runtime validation
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { logError } from "~/lib/error-logger.server";

import { nostrEventSchema, signedEventSchema } from "./schemas/nostr-events.schemas";

/**
 * Safely validate and convert Prisma JsonValue to SignedEvent
 * Returns null if validation fails (logs error but doesn't throw)
 */
export function validateSignedEvent(
  value: Prisma.JsonValue | null | undefined,
): z.infer<typeof signedEventSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return signedEventSchema.parse(value);
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
  value: Prisma.JsonValue | null | undefined,
): z.infer<typeof nostrEventSchema> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    return nostrEventSchema.parse(value);
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

