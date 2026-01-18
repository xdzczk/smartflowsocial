import { describe, it, expect } from "vitest";

import {
  canUseRelay,
  getRelayHealth,
  prioritizeRelaysByHealth,
  recordRelayFailure,
  recordRelaySuccess,
  resetRelayHealth,
} from "~/infra/relays/relay-health.server";

describe("relay-health", () => {
  it("opens circuit breaker after repeated failures and closes after half-open successes", () => {
    const relay = "wss://relay.example";
    resetRelayHealth(relay);

    // Trip circuit breaker (failureThreshold=5)
    recordRelayFailure(relay);
    recordRelayFailure(relay);
    recordRelayFailure(relay);
    recordRelayFailure(relay);
    recordRelayFailure(relay);

    const afterFailures = getRelayHealth(relay);
    expect(afterFailures?.circuitBreakerState).toBe("OPEN");
    expect(canUseRelay(relay)).toBe(false);

    // Fast-forward timeout so circuit becomes half-open
    if (!afterFailures?.circuitBreakerOpenedAt) {
      throw new Error("Expected circuit breaker to have openedAt");
    }
    afterFailures.circuitBreakerOpenedAt = new Date(Date.now() - 120_000);

    expect(canUseRelay(relay)).toBe(true);
    const halfOpen = getRelayHealth(relay);
    expect(halfOpen?.circuitBreakerState).toBe("HALF_OPEN");

    // Two successes should close the circuit (successThreshold=2)
    recordRelaySuccess(relay, 100);
    recordRelaySuccess(relay, 120);

    const closed = getRelayHealth(relay);
    expect(closed?.circuitBreakerState).toBe("CLOSED");
  });

  it("prioritizes relays by score (healthier first) deterministically", () => {
    const a = "wss://a.example";
    const b = "wss://b.example";
    resetRelayHealth(a);
    resetRelayHealth(b);

    // Make A look worse
    recordRelayFailure(a);
    recordRelayFailure(a);
    recordRelayFailure(a);

    // Make B look better
    recordRelaySuccess(b, 50);
    recordRelaySuccess(b, 60);

    const ordered = prioritizeRelaysByHealth([a, b]);
    expect(ordered[0]).toBe(b);
    expect(ordered[1]).toBe(a);
  });
});
