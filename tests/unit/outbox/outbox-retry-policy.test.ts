import { describe, it, expect } from "vitest";

import {
  computeNextAttemptAt,
  computeOutboxRetryDelayMs,
  type OutboxRetryPolicy,
} from "~/infra/outbox/outbox-retry-policy.server";

describe("Outbox retry policy", () => {
  it("computes deterministic delays when jitter disabled", () => {
    const policy: OutboxRetryPolicy = {
      maxAttempts: 5,
      baseDelayMs: 2000,
      maxDelayMs: 600000,
      multiplier: 2,
      useJitter: false,
      jitterFactor: 0,
    };

    expect(
      computeOutboxRetryDelayMs({ attemptIndex: 0, policy, random: () => 0.5 })
    ).toBe(2000);
    expect(
      computeOutboxRetryDelayMs({ attemptIndex: 1, policy, random: () => 0.5 })
    ).toBe(4000);
    expect(
      computeOutboxRetryDelayMs({ attemptIndex: 2, policy, random: () => 0.5 })
    ).toBe(8000);
  });

  it("applies minimumDelayMs for error-classification hints", () => {
    const policy: OutboxRetryPolicy = {
      maxAttempts: 5,
      baseDelayMs: 2000,
      maxDelayMs: 600000,
      multiplier: 2,
      useJitter: false,
      jitterFactor: 0,
    };

    const now = new Date("2024-01-01T00:00:00.000Z");
    const next = computeNextAttemptAt({
      now,
      attemptsAfterIncrement: 1, // first retry => baseDelay 2000ms
      policy,
      minimumDelayMs: 5000,
    });
    expect(next.toISOString()).toBe("2024-01-01T00:00:05.000Z");
  });
});
