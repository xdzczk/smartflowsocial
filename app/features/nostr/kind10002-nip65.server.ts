/**
 * NIP-65 relay list metadata (kind 10002) validation for /api/publish.
 */

import { KIND_RELAY_LIST_NIP65 } from "~/features/nostr/nostr-event-kinds";
import type { SignedEvent } from "~/features/nostr/types";
import { ValidationError } from "~/lib/errors";
import { relayUrlSchema } from "~/lib/validation/schemas/settings.schemas";

const PUBLISH_ROUTE_CONTEXT = { route: "api/publish" as const };

/** Upper bound on `r` tags to keep publish payloads reasonable. */
export const MAX_NIP65_RELAY_TAGS = 64;

/**
 * Ensures a cryptographically valid signed event is a safe NIP-65 relay list for publishing.
 * @throws ValidationError when structure is invalid.
 */
export function assertValidKind10002RelayListEvent(event: SignedEvent): void {
  if (event.kind !== KIND_RELAY_LIST_NIP65) {
    return;
  }

  if (typeof event.content !== "string") {
    throw new ValidationError("Kind 10002 content must be a string", {
      ...PUBLISH_ROUTE_CONTEXT,
    });
  }

  if (event.content.trim().length > 0) {
    throw new ValidationError(
      "Kind 10002 relay list must have empty content for this API",
      PUBLISH_ROUTE_CONTEXT
    );
  }

  if (!Array.isArray(event.tags)) {
    throw new ValidationError("Kind 10002 tags must be an array", {
      ...PUBLISH_ROUTE_CONTEXT,
    });
  }

  let rCount = 0;
  for (const t of event.tags) {
    if (!Array.isArray(t) || t.length < 2) {
      throw new ValidationError("Invalid tag in kind 10002 event", {
        ...PUBLISH_ROUTE_CONTEXT,
      });
    }
    const name = t[0];
    if (name !== "r") {
      throw new ValidationError(
        "Kind 10002 events may only contain r tags in this API",
        PUBLISH_ROUTE_CONTEXT
      );
    }
    const url = typeof t[1] === "string" ? t[1].trim() : "";
    try {
      relayUrlSchema.parse(url);
    } catch {
      throw new ValidationError(
        `Invalid relay URL in kind 10002 r tag: ${url || "(empty)"}`,
        PUBLISH_ROUTE_CONTEXT
      );
    }
    if (t.length > 2) {
      const marker = String(t[2]).toLowerCase();
      if (marker !== "read" && marker !== "write") {
        throw new ValidationError(
          "Kind 10002 r tag marker must be read, write, or omitted",
          PUBLISH_ROUTE_CONTEXT
        );
      }
    }
    rCount += 1;
  }

  if (rCount === 0) {
    throw new ValidationError(
      "Kind 10002 relay list must include at least one r tag",
      PUBLISH_ROUTE_CONTEXT
    );
  }

  if (rCount > MAX_NIP65_RELAY_TAGS) {
    throw new ValidationError(
      `Kind 10002 relay list may have at most ${MAX_NIP65_RELAY_TAGS} relays`,
      PUBLISH_ROUTE_CONTEXT
    );
  }
}
