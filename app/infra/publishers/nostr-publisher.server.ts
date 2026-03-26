/**
 * Nostr Publisher Service
 *
 * Abstracts the Nostr publishing interface.
 * This allows swapping implementations without changing business logic.
 *
 * Updated for new HTTP Nostr Publisher with improved error handling,
 * replay protection, and rate limiting support.
 */

import type { SignedEvent } from "~/features/nostr/types";
import { relaysArray as systemDefaultRelays } from "~/features/relays/relay-constants";
import { env } from "~/lib/env.server";
import { logWarning, logError, logInfo } from "~/lib/error-logger.server";
import { fetchWithRetry } from "~/lib/fetch.server";
import { recordRelayRequest } from "~/lib/metrics/relay-metrics.server";

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
 * Policy options for publishing behavior
 */
export type PublishPolicy = "default" | "conservative" | "aggressive";

/**
 * Nostr Publisher Interface
 */
export interface NostrPublisher {
  /**
   * Publish an event to Nostr relays
   * @param event - The signed Nostr event
   * @param relays - Array of relay URLs
   * @param correlationId - Optional correlation ID for tracing
   * @param policy - Optional policy for publishing behavior (default, conservative, aggressive)
   * @returns Per-relay publish results when available
   */
  publish(
    event: SignedEvent,
    relays: string[],
    correlationId?: string,
    policy?: PublishPolicy
  ): Promise<NostrPublishResult>;
}

function normalizeRelays(relays: string[]): string[] {
  return Array.from(
    new Set(relays.map((r) => r.trim()).filter((r) => r.length > 0))
  );
}

/** Canonical key for comparing relay URLs across formatting differences. */
function canonicalRelayKey(url: string): string {
  const t = url.trim();
  if (!t) return "";
  const withScheme = /^wss?:\/\//i.test(t) ? t : `wss://${t}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.toLowerCase();
    const path = (u.pathname || "").replace(/\/+$/, "") || "";
    return `${u.protocol.toLowerCase()}//${host}${path}`;
  } catch {
    return t.toLowerCase().replace(/\/+$/, "");
  }
}

