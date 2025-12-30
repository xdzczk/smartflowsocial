/**
 * Error Metrics Service
 * 
 * Tracks error rates, types, and patterns for monitoring and alerting
 */

import type { AppError } from "./errors";
export interface ErrorMetric {
  code: string;
  count: number;
  lastOccurred: string;
  statusCode: number;
  isOperational: boolean;
}

export interface ErrorMetricsSummary {
  totalErrors: number;
  operationalErrors: number;
  nonOperationalErrors: number;
  errorsByCode: Record<string, ErrorMetric>;
  errorsByStatusCode: Record<number, number>;
  recentErrors: {
    code: string;
    message: string;
    timestamp: string;
    statusCode: number;
    context?: Record<string, unknown>;
  }[];
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * In-memory error metrics storage
 * In production, consider using Redis or a time-series database
 */
class ErrorMetricsStore {
  private metrics = new Map<string, ErrorMetric>();
  private recentErrors: {
    code: string;
    message: string;
    timestamp: string;
    statusCode: number;
    context?: Record<string, unknown>;
  }[] = [];
  private readonly maxRecentErrors = 100; // Keep last 100 errors
  private startTime: Date = new Date();

  /**
   * Record an error metric
   */
  recordError(error: AppError): void {
    const code = error.code;
    const existing = this.metrics.get(code);

    if (existing) {
      existing.count += 1;
      existing.lastOccurred = error.timestamp;
    } else {
      this.metrics.set(code, {
        code,
        count: 1,
        lastOccurred: error.timestamp,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
      });
    }

    // Track recent errors
    this.recentErrors.unshift({
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      statusCode: error.statusCode,
      context: error.context,
    });

    // Keep only the most recent errors
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): Map<string, ErrorMetric> {
    return new Map(this.metrics);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 20): {
    code: string;
    message: string;
    timestamp: string;
    statusCode: number;
    context?: Record<string, unknown>;
  }[] {
    return this.recentErrors.slice(0, limit);
  }

  /**
   * Get metrics summary
   */
  getSummary(): ErrorMetricsSummary {
    const errorsByCode: Record<string, ErrorMetric> = {};
    const errorsByStatusCode: Record<number, number> = {};
    let totalErrors = 0;
    let operationalErrors = 0;
    let nonOperationalErrors = 0;

    for (const [code, metric] of this.metrics.entries()) {
      errorsByCode[code] = { ...metric };
      totalErrors += metric.count;

      if (metric.isOperational) {
        operationalErrors += metric.count;
      } else {
        nonOperationalErrors += metric.count;
      }

      errorsByStatusCode[metric.statusCode] =
        (errorsByStatusCode[metric.statusCode] || 0) + metric.count;
    }

    return {
      totalErrors,
      operationalErrors,
      nonOperationalErrors,
      errorsByCode,
      errorsByStatusCode,
      recentErrors: this.recentErrors.slice(0, 20),
      timeRange: {
        start: this.startTime.toISOString(),
        end: new Date().toISOString(),
      },
    };
  }

  /**
   * Reset all metrics (useful for testing or periodic resets)
   */
  reset(): void {
    this.metrics.clear();
    this.recentErrors = [];
    this.startTime = new Date();
  }

  /**
   * Get error rate (errors per minute)
   */
  getErrorRate(): number {
    const now = new Date();
    const minutesElapsed =
      (now.getTime() - this.startTime.getTime()) / (1000 * 60);
    if (minutesElapsed === 0) return 0;
    return this.getSummary().totalErrors / minutesElapsed;
  }
}

// Singleton instance
const metricsStore = new ErrorMetricsStore();

/**
 * Record an error in metrics
 */
export function recordErrorMetric(error: AppError): void {
  metricsStore.recordError(error);
}

/**
 * Get error metrics summary
 */
export function getErrorMetrics(): ErrorMetricsSummary {
  return metricsStore.getSummary();
}

/**
 * Get error rate (errors per minute)
 */
export function getErrorRate(): number {
  return metricsStore.getErrorRate();
}

/**
 * Get recent errors
 */
export function getRecentErrors(
  limit = 20,
): {
  code: string;
  message: string;
  timestamp: string;
  statusCode: number;
  context?: Record<string, unknown>;
}[] {
  return metricsStore.getRecentErrors(limit);
}

/**
 * Reset metrics (use with caution - mainly for testing)
 */
export function resetErrorMetrics(): void {
  metricsStore.reset();
}

/**
 * Check if error rate exceeds threshold
 */
export function isErrorRateHigh(threshold = 10): boolean {
  return getErrorRate() > threshold;
}

/**
 * Get top error codes by count
 */
export function getTopErrorCodes(limit = 10): {
  code: string;
  count: number;
  statusCode: number;
}[] {
  const summary = getErrorMetrics();
  return Object.values(summary.errorsByCode)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((metric) => ({
      code: metric.code,
      count: metric.count,
      statusCode: metric.statusCode,
    }));
}












