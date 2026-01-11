/**
 * Error Recovery Strategies
 *
 * Implements recovery strategies for different error types.
 * Provides automatic and manual recovery mechanisms.
 */

import {
  classifyError,
  type ErrorClassification,
  RecoveryStrategy,
} from "./error-classification.server";
import { logError, logInfo, logWarning } from "./error-logger.server";
import type { AppError } from "./errors";

/**
 * Recovery context
 */
export interface RecoveryContext {
  /** Number of recovery attempts */
  attempts: number;
  /** Maximum recovery attempts */
  maxAttempts: number;
  /** Last error */
  lastError: Error | AppError;
  /** Error classification */
  classification: ErrorClassification;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Whether to retry the operation */
  shouldRetry: boolean;
  /** Delay before retry (in milliseconds) */
  retryDelay?: number;
  /** Error if recovery failed */
  error?: Error | AppError;
  /** Recovery strategy used */
  strategy: RecoveryStrategy;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Recovery handler function type
 */
type RecoveryHandler = (
  error: Error | AppError,
  context: RecoveryContext
) => Promise<RecoveryResult> | RecoveryResult;

/**
 * Recovery handlers registry
 */
const recoveryHandlers = new Map<RecoveryStrategy, RecoveryHandler>();

/**
 * Register a recovery handler
 */
export function registerRecoveryHandler(
  strategy: RecoveryStrategy,
  handler: RecoveryHandler
): void {
  recoveryHandlers.set(strategy, handler);
}

/**
 * Default recovery handler: Retry with exponential backoff
 */
async function handleRetryExponential(
  error: Error | AppError,
  context: RecoveryContext
): Promise<RecoveryResult> {
  const { attempts, maxAttempts, classification } = context;

  if (attempts >= maxAttempts) {
    return {
      success: false,
      shouldRetry: false,
      strategy: RecoveryStrategy.RETRY_EXPONENTIAL,
      error,
      context: { maxAttemptsReached: true },
    };
  }

  // Calculate exponential backoff: baseDelay * 2^attempts
  const baseDelay = classification.retryDelay ?? 1000;
  const delay = Math.min(baseDelay * Math.pow(2, attempts), 30000); // Cap at 30s

  logInfo("Retrying with exponential backoff", {
    attempts,
    maxAttempts,
    delay,
    error: error.message,
    category: classification.category,
  });

  return {
    success: true,
    shouldRetry: true,
    retryDelay: delay,
    strategy: RecoveryStrategy.RETRY_EXPONENTIAL,
    context: { attempts, delay },
  };
}

/**
 * Default recovery handler: Retry with fixed delay
 */
async function handleRetryFixed(
  error: Error | AppError,
  context: RecoveryContext
): Promise<RecoveryResult> {
  const { attempts, maxAttempts, classification } = context;

  if (attempts >= maxAttempts) {
    return {
      success: false,
      shouldRetry: false,
      strategy: RecoveryStrategy.RETRY_FIXED,
      error,
      context: { maxAttemptsReached: true },
    };
  }

  const delay = classification.retryDelay ?? 5000;

  logInfo("Retrying with fixed delay", {
    attempts,
    maxAttempts,
    delay,
    error: error.message,
    category: classification.category,
  });

  return {
    success: true,
    shouldRetry: true,
    retryDelay: delay,
    strategy: RecoveryStrategy.RETRY_FIXED,
    context: { attempts, delay },
  };
}

/**
 * Default recovery handler: Retry immediately
 */
async function handleRetryImmediate(
  error: Error | AppError,
  context: RecoveryContext
): Promise<RecoveryResult> {
  const { attempts, maxAttempts } = context;

  if (attempts >= maxAttempts) {
    return {
      success: false,
      shouldRetry: false,
      strategy: RecoveryStrategy.RETRY_IMMEDIATE,
      error,
      context: { maxAttemptsReached: true },
    };
  }

  logInfo("Retrying immediately", {
    attempts,
    maxAttempts,
    error: error.message,
  });

  return {
    success: true,
    shouldRetry: true,
    retryDelay: 0,
    strategy: RecoveryStrategy.RETRY_IMMEDIATE,
    context: { attempts },
  };
}

/**
 * Default recovery handler: Skip operation
 */
async function handleSkip(
  error: Error | AppError,
  context: RecoveryContext
): Promise<RecoveryResult> {
  logWarning("Skipping operation due to error", {
    error: error.message,
    category: context.classification.category,
    context: context.context,
  });

  return {
    success: true,
    shouldRetry: false,
    strategy: RecoveryStrategy.SKIP,
    context: { skipped: true },
  };
}

/**
 * Default recovery handler: No recovery
 */
async function handleNoRecovery(
  error: Error | AppError,
  context: RecoveryContext
): Promise<RecoveryResult> {
  logError(error, {
    message: "No recovery strategy available",
    category: context.classification.category,
    context: context.context,
  });

  return {
    success: false,
    shouldRetry: false,
    strategy: RecoveryStrategy.NO_RECOVERY,
    error,
    context: { noRecovery: true },
  };
}

/**
 * Default recovery handler: Manual intervention required
 */
async function handleManualIntervention(
  error: Error | AppError,
  context: RecoveryContext
): Promise<RecoveryResult> {
  logError(error, {
    message: "Manual intervention required",
    category: context.classification.category,
    severity: context.classification.severity,
    context: context.context,
  });

  return {
    success: false,
    shouldRetry: false,
    strategy: RecoveryStrategy.MANUAL_INTERVENTION,
    error,
    context: {
      requiresIntervention: true,
      category: context.classification.category,
      severity: context.classification.severity,
    },
  };
}

/**
 * Initialize default recovery handlers
 */
function initializeRecoveryHandlers(): void {
  registerRecoveryHandler(
    RecoveryStrategy.RETRY_EXPONENTIAL,
    handleRetryExponential
  );
  registerRecoveryHandler(RecoveryStrategy.RETRY_FIXED, handleRetryFixed);
  registerRecoveryHandler(
    RecoveryStrategy.RETRY_IMMEDIATE,
    handleRetryImmediate
  );
  registerRecoveryHandler(RecoveryStrategy.SKIP, handleSkip);
  registerRecoveryHandler(RecoveryStrategy.NO_RECOVERY, handleNoRecovery);
  registerRecoveryHandler(
    RecoveryStrategy.MANUAL_INTERVENTION,
    handleManualIntervention
  );
}

// Initialize handlers on module load
initializeRecoveryHandlers();

/**
 * Attempt to recover from an error
 */
export async function attemptRecovery(
  error: Error | AppError,
  options: {
    maxAttempts?: number;
    currentAttempt?: number;
    context?: Record<string, unknown>;
  } = {}
): Promise<RecoveryResult> {
  const classification = classifyError(error);
  const maxAttempts = options.maxAttempts ?? 3;
  const currentAttempt = options.currentAttempt ?? 0;

  const recoveryContext: RecoveryContext = {
    attempts: currentAttempt,
    maxAttempts,
    lastError: error,
    classification,
    context: options.context,
  };

  const strategy =
    classification.recoveryStrategy ?? RecoveryStrategy.NO_RECOVERY;
  const handler = recoveryHandlers.get(strategy);

  if (!handler) {
    logWarning("No recovery handler found for strategy", {
      strategy,
      error: error.message,
    });
    return {
      success: false,
      shouldRetry: false,
      strategy: RecoveryStrategy.NO_RECOVERY,
      error,
      context: { noHandler: true },
    };
  }

  try {
    return await handler(error, recoveryContext);
  } catch (recoveryError) {
    logError(
      recoveryError instanceof Error
        ? recoveryError
        : new Error(String(recoveryError)),
      {
        message: "Error during recovery attempt",
        originalError: error.message,
        strategy,
      }
    );
    return {
      success: false,
      shouldRetry: false,
      strategy: RecoveryStrategy.NO_RECOVERY,
      error:
        recoveryError instanceof Error
          ? recoveryError
          : new Error(String(recoveryError)),
      context: { recoveryFailed: true },
    };
  }
}

/**
 * Check if error can be recovered from
 */
export function canRecover(error: Error | AppError): boolean {
  const classification = classifyError(error);
  return (
    classification.recoveryStrategy !== RecoveryStrategy.NO_RECOVERY &&
    classification.recoveryStrategy !== RecoveryStrategy.MANUAL_INTERVENTION
  );
}
