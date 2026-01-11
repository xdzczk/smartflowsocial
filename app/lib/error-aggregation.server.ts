/**
 * Error Aggregation Service
 *
 * Aggregates errors by category, severity, and other dimensions for reporting and analysis.
 */

import * as promClient from "prom-client";
import { singleton } from "./singleton.server";
import {
  classifyError,
  ErrorCategory,
  ErrorSeverity,
  type ErrorClassification,
} from "./error-classification.server";
import type { AppError } from "./errors";

/**
 * Get or create a Prometheus metric
 */
function getOrCreateMetric<T extends promClient.Metric>(
  name: string,
  factory: () => T
): T {
  const existing = promClient.register.getSingleMetric(name);
  if (existing) {
    return existing as T;
  }
  return factory();
}

/**
 * Error category counter
 */
export const errorCategoryCounter = getOrCreateMetric(
  "errors_by_category_total",
  () =>
    new promClient.Counter({
      name: "errors_by_category_total",
      help: "Total number of errors by category",
      labelNames: ["category", "severity", "retryable"],
    })
);

/**
 * Error severity gauge
 */
export const errorSeverityGauge = getOrCreateMetric(
  "errors_severity_current",
  () =>
    new promClient.Gauge({
      name: "errors_severity_current",
      help: "Current error severity levels",
      labelNames: ["severity"],
    })
);

/**
 * Error recovery attempts counter
 */
export const errorRecoveryAttemptsCounter = getOrCreateMetric(
  "error_recovery_attempts_total",
  () =>
    new promClient.Counter({
      name: "error_recovery_attempts_total",
      help: "Total number of error recovery attempts",
      labelNames: ["category", "strategy", "success"],
    })
);

/**
 * Error aggregation store
 */
class ErrorAggregationStore {
  private readonly errorsByCategory = new Map<
    ErrorCategory,
    Array<{ error: Error | AppError; classification: ErrorClassification; timestamp: Date }>
  >();
  private readonly errorsBySeverity = new Map<
    ErrorSeverity,
    Array<{ error: Error | AppError; classification: ErrorClassification; timestamp: Date }>
  >();
  private readonly maxErrorsPerCategory = 100; // Keep last 100 errors per category

  /**
   * Record an error for aggregation
   */
  recordError(error: Error | AppError): void {
    const classification = classifyError(error);

    // Record in Prometheus
    errorCategoryCounter.inc({
      category: classification.category,
      severity: classification.severity,
      retryable: String(classification.retryable),
    });

    errorSeverityGauge.set(
      { severity: classification.severity },
      this.errorsBySeverity.get(classification.severity)?.length ?? 0
    );

    // Store error by category
    const categoryErrors = this.errorsByCategory.get(classification.category) ?? [];
    categoryErrors.unshift({
      error,
      classification,
      timestamp: new Date(),
    });

    // Keep only recent errors
    if (categoryErrors.length > this.maxErrorsPerCategory) {
      categoryErrors.splice(this.maxErrorsPerCategory);
    }
    this.errorsByCategory.set(classification.category, categoryErrors);

    // Store error by severity
    const severityErrors = this.errorsBySeverity.get(classification.severity) ?? [];
    severityErrors.unshift({
      error,
      classification,
      timestamp: new Date(),
    });

    if (severityErrors.length > this.maxErrorsPerCategory) {
      severityErrors.splice(this.maxErrorsPerCategory);
    }
    this.errorsBySeverity.set(classification.severity, severityErrors);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(
    category: ErrorCategory,
    limit = 20
  ): Array<{ error: Error | AppError; classification: ErrorClassification; timestamp: Date }> {
    return (this.errorsByCategory.get(category) ?? []).slice(0, limit);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(
    severity: ErrorSeverity,
    limit = 20
  ): Array<{ error: Error | AppError; classification: ErrorClassification; timestamp: Date }> {
    return (this.errorsBySeverity.get(severity) ?? []).slice(0, limit);
  }

  /**
   * Get aggregation summary
   */
  getSummary(): {
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    criticalErrors: number;
    highSeverityErrors: number;
    retryableErrors: number;
    nonRetryableErrors: number;
  } {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let criticalErrors = 0;
    let highSeverityErrors = 0;
    let retryableErrors = 0;
    let nonRetryableErrors = 0;

    for (const [category, errors] of this.errorsByCategory.entries()) {
      byCategory[category] = errors.length;
      for (const { classification } of errors) {
        if (classification.severity === ErrorSeverity.CRITICAL) {
          criticalErrors++;
        }
        if (classification.severity === ErrorSeverity.HIGH) {
          highSeverityErrors++;
        }
        if (classification.retryable) {
          retryableErrors++;
        } else {
          nonRetryableErrors++;
        }
      }
    }

    for (const [severity, errors] of this.errorsBySeverity.entries()) {
      bySeverity[severity] = errors.length;
    }

    return {
      byCategory: byCategory as Record<ErrorCategory, number>,
      bySeverity: bySeverity as Record<ErrorSeverity, number>,
      criticalErrors,
      highSeverityErrors,
      retryableErrors,
      nonRetryableErrors,
    };
  }

  /**
   * Get top error categories
   */
  getTopCategories(limit = 10): Array<{ category: ErrorCategory; count: number }> {
    const summary = this.getSummary();
    return Object.entries(summary.byCategory)
      .map(([category, count]) => ({
        category: category as ErrorCategory,
        count: count as number,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Reset aggregation (for testing)
   */
  reset(): void {
    this.errorsByCategory.clear();
    this.errorsBySeverity.clear();
  }
}

// Singleton instance
const aggregationStore = singleton("errorAggregationStore", () => new ErrorAggregationStore());

/**
 * Record an error for aggregation
 */
export function recordErrorForAggregation(error: Error | AppError): void {
  aggregationStore.recordError(error);
}

/**
 * Get errors by category
 */
export function getErrorsByCategory(
  category: ErrorCategory,
  limit = 20
): Array<{ error: Error | AppError; classification: ErrorClassification; timestamp: Date }> {
  return aggregationStore.getErrorsByCategory(category, limit);
}

/**
 * Get errors by severity
 */
export function getErrorsBySeverity(
  severity: ErrorSeverity,
  limit = 20
): Array<{ error: Error | AppError; classification: ErrorClassification; timestamp: Date }> {
  return aggregationStore.getErrorsBySeverity(severity, limit);
}

/**
 * Get aggregation summary
 */
export function getErrorAggregationSummary(): {
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  criticalErrors: number;
  highSeverityErrors: number;
  retryableErrors: number;
  nonRetryableErrors: number;
} {
  return aggregationStore.getSummary();
}

/**
 * Get top error categories
 */
export function getTopErrorCategories(limit = 10): Array<{ category: ErrorCategory; count: number }> {
  return aggregationStore.getTopCategories(limit);
}

/**
 * Record recovery attempt
 */
export function recordRecoveryAttempt(
  category: ErrorCategory,
  strategy: string,
  success: boolean
): void {
  errorRecoveryAttemptsCounter.inc({
    category,
    strategy,
    success: String(success),
  });
}
