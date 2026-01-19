/**
 * Nostr Publisher Service
 *
 * Abstracts the Nostr publishing interface.
 * This allows swapping implementations without changing business logic.
 */

import type { SignedEvent } from "~/features/nostr/types";
import { env } from "~/lib/env.server";
import { logWarning } from "~/lib/error-logger.server";
import { fetchWithRetry } from "~/lib/fetch.server";
import { recordRelayRequest } from "~/lib/metrics/relay-metrics.server";
import { relaysArray as systemDefaultRelays } from "~/lib/relays";

import {
  prioritizeRelaysByHealth,
  recordRelaySuccess,
  recordRelayFailure,
} from "../relays/relay-health.server";

export interface RelayPublishResult {
  relay: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface NostrPublishResult {
  /**
   * Results for relays we were able to attribute outcomes to.
   * If the upstream publisher does not return per-relay results, this may be empty.
   */
  results: RelayPublishResult[];
}

/**
 * Nostr Publisher Interface
 */
export interface NostrPublisher {
  /**
   * Publish an event to Nostr relays
   * @param event - The signed Nostr event
   * @param relays - Array of relay URLs
   * @param correlationId - Optional correlation ID for tracing
   * @returns Per-relay publish results when available
   */
  publish(
    event: SignedEvent,
    relays: string[],
    correlationId?: string
  ): Promise<NostrPublishResult>;
}

function normalizeRelays(relays: string[]): string[] {
  return Array.from(
    new Set(relays.map((r) => r.trim()).filter((r) => r.length > 0))
  );
}

function parsePerRelayResults(raw: unknown): Array<{
  relay: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> | null {
  const isUnknownArray = (value: unknown): value is unknown[] =>
    Array.isArray(value);
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value);

  if (!isRecord(raw)) return null;

  const parseResultsArray = (results: unknown): RelayPublishResult[] | null => {
    if (!isUnknownArray(results)) return null;
    const parsed: RelayPublishResult[] = [];
    for (const item of results) {
      if (!isRecord(item)) continue;
      const relay = typeof item["relay"] === "string" ? item["relay"] : null;
      const okRaw =
        "ok" in item ? item["ok"] : "success" in item ? item["success"] : null;
      const ok = typeof okRaw === "boolean" ? okRaw : null;
      if (!relay || ok === null) continue;
      const latencyMs =
        typeof item["latencyMs"] === "number" ? item["latencyMs"] : undefined;
      const error =
        typeof item["error"] === "string" ? item["error"] : undefined;
      parsed.push({ relay, ok, latencyMs, error });
    }
    return parsed.length > 0 ? parsed : null;
  };

  const parsePerRelayMap = (perRelay: unknown): RelayPublishResult[] | null => {
    if (!isRecord(perRelay)) return null;
    const parsed: RelayPublishResult[] = [];
    for (const [relay, value] of Object.entries(perRelay)) {
      if (typeof value === "boolean") {
        parsed.push({ relay, ok: value });
      }
    }
    return parsed.length > 0 ? parsed : null;
  };

  // Preferred: { results: [{ relay, ok, latencyMs?, error? }] }
  if ("results" in raw) {
    const parsed = parseResultsArray(raw["results"]);
    if (parsed) return parsed;
  }

  // Alternate: { perRelay: { [relay]: true|false } }
  if ("perRelay" in raw) {
    const parsed = parsePerRelayMap(raw["perRelay"]);
    if (parsed) return parsed;
  }

  return null;
}

/**
 * Default Nostr Publisher Implementation
 * Uses HTTP publisher service with health-aware relay routing
 */
export class DefaultNostrPublisher implements NostrPublisher {
  private readonly publisherUrl: string;

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
  ): Promise<NostrPublishResult> {
    const relaysToUse =
      relays.length > 0
        ? normalizeRelays(relays)
        : normalizeRelays(systemDefaultRelays);

    // Prioritize relays by health (healthiest first)
    const prioritizedRelays = prioritizeRelaysByHealth(relaysToUse);

    if (prioritizedRelays.length === 0) {
      // All relays are unhealthy, but try anyway (circuit breaker might allow)
      logWarning("All relays filtered out by health, using original list", {
        originalRelays: relaysToUse,
        correlationId,
        eventId: event.id,
        kind: event.kind,
      });
      // Fallback to original relays if all are filtered
      prioritizedRelays.push(...relaysToUse);
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
          correlationId,
          returnPerRelayResults: true,
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

      const totalLatency = Date.now() - startTime;

      // Prefer per-relay results returned by the publisher service.
      let perRelayResults: RelayPublishResult[] | null = null;
      try {
        const ct = response.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const json = (await response.clone().json()) as unknown;
          perRelayResults = parsePerRelayResults(json);
        } else {
          // Best-effort: some services omit content-type.
          const json = (await response.clone().json()) as unknown;
          perRelayResults = parsePerRelayResults(json);
        }
      } catch {
        perRelayResults = null;
      }

      // If we cannot attribute outcomes per relay, do not mark all relays as success.
      // This avoids poisoning health scores with incorrect global attribution.
      if (!perRelayResults) {
        logWarning(
          "Publisher response missing per-relay results; relay health will not be updated from this call",
          {
            correlationId,
            relayCount: prioritizedRelays.length,
            eventId: event.id,
            kind: event.kind,
          }
        );
        return { results: [] };
      }

      for (const result of perRelayResults) {
        // Only attribute outcomes for relays we actually attempted.
        if (!prioritizedRelays.includes(result.relay)) continue;
        if (result.ok) {
          recordRelaySuccess(result.relay, result.latencyMs ?? totalLatency);
          recordRelayRequest(result.relay, true);
        } else {
          recordRelayFailure(result.relay, result.error);
          recordRelayRequest(result.relay, false);
        }
      }

      return { results: perRelayResults };
    } catch (error) {
      // If the publisher call failed entirely, record a failure for every relay we intended to use.
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
  defaultPublisher ??= new DefaultNostrPublisher();
  return defaultPublisher;
}

/**
 * Set a custom Nostr publisher (for testing)
 */
export function setNostrPublisher(publisher: NostrPublisher): void {
  defaultPublisher = publisher;
}
