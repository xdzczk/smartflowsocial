/**
 * Error Classification System
 *
 * Comprehensive error classification for better error handling, recovery, and reporting.
 * Extends the basic retryable/non-retryable classification with more granular categories.
 */

import type { AppError } from "./errors";
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "./errors";

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  /** Network-related errors (timeouts, connection failures) */
  NETWORK = "NETWORK",
  /** Database errors (connection, query failures) */
  DATABASE = "DATABASE",
  /** External service errors (API failures, third-party services) */
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE",
  /** Validation errors (invalid input, malformed data) */
  VALIDATION = "VALIDATION",
  /** Authentication errors (missing/invalid credentials) */
  AUTHENTICATION = "AUTHENTICATION",
  /** Authorization errors (insufficient permissions) */
  AUTHORIZATION = "AUTHORIZATION",
  /** Resource errors (not found, conflicts) */
  RESOURCE = "RESOURCE",
  /** Rate limiting errors */
  RATE_LIMIT = "RATE_LIMIT",
  /** Configuration errors (missing env vars, misconfiguration) */
  CONFIGURATION = "CONFIGURATION",
  /** Business logic errors (domain-specific failures) */
  BUSINESS_LOGIC = "BUSINESS_LOGIC",
  /** Unknown/unclassified errors */
  UNKNOWN = "UNKNOWN",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Low severity - informational, doesn't affect functionality */
  LOW = "LOW",
  /** Medium severity - affects functionality but recoverable */
  MEDIUM = "MEDIUM",
  /** High severity - significant impact, may require intervention */
  HIGH = "HIGH",
  /** Critical severity - system failure, requires immediate attention */
  CRITICAL = "CRITICAL",
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Whether error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds (if retryable) */
  retryDelay?: number;
  /** Whether error requires manual intervention */
  requiresIntervention: boolean;
  /** Suggested recovery strategy */
  recoveryStrategy?: RecoveryStrategy;
  /** Additional context about the error */
  context?: Record<string, unknown>;
}

/**
 * Recovery strategies
 */
export enum RecoveryStrategy {
  /** Retry with exponential backoff */
  RETRY_EXPONENTIAL = "RETRY_EXPONENTIAL",
  /** Retry with fixed delay */
  RETRY_FIXED = "RETRY_FIXED",
  /** Retry immediately */
  RETRY_IMMEDIATE = "RETRY_IMMEDIATE",
  /** Fallback to alternative service/method */
  FALLBACK = "FALLBACK",
  /** Skip and continue */
  SKIP = "SKIP",
  /** Require manual intervention */
  MANUAL_INTERVENTION = "MANUAL_INTERVENTION",
  /** No recovery possible */
  NO_RECOVERY = "NO_RECOVERY",
}

/**
 * Classify an error
 */
export function classifyError(error: Error | AppError): ErrorClassification {
  // Handle AppError instances
  if (isAppError(error)) {
    return classifyAppError(error);
  }

  // Handle generic Error instances
  return classifyGenericError(error);
}

/**
 * Classify an AppError
 */
function classifyAppError(error: AppError): ErrorClassification {
  const errorMessage = error.message.toLowerCase();
  const errorCode = error.code;

  // Authentication errors
  if (error instanceof AuthenticationError || errorCode === "AUTHENTICATION_ERROR") {
    return {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      requiresIntervention: true,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      context: { code: errorCode, statusCode: error.statusCode },
    };
  }

  // Authorization errors
  if (error instanceof AuthorizationError || errorCode === "AUTHORIZATION_ERROR") {
    return {
      category: ErrorCategory.AUTHORIZATION,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      requiresIntervention: true,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      context: { code: errorCode, statusCode: error.statusCode },
    };
  }

  // Validation errors
  if (error instanceof ValidationError || errorCode === "VALIDATION_ERROR") {
    return {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      requiresIntervention: false,
      recoveryStrategy: RecoveryStrategy.NO_RECOVERY,
      context: { code: errorCode, statusCode: error.statusCode },
    };
  }

  // Not found errors
  if (error instanceof NotFoundError || errorCode === "NOT_FOUND_ERROR") {
    return {
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      requiresIntervention: false,
      recoveryStrategy: RecoveryStrategy.SKIP,
      context: { code: errorCode, statusCode: error.statusCode },
    };
  }

  // Conflict errors
  if (error instanceof ConflictError || errorCode === "CONFLICT_ERROR") {
    return {
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      requiresIntervention: false,
      recoveryStrategy: RecoveryStrategy.SKIP,
      context: { code: errorCode, statusCode: error.statusCode },
    };
  }

  // Rate limit errors
  if (error instanceof RateLimitError || errorCode === "RATE_LIMIT_ERROR") {
    return {
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      retryDelay: 60000, // 1 minute default for rate limits
      requiresIntervention: false,
      recoveryStrategy: RecoveryStrategy.RETRY_FIXED,
      context: { code: errorCode, statusCode: error.statusCode },
    };
  }

  // Database errors
  if (error instanceof DatabaseError || errorCode === "DATABASE_ERROR") {
    const isConnectionError =
      errorMessage.includes("connection") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("econnrefused") ||
      errorMessage.includes("etimedout");

    return {
      category: ErrorCategory.DATABASE,
      severity: isConnectionError ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
      retryable: isConnectionError,
      retryDelay: isConnectionError ? 5000 : undefined,
      requiresIntervention: !isConnectionError,
      recoveryStrategy: isConnectionError
        ? RecoveryStrategy.RETRY_EXPONENTIAL
        : RecoveryStrategy.MANUAL_INTERVENTION,
      context: { code: errorCode, statusCode: error.statusCode, isConnectionError },
    };
  }

  // External service errors
  if (error instanceof ExternalServiceError || errorCode === "EXTERNAL_SERVICE_ERROR") {
    const isTemporary =
      errorMessage.includes("timeout") ||
      errorMessage.includes("503") ||
      errorMessage.includes("502") ||
      errorMessage.includes("504") ||
      errorMessage.includes("temporary");

    return {
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: isTemporary ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH,
      retryable: isTemporary,
      retryDelay: isTemporary ? 2000 : undefined,
      requiresIntervention: !isTemporary,
      recoveryStrategy: isTemporary
        ? RecoveryStrategy.RETRY_EXPONENTIAL
        : RecoveryStrategy.MANUAL_INTERVENTION,
      context: { code: errorCode, statusCode: error.statusCode, isTemporary },
    };
  }

  // Unknown/Internal errors
  return {
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.HIGH,
    retryable: false,
    requiresIntervention: true,
    recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
    context: { code: errorCode, statusCode: error.statusCode },
  };
}

