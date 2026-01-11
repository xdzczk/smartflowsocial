/**
 * Relay Health Monitoring Service
 *
 * Tracks relay health, availability, latency, and error rates.
 * Provides adaptive routing based on relay health.
 */

import { logInfo, logWarning } from "~/lib/error-logger.server";

/**
 * Relay health status
 */
export type RelayHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "UNHEALTHY"
  | "UNKNOWN";

/**
 * Relay health metrics
 */
export interface RelayHealthMetrics {
  relay: string;
  status: RelayHealthStatus;
  successCount: number;
  failureCount: number;
  totalRequests: number;
  successRate: number; // 0-1
  averageLatency: number; // milliseconds
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastCheckedAt: Date | null;
  consecutiveFailures: number;
  circuitBreakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
  circuitBreakerOpenedAt: Date | null;
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number; // Open circuit after N consecutive failures
  successThreshold: number; // Close circuit after N consecutive successes (half-open)
  timeoutMs: number; // Time to wait before trying half-open
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open after 5 failures
  successThreshold: 2, // Close after 2 successes in half-open
  timeoutMs: 60000, // Wait 60 seconds before half-open
};

/**
 * In-memory relay health store
 * In production, consider using Redis or database for persistence
 */
class RelayHealthStore {
  private readonly metrics = new Map<string, RelayHealthMetrics>();

  getMetrics(relay: string): RelayHealthMetrics | undefined {
    return this.metrics.get(relay);
  }

  setMetrics(relay: string, metrics: RelayHealthMetrics): void {
    this.metrics.set(relay, metrics);
  }

  getAllMetrics(): RelayHealthMetrics[] {
    return Array.from(this.metrics.values());
  }

  clear(): void {
    this.metrics.clear();
  }
}

const healthStore = new RelayHealthStore();

/**
 * Initialize relay health metrics
 */
function initializeRelayMetrics(relay: string): RelayHealthMetrics {
  return {
    relay,
    status: "UNKNOWN",
    successCount: 0,
    failureCount: 0,
    totalRequests: 0,
    successRate: 1.0, // Start optimistic
    averageLatency: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastCheckedAt: new Date(),
    consecutiveFailures: 0,
    circuitBreakerState: "CLOSED",
    circuitBreakerOpenedAt: null,
  };
}

/**
 * Get or create relay health metrics
 */
function getOrCreateMetrics(relay: string): RelayHealthMetrics {
  const existing = healthStore.getMetrics(relay);
  if (existing) {
    return existing;
  }
  const metrics = initializeRelayMetrics(relay);
  healthStore.setMetrics(relay, metrics);
  return metrics;
}

/**
 * Calculate success rate
 */
function calculateSuccessRate(
  successCount: number,
  totalRequests: number
): number {
  if (totalRequests === 0) return 1.0;
  return successCount / totalRequests;
}

/**
 * Calculate average latency (exponential moving average)
 */
function calculateAverageLatency(
  currentAverage: number,
  newLatency: number,
  alpha = 0.3 // Smoothing factor
): number {
  if (currentAverage === 0) return newLatency;
  return alpha * newLatency + (1 - alpha) * currentAverage;
}

/**
 * Determine relay health status
 */
function determineHealthStatus(
  successRate: number,
  consecutiveFailures: number,
  averageLatency: number
): RelayHealthStatus {
  // Unhealthy if too many consecutive failures
  if (consecutiveFailures >= 3) {
    return "UNHEALTHY";
  }

  // Degraded if success rate is low or latency is high
  if (successRate < 0.7 || averageLatency > 5000) {
    return "DEGRADED";
  }

  // Healthy otherwise
  if (successRate >= 0.9 && averageLatency < 2000) {
    return "HEALTHY";
  }

  return "DEGRADED";
}

/**
 * Record a successful publish to a relay
 */
export function recordRelaySuccess(relay: string, latency: number): void {
  const metrics = getOrCreateMetrics(relay);
  const now = new Date();

  metrics.successCount++;
  metrics.totalRequests++;
  metrics.consecutiveFailures = 0;
  metrics.lastSuccessAt = now;
  metrics.lastCheckedAt = now;
  metrics.averageLatency = calculateAverageLatency(
    metrics.averageLatency,
    latency
  );
  metrics.successRate = calculateSuccessRate(
    metrics.successCount,
    metrics.totalRequests
  );

  // Update circuit breaker state
  if (metrics.circuitBreakerState === "HALF_OPEN") {
    // If we have enough successes in half-open, close the circuit
    const recentSuccesses =
      metrics.successCount - (metrics.totalRequests - metrics.failureCount);
    if (recentSuccesses >= DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold) {
      metrics.circuitBreakerState = "CLOSED";
      metrics.circuitBreakerOpenedAt = null;
      logInfo("Relay circuit breaker closed", { relay });
    }
  }

  metrics.status = determineHealthStatus(
    metrics.successRate,
    metrics.consecutiveFailures,
    metrics.averageLatency
  );

  healthStore.setMetrics(relay, metrics);
}

