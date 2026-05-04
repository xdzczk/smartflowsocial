import type { Prisma } from "@prisma/client";

import type { SignedEvent } from "~/features/nostr/types";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

/**
 * Validated source signatures for rebuilding repost/quote events after queue resume
 * cleared the child row’s `signedEvent`.
 */
export function pickRescheduleSourceSignedEvents(post: {
  repostOf?: { signedEvent?: unknown } | null;
  quoteOf?: { signedEvent?: unknown } | null;
  quoteOfLongForm?: { signedEvent?: unknown } | null;
}): {
  repostSourceSignedEvent: SignedEvent | null;
  quoteSourceSignedEvent: SignedEvent | null;
  quoteLongFormSourceSignedEvent: SignedEvent | null;
} {
  return {
    repostSourceSignedEvent:
      validateSignedEvent(
        post.repostOf?.signedEvent as Prisma.JsonValue | undefined
      ) ?? null,
    quoteSourceSignedEvent:
      validateSignedEvent(
        post.quoteOf?.signedEvent as Prisma.JsonValue | undefined
      ) ?? null,
    quoteLongFormSourceSignedEvent:
      validateSignedEvent(
        post.quoteOfLongForm?.signedEvent as Prisma.JsonValue | undefined
      ) ?? null,
  };
}
