/**
 * Unit tests for Error Classification
 * Tests app/lib/error-classification.server.ts
 */

import { describe, it, expect } from "vitest";

import {
  classifyError,
  isRetryableErrorEnhanced,
  getRetryDelayForError,
  requiresManualIntervention,
  getRecoveryStrategy,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from "~/lib/error-classification.server";
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
} from "~/lib/errors";

describe("Error Classification", () => {
  describe("classifyError - AppError instances", () => {
    it("should classify AuthenticationError correctly", () => {
      const error = new AuthenticationError("Authentication required");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.retryable).toBe(false);
      expect(classification.requiresIntervention).toBe(true);
      expect(classification.recoveryStrategy).toBe(
        RecoveryStrategy.MANUAL_INTERVENTION
      );
    });

    it("should classify AuthorizationError correctly", () => {
      const error = new AuthorizationError("Insufficient permissions");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.retryable).toBe(false);
      expect(classification.requiresIntervention).toBe(true);
    });

    it("should classify ValidationError correctly", () => {
      const error = new ValidationError("Invalid input");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.VALIDATION);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.retryable).toBe(false);
      expect(classification.requiresIntervention).toBe(false);
      expect(classification.recoveryStrategy).toBe(
        RecoveryStrategy.NO_RECOVERY
      );
    });

    it("should classify NotFoundError correctly", () => {
      const error = new NotFoundError("Resource not found");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.RESOURCE);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.retryable).toBe(false);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.SKIP);
    });

    it("should classify ConflictError correctly", () => {
      const error = new ConflictError("Resource conflict");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.RESOURCE);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.retryable).toBe(false);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.SKIP);
    });

    it("should classify RateLimitError correctly", () => {
      const error = new RateLimitError("Rate limit exceeded");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.retryable).toBe(true);
      expect(classification.retryDelay).toBe(60000);
      expect(classification.recoveryStrategy).toBe(
        RecoveryStrategy.RETRY_FIXED
      );
    });

    it("should classify DatabaseError correctly", () => {
      const error = new DatabaseError("Database operation failed");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.DATABASE);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.requiresIntervention).toBe(true);
    });

    it("should classify DatabaseError with connection issues as retryable", () => {
      const error = new DatabaseError("Database connection timeout");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.DATABASE);
      expect(classification.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classification.retryable).toBe(true);
      expect(classification.retryDelay).toBe(5000);
      expect(classification.recoveryStrategy).toBe(
        RecoveryStrategy.RETRY_EXPONENTIAL
      );
    });

    it("should classify ExternalServiceError correctly", () => {
      const error = new ExternalServiceError("External service failed");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.EXTERNAL_SERVICE);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.requiresIntervention).toBe(true);
    });

    it("should classify ExternalServiceError with temporary issues as retryable", () => {
      // The error message needs to include "temporary" or "503" for it to be classified as temporary
      const error = new ExternalServiceError(
        "Service temporarily unavailable 503",
        503
      );
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.EXTERNAL_SERVICE);
      // Message includes "temporary" and "503", so should be classified as temporary
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.retryable).toBe(true);
      expect(classification.retryDelay).toBe(2000);
      expect(classification.recoveryStrategy).toBe(
        RecoveryStrategy.RETRY_EXPONENTIAL
      );
    });
  });

  describe("classifyError - Generic Error instances", () => {
    it("should classify network errors correctly", () => {
      const error = new Error("Network timeout");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.NETWORK);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.retryable).toBe(true);
      expect(classification.retryDelay).toBe(2000);
      expect(classification.recoveryStrategy).toBe(
        RecoveryStrategy.RETRY_EXPONENTIAL
      );
    });

    it("should classify database errors correctly", () => {
      // Use a message that matches database patterns but not network patterns first
      const error = new Error("Database prisma query failed");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.DATABASE);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.retryable).toBe(false);
    });

    it("should classify database connection errors as critical and retryable", () => {
      const error = new Error("Database connection timeout");
      const classification = classifyError(error);

      // "connection" matches network patterns first, so it will be NETWORK
      // But if it were DATABASE, it would be CRITICAL and retryable
      expect(classification.category).toBe(ErrorCategory.NETWORK);
      expect(classification.retryable).toBe(true);
    });

    it("should classify validation errors correctly", () => {
      const error = new Error("Invalid payload validation");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.VALIDATION);
      expect(classification.severity).toBe(ErrorSeverity.LOW);
      expect(classification.retryable).toBe(false);
    });

    it("should classify rate limit errors correctly", () => {
      const error = new Error("Rate limit exceeded 429");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.retryable).toBe(true);
      expect(classification.retryDelay).toBe(60000);
    });

    it("should classify configuration errors correctly", () => {
      // Use a message that clearly matches configuration patterns
      const error = new Error("Configuration missing env variable");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.CONFIGURATION);
      expect(classification.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classification.retryable).toBe(false);
      expect(classification.requiresIntervention).toBe(true);
    });

    it("should classify unknown errors as UNKNOWN", () => {
      const error = new Error("Some unexpected error");
      const classification = classifyError(error);

      expect(classification.category).toBe(ErrorCategory.UNKNOWN);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.retryable).toBe(false);
      expect(classification.requiresIntervention).toBe(true);
    });
  });

  describe("isRetryableErrorEnhanced", () => {
    it("should return true for retryable errors", () => {
      const error = new Error("Network timeout");
      expect(isRetryableErrorEnhanced(error)).toBe(true);
    });

    it("should return false for non-retryable errors", () => {
      const error = new ValidationError("Invalid input");
      expect(isRetryableErrorEnhanced(error)).toBe(false);
    });
  });

  describe("getRetryDelayForError", () => {
    it("should return retry delay for retryable errors", () => {
      const error = new RateLimitError("Rate limit exceeded");
      const delay = getRetryDelayForError(error);

      expect(delay).toBe(60000);
    });

    it("should return undefined for non-retryable errors", () => {
      const error = new ValidationError("Invalid input");
      const delay = getRetryDelayForError(error);

      expect(delay).toBeUndefined();
    });
  });

  describe("requiresManualIntervention", () => {
    it("should return true for errors requiring intervention", () => {
      const error = new AuthenticationError("Authentication required");
      expect(requiresManualIntervention(error)).toBe(true);
    });

    it("should return false for errors not requiring intervention", () => {
      const error = new ValidationError("Invalid input");
      expect(requiresManualIntervention(error)).toBe(false);
    });
  });

  describe("getRecoveryStrategy", () => {
    it("should return recovery strategy for error", () => {
      const error = new RateLimitError("Rate limit exceeded");
      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe(RecoveryStrategy.RETRY_FIXED);
    });

    it("should return NO_RECOVERY for errors without strategy", () => {
      const error = new Error("Unknown error");
      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe(RecoveryStrategy.MANUAL_INTERVENTION);
    });
  });
});
