/**
 * Relay Metrics
 *
 * Exposes relay health data as Prometheus metrics.
 * Integrates with relay-health.server.ts to provide metrics.
 */

import * as promClient from "prom-client";

import { getAllRelayHealthMetrics } from "~/infra/relays/relay-health.server";

import { singleton } from "../singleton.server";

/**
 * Get or create a metric, handling hot-reloads gracefully
 */
function getOrCreateMetric<T extends promClient.Metric>(
  name: string,
  factory: () => T
): T {
  return singleton(`prom_metric_${name}`, () => {
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
 * Relay success rate gauge
 * Tracks success rate per relay (0-1)
 */
export const relaySuccessRateGauge = getOrCreateMetric(
  "relay_success_rate",
  () =>
    new promClient.Gauge({
      name: "relay_success_rate",
      help: "Success rate of relay (0-1)",
      labelNames: ["relay"],
    })
);

/**
 * Relay average latency gauge
 * Tracks average latency per relay in milliseconds
 */
export const relayLatencyGauge = getOrCreateMetric(
  "relay_latency_ms",
  () =>
    new promClient.Gauge({
      name: "relay_latency_ms",
      help: "Average latency of relay in milliseconds",
      labelNames: ["relay"],
    })
);

/**
 * Relay health status gauge
 * Tracks health status per relay (0=UNKNOWN, 1=HEALTHY, 2=DEGRADED, 3=UNHEALTHY)
 */
export const relayHealthStatusGauge = getOrCreateMetric(
  "relay_health_status",
  () =>
    new promClient.Gauge({
      name: "relay_health_status",
      help: "Health status of relay (0=UNKNOWN, 1=HEALTHY, 2=DEGRADED, 3=UNHEALTHY)",
      labelNames: ["relay"],
    })
);

/**
 * Relay circuit breaker state gauge
 * Tracks circuit breaker state per relay (0=CLOSED, 1=HALF_OPEN, 2=OPEN)
 */
export const relayCircuitBreakerStateGauge = getOrCreateMetric(
  "relay_circuit_breaker_state",
  () =>
    new promClient.Gauge({
      name: "relay_circuit_breaker_state",
      help: "Circuit breaker state of relay (0=CLOSED, 1=HALF_OPEN, 2=OPEN)",
      labelNames: ["relay"],
    })
);

/**
 * Relay total requests counter
 * Tracks total requests per relay
 */
export const relayTotalRequestsCounter = getOrCreateMetric(
  "relay_requests_total",
  () =>
    new promClient.Counter({
      name: "relay_requests_total",
      help: "Total number of requests to relay",
      labelNames: ["relay", "status"], // status: "success" | "failure"
    })
);

/**
 * Update relay metrics from health data
 * Should be called periodically to sync metrics
 */
export function updateRelayMetrics(): void {
  const allMetrics = getAllRelayHealthMetrics();

  for (const metrics of allMetrics) {
    // Update success rate
    relaySuccessRateGauge.set({ relay: metrics.relay }, metrics.successRate);

    // Update latency
    relayLatencyGauge.set({ relay: metrics.relay }, metrics.averageLatency);

    // Update health status (map to numeric value)
    const healthStatusValue = {
      UNKNOWN: 0,
      HEALTHY: 1,
      DEGRADED: 2,
      UNHEALTHY: 3,
    }[metrics.status];
    relayHealthStatusGauge.set({ relay: metrics.relay }, healthStatusValue);

    // Update circuit breaker state (map to numeric value)
    const circuitBreakerValue = {
      CLOSED: 0,
      HALF_OPEN: 1,
      OPEN: 2,
    }[metrics.circuitBreakerState];
    relayCircuitBreakerStateGauge.set(
      { relay: metrics.relay },
      circuitBreakerValue
    );
  }
}

/**
 * Record relay request
 */
export function recordRelayRequest(relay: string, success: boolean): void {
  relayTotalRequestsCounter.inc({
    relay,
    status: success ? "success" : "failure",
  });
}
