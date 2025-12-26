/**
 * Query Performance Metrics
 * 
 * Provides Prometheus metrics for database query performance monitoring.
 * Metrics are automatically registered with the default Prometheus registry
 * and will be exposed via the /metrics endpoint.
 */

import * as promClient from "prom-client";

import { singleton } from "./singleton.server";

/**
 * Get or create a metric, handling hot-reloads gracefully
 */
function getOrCreateMetric<T extends promClient.Metric>(
  name: string,
  factory: () => T,
): T {
  return singleton(`prom_metric_${name}`, () => {
    // Check if metric already exists in registry
    const registry = promClient.register;
    try {
      const existingMetric = registry.getSingleMetric(name);
      if (existingMetric) {
        return existingMetric as T;
      }
    } catch {
      // Metric doesn't exist, continue to create it
    }
    
    try {
      return factory();
    } catch (error) {
      // If metric already exists (e.g., from hot reload), try to get it
      if (
        error instanceof Error &&
        error.message.includes("has already been registered")
      ) {
        const existingMetric = registry.getSingleMetric(name);
        if (existingMetric) {
          return existingMetric as T;
        }
      }
      throw error;
    }
  });
}

/**
 * Query duration histogram
 * Tracks how long queries take, broken down by model and action
 * 
 * Example PromQL queries:
 * - Average query time: rate(prisma_query_duration_ms_sum[5m]) / rate(prisma_query_duration_ms_count[5m])
 * - P95 query time: histogram_quantile(0.95, rate(prisma_query_duration_ms_bucket[5m]))
 * - Slow queries: rate(prisma_slow_query_total[5m])
 */
export const queryDurationHistogram = getOrCreateMetric(
  "prisma_query_duration_ms",
  () =>
    new promClient.Histogram({
      name: "prisma_query_duration_ms",
      help: "Duration of Prisma queries in milliseconds",
      labelNames: ["model", "action", "status"],
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
      // Register with default registry (used by express-prometheus-middleware)
    }),
);

/**
 * Query counter
 * Tracks total number of queries by model and action
 */
export const queryCounter = getOrCreateMetric(
  "prisma_query_total",
  () =>
    new promClient.Counter({
      name: "prisma_query_total",
      help: "Total number of Prisma queries",
      labelNames: ["model", "action", "status"],
    }),
);

/**
 * Slow query counter
 * Tracks queries that exceed the slow query threshold (100ms)
 */
export const slowQueryCounter = getOrCreateMetric(
  "prisma_slow_query_total",
  () =>
    new promClient.Counter({
      name: "prisma_slow_query_total",
      help: "Total number of slow Prisma queries (>100ms)",
      labelNames: ["model", "action"],
    }),
);

/**
 * Query error counter
 * Tracks failed queries
 */
export const queryErrorCounter = getOrCreateMetric(
  "prisma_query_errors_total",
  () =>
    new promClient.Counter({
      name: "prisma_query_errors_total",
      help: "Total number of Prisma query errors",
      labelNames: ["model", "action", "error_type"],
    }),
);

/**
 * Record query metrics
 */
export function recordQueryMetrics(
  model: string,
  action: string,
  duration: number,
  success: boolean = true,
  error?: Error,
): void {
  const status = success ? "success" : "error";
  
  // Record duration
  queryDurationHistogram.observe(
    {
      model,
      action,
      status,
    },
    duration,
  );
  
  // Increment query counter
  queryCounter.inc({
    model,
    action,
    status,
  });
  
  // Record slow queries
  if (duration > 100) {
    slowQueryCounter.inc({
      model,
      action,
    });
  }
  
  // Record errors
  if (!success && error) {
    const errorType = error.constructor.name || "UnknownError";
    queryErrorCounter.inc({
      model,
      action,
      error_type: errorType,
    });
  }
}