/**
 * Classify a generic Error
 */
function classifyGenericError(error: Error): ErrorClassification {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("etimedout") ||
    errorMessage.includes("eai_again") ||
    errorName.includes("network") ||
    errorName.includes("timeout")
  ) {
    return {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      retryDelay: 2000,
      requiresIntervention: false,
      recoveryStrategy: RecoveryStrategy.RETRY_EXPONENTIAL,
      context: { errorName, errorMessage },
    };
  }

  // Database errors
  if (
    errorMessage.includes("database") ||
    errorMessage.includes("prisma") ||
    errorMessage.includes("unique constraint") ||
    errorMessage.includes("foreign key") ||
    errorName.includes("prisma")
  ) {
    const isConnectionError =
      errorMessage.includes("connection") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("can't reach");

    return {
      category: ErrorCategory.DATABASE,
      severity: isConnectionError ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
      retryable: isConnectionError,
      retryDelay: isConnectionError ? 5000 : undefined,
      requiresIntervention: !isConnectionError,
      recoveryStrategy: isConnectionError
        ? RecoveryStrategy.RETRY_EXPONENTIAL
        : RecoveryStrategy.MANUAL_INTERVENTION,
      context: { errorName, errorMessage, isConnectionError },
    };
  }

  // Validation errors
  if (
    errorMessage.includes("validation") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("malformed") ||
    errorMessage.includes("required")
  ) {
    return {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      retryable: false,
      requiresIntervention: false,
      recoveryStrategy: RecoveryStrategy.NO_RECOVERY,
      context: { errorName, errorMessage },
    };
  }

  // Rate limit errors
  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("429") ||
    errorMessage.includes("too many requests")
  ) {
    return {
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      retryDelay: 60000, // 1 minute
      requiresIntervention: false,
      recoveryStrategy: RecoveryStrategy.RETRY_FIXED,
      context: { errorName, errorMessage },
    };
  }

  // Configuration errors
  if (
    errorMessage.includes("configuration") ||
    errorMessage.includes("env") ||
    errorMessage.includes("missing") ||
    errorMessage.includes("not configured")
  ) {
    return {
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.CRITICAL,
      retryable: false,
      requiresIntervention: true,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      context: { errorName, errorMessage },
    };
  }

  // Unknown errors - default classification
  return {
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.HIGH,
    retryable: false,
    requiresIntervention: true,
    recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
    context: { errorName, errorMessage },
  };
}

/**
 * Check if error is retryable (enhanced version)
 */
export function isRetryableErrorEnhanced(error: Error | AppError): boolean {
  const classification = classifyError(error);
  return classification.retryable;
}

/**
 * Get suggested retry delay for an error
 */
export function getRetryDelayForError(error: Error | AppError): number | undefined {
  const classification = classifyError(error);
  return classification.retryDelay;
}

/**
 * Check if error requires manual intervention
 */
export function requiresManualIntervention(error: Error | AppError): boolean {
  const classification = classifyError(error);
  return classification.requiresIntervention;
}

/**
 * Get recovery strategy for an error
 */
export function getRecoveryStrategy(error: Error | AppError): RecoveryStrategy {
  const classification = classifyError(error);
  return classification.recoveryStrategy ?? RecoveryStrategy.NO_RECOVERY;
}

/**
 * Type guard for AppError
 */
function isAppError(error: Error | AppError): error is AppError {
  return "code" in error && "statusCode" in error;
}
