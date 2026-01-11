/**
 * Nostr Publisher Service
 *
 * Abstracts the Nostr publishing interface.
 * This allows swapping implementations without changing business logic.
 */

import type { SignedEvent } from "~/features/nostr/types";
import { env } from "~/lib/env.server";
import { fetchWithRetry } from "~/lib/fetch.server";
import { logWarning } from "~/lib/error-logger.server";
import {
  prioritizeRelaysByHealth,
  recordRelaySuccess,
  recordRelayFailure,
} from "../relays/relay-health.server";
import { recordRelayRequest } from "~/lib/metrics/relay-metrics.server";

/**
 * Nostr Publisher Interface
 */
export interface NostrPublisher {
  /**
   * Publish an event to Nostr relays
   * @param event - The signed Nostr event
   * @param relays - Array of relay URLs
   * @param correlationId - Optional correlation ID for tracing
   * @returns Promise that resolves when publish is complete
   */
  publish(
    event: SignedEvent,
    relays: string[],
    correlationId?: string
  ): Promise<void>;
}

/**
 * Default Nostr Publisher Implementation
 * Uses HTTP publisher service with health-aware relay routing
 */
export class DefaultNostrPublisher implements NostrPublisher {
  private publisherUrl: string;

  constructor() {
    this.publisherUrl =
      process.env["NOSTR_PUBLISHER_URL"] ?? env.NOSTR_PUBLISHER_URL;
    if (!this.publisherUrl) {
      throw new Error("NOSTR_PUBLISHER_URL environment variable is not set");
    }
  }

  async publish(
    event: SignedEvent,
    relays: string[],
    correlationId?: string
  ): Promise<void> {
    // Prioritize relays by health (healthiest first)
    const prioritizedRelays = prioritizeRelaysByHealth(relays);

    if (prioritizedRelays.length === 0) {
      // All relays are unhealthy, but try anyway (circuit breaker might allow)
      logWarning("All relays filtered out by health, using original list", {
        originalRelays: relays,
        correlationId,
      });
      // Fallback to original relays if all are filtered
      prioritizedRelays.push(...relays);
    }

    const startTime = Date.now();

    try {
      const response = await fetchWithRetry(this.publisherUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relays: prioritizedRelays,
          event,
        }),
        timeout: 15000,
        maxRetries: 2,
        correlationId,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to post to nostr publisher: ${response.statusText}`
        );
      }

      // Record success for all relays (publisher handles multiple relays)
      const latency = Date.now() - startTime;
      for (const relay of prioritizedRelays) {
        recordRelaySuccess(relay, latency);
        recordRelayRequest(relay, true);
      }
    } catch (error) {
      // Record failure for all relays
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      for (const relay of prioritizedRelays) {
        recordRelayFailure(relay, errorMessage);
        recordRelayRequest(relay, false);
      }
      throw error;
    }
  }
}

// Default instance
let defaultPublisher: NostrPublisher | null = null;

/**
 * Get the default Nostr publisher instance
 */
export function getNostrPublisher(): NostrPublisher {
  if (!defaultPublisher) {
    defaultPublisher = new DefaultNostrPublisher();
  }
  return defaultPublisher;
}

/**
 * Set a custom Nostr publisher (for testing)
 */
export function setNostrPublisher(publisher: NostrPublisher): void {
  defaultPublisher = publisher;
}
