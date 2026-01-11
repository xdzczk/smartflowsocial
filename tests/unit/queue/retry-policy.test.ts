/**
 * Unit tests for Retry Policy
 * Tests app/infra/queue/retry-policy.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/error-classification.server", () => ({
  isRetryableErrorEnhanced: vi.fn(),
}));

import {
  calculateRetryDelay,
  getRetryPolicy,
  shouldRetry,
  getRetryDelay,
  isRetryableError,
  getBullMQRetryConfig,
  type RetryPolicy,
} from "~/infra/queue/retry-policy.server";
import { isRetryableErrorEnhanced } from "~/lib/error-classification.server";

describe("Retry Policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRetryPolicy", () => {
    it("should return policy for scheduled-posts queue", () => {
      const policy = getRetryPolicy("scheduled-posts");

      expect(policy.maxAttempts).toBe(5);
      expect(policy.baseDelayMs).toBe(2000);
      expect(policy.maxDelayMs).toBe(60000);
      expect(policy.useJitter).toBe(true);
    });

    it("should return policy for scheduled-longform-posts queue", () => {
      const policy = getRetryPolicy("scheduled-longform-posts");

      expect(policy.maxAttempts).toBe(5);
      expect(policy.baseDelayMs).toBe(2000);
    });

    it("should return policy for post-checker queue", () => {
      const policy = getRetryPolicy("post-checker");

      expect(policy.maxAttempts).toBe(2);
      expect(policy.baseDelayMs).toBe(5000);
    });

    it("should return default policy for unknown queue type", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test with invalid queue type
      const policy = getRetryPolicy("unknown-queue" as any);

      expect(policy.maxAttempts).toBe(3);
      expect(policy.baseDelayMs).toBe(1000);
    });
  });

  describe("calculateRetryDelay", () => {
    it("should calculate exponential delay without jitter", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
        useJitter: false,
        jitterFactor: 0.1,
      };

      expect(calculateRetryDelay(0, policy)).toBe(1000); // 1000 * 2^0
      expect(calculateRetryDelay(1, policy)).toBe(2000); // 1000 * 2^1
      expect(calculateRetryDelay(2, policy)).toBe(4000); // 1000 * 2^2
      expect(calculateRetryDelay(3, policy)).toBe(8000); // 1000 * 2^3
    });

    it("should cap delay at maxDelayMs", () => {
      const policy: RetryPolicy = {
        maxAttempts: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        multiplier: 2,
        useJitter: false,
        jitterFactor: 0.1,
      };

      const delay = calculateRetryDelay(10, policy);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it("should add jitter when enabled", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
        useJitter: true,
        jitterFactor: 0.1, // ±10%
      };

      // Run multiple times to test jitter variation
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        delays.push(calculateRetryDelay(1, policy));
      }

      // All delays should be within ±10% of 2000ms
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(1800); // 2000 - 10%
        expect(delay).toBeLessThanOrEqual(2200); // 2000 + 10%
      });
    });

    it("should not return negative delay", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 30000,
        multiplier: 2,
        useJitter: true,
        jitterFactor: 0.5, // Large jitter that could cause negative
      };

      // Run multiple times to ensure no negative values
      for (let i = 0; i < 100; i++) {
        const delay = calculateRetryDelay(0, policy);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("shouldRetry", () => {
    it("should return true if attempt is less than maxAttempts", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
        useJitter: false,
        jitterFactor: 0.1,
      };

      expect(shouldRetry(0, policy)).toBe(true);
      expect(shouldRetry(1, policy)).toBe(true);
      expect(shouldRetry(2, policy)).toBe(true);
    });

    it("should return false if attempt equals maxAttempts", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
        useJitter: false,
        jitterFactor: 0.1,
      };

      expect(shouldRetry(3, policy)).toBe(false);
      expect(shouldRetry(4, policy)).toBe(false);
    });
  });

  describe("getRetryDelay", () => {
    it("should get retry delay for queue type", () => {
      const delay = getRetryDelay("scheduled-posts", 1);

      // Should use scheduled-posts policy (baseDelayMs: 2000, multiplier: 2)
      expect(delay).toBeGreaterThanOrEqual(3000); // With jitter, could be 2000-4000
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it("should calculate delay for different attempts", () => {
      const delay0 = getRetryDelay("scheduled-posts", 0);
      const delay1 = getRetryDelay("scheduled-posts", 1);
      const delay2 = getRetryDelay("scheduled-posts", 2);

      // Delay should increase with attempts (allowing for jitter)
      expect(delay1).toBeGreaterThanOrEqual(delay0);
      expect(delay2).toBeGreaterThanOrEqual(delay1);
    });
  });

  describe("isRetryableError", () => {
    it("should use enhanced classification when available", () => {
      const error = new Error("Network timeout");
      (isRetryableErrorEnhanced as ReturnType<typeof vi.fn>).mockReturnValue(
        true
      );

      const result = isRetryableError(error);

      expect(result).toBe(true);
      expect(isRetryableErrorEnhanced).toHaveBeenCalledWith(error);
    });

    it("should fallback to pattern matching if classification fails", () => {
      const error = new Error("Network timeout");
      (isRetryableErrorEnhanced as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error("Classification failed");
        }
      );

      const result = isRetryableError(error);

      expect(result).toBe(true); // Network errors are retryable
    });

    it("should return false for non-retryable errors", () => {
      const error = new Error("Post not found");
      (isRetryableErrorEnhanced as ReturnType<typeof vi.fn>).mockReturnValue(
        false
      );

      const result = isRetryableError(error);

      expect(result).toBe(false);
    });

    it("should return false for validation errors", () => {
      const error = new Error("Invalid payload validation");
      (isRetryableErrorEnhanced as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error("Classification failed");
        }
      );

      const result = isRetryableError(error);

      expect(result).toBe(false);
    });

    it("should return true for network errors", () => {
      const error = new Error("Connection timeout");
      (isRetryableErrorEnhanced as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error("Classification failed");
        }
      );

      const result = isRetryableError(error);

      expect(result).toBe(true);
    });
  });

  describe("getBullMQRetryConfig", () => {
    it("should return BullMQ retry configuration", () => {
      const config = getBullMQRetryConfig("scheduled-posts");

      expect(config.attempts).toBe(5);
      expect(config.backoff.type).toBe("exponential");
      expect(config.backoff.delay).toBe(2000);
    });

    it("should use default policy for unknown queue", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test with invalid queue type
      const config = getBullMQRetryConfig("unknown-queue" as any);

      expect(config.attempts).toBe(3);
      expect(config.backoff.delay).toBe(1000);
    });
  });
});
