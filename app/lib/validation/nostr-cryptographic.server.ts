/**
 * Cryptographic validation for Nostr SignedEvents
 *
 * This module provides cryptographic verification of SignedEvents using nostr-tools.
 * It validates both:
 * 1. Event structure (via Zod schema)
 * 2. Cryptographic integrity (event ID hash and signature)
 *
 * This is critical for security - we must verify that events are properly signed
 * before storing them or attempting to publish them.
 */

import { validateEvent } from "nostr-tools";

import type { SignedEvent } from "~/features/nostr/types";
import { logError } from "~/lib/error-logger.server";
import { ValidationError } from "~/lib/errors";

import { signedEventSchema } from "./schemas/nostr-events.schemas";

/**
 * Result of cryptographic validation
 */
export interface CryptographicValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a SignedEvent both structurally and cryptographically
 *
 * This function:
 * 1. Validates the event structure using Zod schema
 * 2. Validates the event ID matches the hash of the event content
 * 3. Validates the signature is cryptographically valid
 *
 * @param event - The SignedEvent to validate
 * @returns The validated SignedEvent
 * @throws ValidationError if validation fails
 */
export function validateSignedEventCryptographically(
  event: unknown
): SignedEvent {
  // Step 1: Structural validation (Zod schema)
  let parsedEvent: SignedEvent;
  try {
    parsedEvent = signedEventSchema.parse(event);
  } catch (error) {
    if (error instanceof Error) {
      logError(error, {
        message: "Invalid SignedEvent structure",
        context: { event: JSON.stringify(event) },
      });
    }
    throw new ValidationError("Invalid SignedEvent structure", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Step 2: Cryptographic validation (nostr-tools)
  // validateEvent checks both:
  // - Event ID matches the hash of [0, pubkey, created_at, kind, tags, content]
  // - Signature is cryptographically valid for the event
  const isValid = validateEvent(parsedEvent);
  if (!isValid) {
    const errorMessage =
      "SignedEvent failed cryptographic validation: invalid signature or event structure";
    logError(new Error(errorMessage), {
      message: "Cryptographic validation failed",
      context: {
        eventId: parsedEvent.id,
        pubkey: parsedEvent.pubkey,
        kind: parsedEvent.kind,
      },
    });
    throw new ValidationError(errorMessage, {
      eventId: parsedEvent.id,
      pubkey: parsedEvent.pubkey,
    });
  }

  return parsedEvent;
}

/**
 * Validate a SignedEvent cryptographically without throwing
 * Returns a result object instead
 *
 * Useful for cases where you want to handle validation failures gracefully
 *
 * @param event - The SignedEvent to validate
 * @returns Validation result with valid flag and optional error message
 */
export function tryValidateSignedEventCryptographically(
  event: unknown
): CryptographicValidationResult {
  try {
    validateSignedEventCryptographically(event);
    return { valid: true };
  } catch (error) {
    const errorMessage =
      error instanceof ValidationError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      valid: false,
      error: errorMessage,
    };
  }
}
