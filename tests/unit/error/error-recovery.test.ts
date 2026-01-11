/**
 * Unit tests for Error Recovery
 * Tests app/lib/error-recovery.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock("~/lib/error-classification.server", () => ({
  classifyError: vi.fn(),
  RecoveryStrategy: {
    RETRY_EXPONENTIAL: "RETRY_EXPONENTIAL",
    RETRY_FIXED: "RETRY_FIXED",
    RETRY_IMMEDIATE: "RETRY_IMMEDIATE",
    SKIP: "SKIP",
    NO_RECOVERY: "NO_RECOVERY",
    MANUAL_INTERVENTION: "MANUAL_INTERVENTION",
  },
}));

import {
  classifyError,
  RecoveryStrategy,
} from "~/lib/error-classification.server";
import {
  attemptRecovery,
  canRecover,
  registerRecoveryHandler,
} from "~/lib/error-recovery.server";
import {
  ValidationError,
  RateLimitError,
  DatabaseError,
  NotFoundError,
} from "~/lib/errors";

describe("Error Recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("attemptRecovery", () => {
    it("should retry with exponential backoff", async () => {
      const error = new Error("Network timeout");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        category: "NETWORK",
        severity: "MEDIUM",
        retryable: true,
        retryDelay: 1000,
        requiresIntervention: false,
        recoveryStrategy: RecoveryStrategy.RETRY_EXPONENTIAL,
      });

      const result = await attemptRecovery(error, {
        maxAttempts: 3,
        currentAttempt: 0,
      });

      expect(result.success).toBe(true);
      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBeGreaterThan(0);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY_EXPONENTIAL);
    });

    it("should retry with fixed delay", async () => {
      const error = new RateLimitError("Rate limit exceeded");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        category: "RATE_LIMIT",
        severity: "MEDIUM",
        retryable: true,
        retryDelay: 60000,
        requiresIntervention: false,
        recoveryStrategy: RecoveryStrategy.RETRY_FIXED,
      });

      const result = await attemptRecovery(error, {
        maxAttempts: 3,
        currentAttempt: 0,
      });

      expect(result.success).toBe(true);
      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBe(60000);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY_FIXED);
    });

    it("should retry immediately", async () => {
      const error = new Error("Temporary failure");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        category: "UNKNOWN",
        severity: "MEDIUM",
        retryable: true,
        requiresIntervention: false,
        recoveryStrategy: RecoveryStrategy.RETRY_IMMEDIATE,
      });

      const result = await attemptRecovery(error, {
        maxAttempts: 3,
        currentAttempt: 0,
      });

      expect(result.success).toBe(true);
      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBe(0);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY_IMMEDIATE);
    });

    it("should skip operation", async () => {
      const error = new NotFoundError("Resource not found");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        category: "RESOURCE",
        severity: "MEDIUM",
        retryable: false,
        requiresIntervention: false,
        recoveryStrategy: RecoveryStrategy.SKIP,
      });

      const result = await attemptRecovery(error);

      expect(result.success).toBe(true);
      expect(result.shouldRetry).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.SKIP);
    });

    it("should not retry when max attempts reached", async () => {
      const error = new Error("Network timeout");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        category: "NETWORK",
        severity: "MEDIUM",
        retryable: true,
        retryDelay: 1000,
        requiresIntervention: false,
        recoveryStrategy: RecoveryStrategy.RETRY_EXPONENTIAL,
      });

      const result = await attemptRecovery(error, {
        maxAttempts: 3,
        currentAttempt: 3, // Already at max
      });

      expect(result.success).toBe(false);
      expect(result.shouldRetry).toBe(false);
      expect(result.error).toBe(error);
    });

    it("should require manual intervention", async () => {
      const error = new ValidationError("Invalid input");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        category: "VALIDATION",
        severity: "MEDIUM",
        retryable: false,
        requiresIntervention: false,
        recoveryStrategy: RecoveryStrategy.NO_RECOVERY,
      });

      const result = await attemptRecovery(error);

      expect(result.success).toBe(false);
      expect(result.shouldRetry).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.NO_RECOVERY);
    });

    it("should handle missing recovery handler gracefully", async () => {
      const error = new Error("Unknown error");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        category: "UNKNOWN",
        severity: "HIGH",
        retryable: false,
        requiresIntervention: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with invalid strategy type
        recoveryStrategy: "UNKNOWN_STRATEGY" as any,
      });

      const result = await attemptRecovery(error);

      expect(result.success).toBe(false);
      expect(result.shouldRetry).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.NO_RECOVERY);
    });

    it("should handle recovery handler errors", async () => {
      const error = new Error("Test error");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        category: "NETWORK",
        severity: "MEDIUM",
        retryable: true,
        retryDelay: 1000,
        requiresIntervention: false,
        recoveryStrategy: RecoveryStrategy.RETRY_EXPONENTIAL,
      });

      // Register a handler that throws
      const throwingHandler = async () => {
        throw new Error("Handler error");
      };
      registerRecoveryHandler(
        RecoveryStrategy.RETRY_EXPONENTIAL,
        throwingHandler
      );

      const result = await attemptRecovery(error, {
        maxAttempts: 3,
        currentAttempt: 0,
      });

      expect(result.success).toBe(false);
      expect(result.shouldRetry).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("canRecover", () => {
    it("should return true for recoverable errors", () => {
      const error = new Error("Network timeout");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        recoveryStrategy: RecoveryStrategy.RETRY_EXPONENTIAL,
      });

      expect(canRecover(error)).toBe(true);
    });

    it("should return false for non-recoverable errors", () => {
      const error = new ValidationError("Invalid input");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        recoveryStrategy: RecoveryStrategy.NO_RECOVERY,
      });

      expect(canRecover(error)).toBe(false);
    });

    it("should return false for errors requiring manual intervention", () => {
      const error = new DatabaseError("Database error");
      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      });

      expect(canRecover(error)).toBe(false);
    });
  });

  describe("registerRecoveryHandler", () => {
    it("should register custom recovery handler", async () => {
      const error = new Error("Custom error");
      const customHandler = vi.fn().mockResolvedValue({
        success: true,
        shouldRetry: true,
        retryDelay: 5000,
        strategy: RecoveryStrategy.RETRY_FIXED,
      });

      (classifyError as ReturnType<typeof vi.fn>).mockReturnValue({
        recoveryStrategy: RecoveryStrategy.RETRY_FIXED,
      });

      registerRecoveryHandler(RecoveryStrategy.RETRY_FIXED, customHandler);

      await attemptRecovery(error);

      expect(customHandler).toHaveBeenCalled();
    });
  });
});