function relayHostname(url: string): string {
  const t = url.trim();
  if (!t) return "";
  const withScheme = /^wss?:\/\//i.test(t) ? t : `wss://${t}`;
  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function findMatchingPublisherResult(
  requestedUrl: string,
  results: RelayPublishResult[]
): RelayPublishResult | undefined {
  const reqKey = canonicalRelayKey(requestedUrl);
  for (const r of results) {
    if (canonicalRelayKey(r.relay) === reqKey) return r;
  }
  const reqHost = relayHostname(requestedUrl);
  if (!reqHost) return undefined;
  for (const r of results) {
    if (relayHostname(r.relay) === reqHost) return r;
  }
  return undefined;
}

/**
 * Map upstream per-relay rows onto the relays we sent. The HTTP publisher may
 * use different URL strings (trailing slash, hostname-only). Strict equality
 * drops every row → empty ACK persistence and stale Settings relay timestamps.
 */
function mergePublisherResultsForRequested(
  requested: string[],
  perRelay: RelayPublishResult[],
  context: { correlationId?: string; eventId: string }
): RelayPublishResult[] {
  const merged: RelayPublishResult[] = [];
  for (const req of requested) {
    const hit = findMatchingPublisherResult(req, perRelay);
    if (hit) {
      merged.push({ ...hit, relay: req });
    }
  }
  if (merged.length === 0 && perRelay.length > 0 && requested.length > 0) {
    const requestedHosts = new Set(
      requested.map((u) => relayHostname(u)).filter(Boolean)
    );
    const byHost = perRelay.filter((r) =>
      requestedHosts.has(relayHostname(r.relay))
    );
    if (byHost.length > 0) {
      logWarning(
        "Nostr publisher: per-relay results matched requested relays only by hostname; using hostname-filtered rows for ACK persistence",
        {
          ...context,
          requestedSample: requested.slice(0, 5),
          upstreamSample: perRelay.slice(0, 5).map((r) => r.relay),
        }
      );
      return byHost;
    }
    logWarning(
      "Nostr publisher: per-relay results did not match requested relays; using raw upstream rows for ACK persistence",
      {
        ...context,
        requestedSample: requested.slice(0, 5),
        upstreamSample: perRelay.slice(0, 5).map((r) => r.relay),
      }
    );
    return perRelay;
  }
  return merged;
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
 * Parses error response from publisher
 */
async function parseErrorResponse(
  response: Response
): Promise<{ message: string; code?: string }> {
  try {
    const data = (await response.json()) as {
      error: string;
      code?: string;
    };
    return {
      message: data.error || response.statusText,
      code: data.code,
    };
  } catch {
    return { message: response.statusText };
  }
}

/**
 * Creates error with appropriate message based on status code
 */
async function createPublisherError(
  response: Response,
  eventId: string,
  _correlationId?: string
): Promise<Error> {
  const status = response.status;
  const errorData = await parseErrorResponse(response);

  if (status === 409) {
    // Replay protection - event already published
    return new Error(
      `Event ${eventId} has already been published (replay protection). ${errorData.message}`
    );
  }

  if (status === 429) {
    // Rate limit exceeded
    const retryAfter = response.headers.get("Retry-After");
    const retryMsg = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";
    return new Error(
      `Rate limit exceeded for Nostr publisher.${retryMsg} ${errorData.message}`
    );
  }

  if (status === 400) {
    // Validation error
    return new Error(
      `Invalid request to Nostr publisher: ${errorData.message}`
    );
  }

  // Generic error
  return new Error(
    `Failed to post to nostr publisher (${status}): ${errorData.message}`
  );
}

/**
 * Default Nostr Publisher Implementation
 * Uses HTTP publisher service with health-aware relay routing
 *
 * Updated for new HTTP Nostr Publisher with:
 * - Replay protection (409 Conflict)
 * - Rate limiting (429 Too Many Requests)
 * - Policy support (default, conservative, aggressive)
 * - API token authentication
 */
export class DefaultNostrPublisher implements NostrPublisher {
  private readonly publisherUrl: string;
  private readonly apiToken: string | undefined;

  constructor() {
    this.publisherUrl = env.NOSTR_PUBLISHER_URL;
    if (!this.publisherUrl) {
      throw new Error("NOSTR_PUBLISHER_URL environment variable is not set");
    }

    // Optional API token for authentication
    this.apiToken = env.NOSTR_PUBLISHER_API_TOKEN;
  }

  async publish(
    event: SignedEvent,
    relays: string[],
    correlationId?: string,
    policy: PublishPolicy = "default"
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
      // Build URL with optional policy query parameter
      const url = new URL(this.publisherUrl);
      if (policy !== "default") {
        url.searchParams.set("policy", policy);
      }

      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add API token if configured
      if (this.apiToken) {
        headers["API-TOKEN"] = this.apiToken;
      }

      // Add correlation ID if provided
      if (correlationId) {
        headers["X-Request-ID"] = correlationId;
      }

      logInfo("Nostr publisher: sending publish request", {
        correlationId,
        eventId: event.id,
        kind: event.kind,
        relayCount: prioritizedRelays.length,
        publisherHost: url.host,
      });

      const response = await fetchWithRetry(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          relays: prioritizedRelays,
          event,
          correlationId,
          // Note: returnPerRelayResults is no longer needed - new publisher always returns results
        }),
        timeout: 15000,
        maxRetries: 2,
        correlationId,
      });

      if (!response.ok) {
        throw await createPublisherError(response, event.id, correlationId);
      }

      const totalLatency = Date.now() - startTime;

      // Prefer per-relay results returned by the publisher service.
      // Use response.text() + JSON.parse to avoid relying on Response.json() which may not exist in some runtimes.
      let perRelayResults: RelayPublishResult[] | null = null;
      try {
        const raw = await response.text();
        const json = raw ? (JSON.parse(raw) as unknown) : null;
        perRelayResults = json != null ? parsePerRelayResults(json) : null;
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

      // Prefer rows that correspond to relays we requested (exclude fan-out noise).
      // Match by canonical URL / hostname so ACK rows are not dropped on format mismatch.
      const filteredResults = mergePublisherResultsForRequested(
        prioritizedRelays,
        perRelayResults,
        { correlationId, eventId: event.id }
      );

      for (const result of filteredResults) {
        if (result.ok) {
          recordRelaySuccess(result.relay, result.latencyMs ?? totalLatency);
          recordRelayRequest(result.relay, true);
        } else {
          recordRelayFailure(result.relay, result.error);
          recordRelayRequest(result.relay, false);
        }
      }

      return { results: filteredResults };
    } catch (error) {
      // If the publisher call failed entirely, record a failure for every relay we intended to use.
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Log specific error types for better observability
      if (errorMessage.includes("replay protection")) {
        logWarning("Replay protection triggered", {
          eventId: event.id,
          correlationId,
          error: errorMessage,
        });
      } else if (errorMessage.includes("Rate limit")) {
        logWarning("Rate limit exceeded", {
          eventId: event.id,
          correlationId,
          error: errorMessage,
        });
      } else {
        logError(error instanceof Error ? error : new Error(errorMessage), {
          eventId: event.id,
          correlationId,
          relayCount: prioritizedRelays.length,
          kind: event.kind,
          message: "Failed to publish to Nostr publisher",
        });
      }

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
