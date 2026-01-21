import {
  getNostrPublisher,
  type NostrPublishResult,
} from "~/infra/publishers/nostr-publisher.server";
import { withSentrySpan } from "~/lib/sentry.server";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

import type { SignedEvent } from "./types";

/**
 * Publish a signed Nostr event to relays via the configured publisher.
 *
 * This is the server-side publishing boundary used by Remix routes.
 * - Validates the signed event cryptographically (ID + signature)
 * - Delegates to the NostrPublisher abstraction (health-aware, retry-aware)
 */
export async function publishSignedEventToRelays(input: {
  signedEvent: SignedEvent;
  relays: string[];
  correlationId?: string;
}): Promise<NostrPublishResult> {
  const validated = validateSignedEventCryptographically(input.signedEvent);
  const publisher = getNostrPublisher();

  return await withSentrySpan(
    {
      name: "nostr.publish",
      op: "nostr.publish",
      attributes: {
        correlationId: input.correlationId,
        relayCount: input.relays.length,
        kind: validated.kind,
      },
    },
    async () =>
      await publisher.publish(validated, input.relays, input.correlationId)
  );
}