/**
 * Record a failed publish to a relay
 */
export function recordRelayFailure(relay: string, error?: string): void {
  const metrics = getOrCreateMetrics(relay);
  const now = new Date();

  metrics.failureCount++;
  metrics.totalRequests++;
  metrics.consecutiveFailures++;
  metrics.lastFailureAt = now;
  metrics.lastCheckedAt = now;
  metrics.successRate = calculateSuccessRate(
    metrics.successCount,
    metrics.totalRequests
  );

  // Update circuit breaker state
  if (metrics.circuitBreakerState === "CLOSED") {
    if (
      metrics.consecutiveFailures >=
      DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold
    ) {
      metrics.circuitBreakerState = "OPEN";
      metrics.circuitBreakerOpenedAt = now;
      logWarning("Relay circuit breaker opened", {
        relay,
        consecutiveFailures: metrics.consecutiveFailures,
        error,
      });
    }
  } else if (metrics.circuitBreakerState === "HALF_OPEN") {
    // If we fail in half-open, go back to open
    metrics.circuitBreakerState = "OPEN";
    metrics.circuitBreakerOpenedAt = now;
    logWarning("Relay circuit breaker reopened", { relay, error });
  }

  metrics.status = determineHealthStatus(
    metrics.successRate,
    metrics.consecutiveFailures,
    metrics.averageLatency
  );

  healthStore.setMetrics(relay, metrics);
}

/**
 * Check if relay circuit breaker allows requests
 */
export function canUseRelay(
  relay: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
): boolean {
  const metrics = getOrCreateMetrics(relay);

  if (metrics.circuitBreakerState === "CLOSED") {
    return true;
  }

  if (metrics.circuitBreakerState === "OPEN") {
    // Check if timeout has passed
    if (metrics.circuitBreakerOpenedAt) {
      const timeSinceOpen =
        Date.now() - metrics.circuitBreakerOpenedAt.getTime();
      if (timeSinceOpen >= config.timeoutMs) {
        // Transition to half-open
        metrics.circuitBreakerState = "HALF_OPEN";
        healthStore.setMetrics(relay, metrics);
        logInfo("Relay circuit breaker half-open", { relay });
        return true;
      }
    }
    return false;
  }

  // HALF_OPEN - allow limited requests
  return true;
}

/**
 * Get relay health metrics
 */
export function getRelayHealth(relay: string): RelayHealthMetrics | null {
  return healthStore.getMetrics(relay) ?? null;
}

/**
 * Get health for multiple relays
 */
export function getRelaysHealth(
  relays: string[]
): Map<string, RelayHealthMetrics> {
  const result = new Map<string, RelayHealthMetrics>();
  for (const relay of relays) {
    const metrics = healthStore.getMetrics(relay);
    if (metrics) {
      result.set(relay, metrics);
    }
  }
  return result;
}

/**
 * Filter and prioritize relays based on health
 * Returns relays sorted by health (healthiest first)
 */
export function prioritizeRelaysByHealth(relays: string[]): string[] {
  const relayMetrics = relays
    .map((relay) => ({
      relay,
      metrics: getOrCreateMetrics(relay),
    }))
    .filter(({ relay }) => canUseRelay(relay)) // Filter out relays with open circuit breakers
    .sort((a, b) => {
      // Sort by:
      // 1. Circuit breaker state (CLOSED > HALF_OPEN)
      // 2. Health status (HEALTHY > DEGRADED > UNHEALTHY)
      // 3. Success rate (higher is better)
      // 4. Average latency (lower is better)

      const stateOrder = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 };
      const stateDiff =
        stateOrder[a.metrics.circuitBreakerState] -
        stateOrder[b.metrics.circuitBreakerState];
      if (stateDiff !== 0) return stateDiff;

      const statusOrder = { HEALTHY: 0, DEGRADED: 1, UNHEALTHY: 2, UNKNOWN: 3 };
      const statusDiff =
        statusOrder[a.metrics.status] - statusOrder[b.metrics.status];
      if (statusDiff !== 0) return statusDiff;

      const successRateDiff = b.metrics.successRate - a.metrics.successRate;
      if (Math.abs(successRateDiff) > 0.01) return successRateDiff;

      return a.metrics.averageLatency - b.metrics.averageLatency;
    });

  return relayMetrics.map(({ relay }) => relay);
}

/**
 * Get all relay health metrics (for monitoring/admin)
 */
export function getAllRelayHealthMetrics(): RelayHealthMetrics[] {
  return healthStore.getAllMetrics();
}

/**
 * Reset relay health metrics (for testing/admin)
 */
export function resetRelayHealth(relay: string): void {
  const metrics = initializeRelayMetrics(relay);
  healthStore.setMetrics(relay, metrics);
}
