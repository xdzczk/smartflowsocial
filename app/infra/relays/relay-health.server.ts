/**
 * Relay Health Monitoring Service
 *
 * Tracks relay health, availability, latency, and error rates.
 * Provides adaptive routing based on relay health.
 */

import { env } from "~/lib/env.server";
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
  halfOpenSuccesses: number;
  circuitBreakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
  circuitBreakerOpenedAt: Date | null;
  score: number; // 0-100 (higher is better)
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

const RELAY_HEALTH_STORE_MODE = (
  env.RELAY_HEALTH_STORE ?? "memory"
).toLowerCase();
const USE_REDIS_RELAY_HEALTH_STORE = RELAY_HEALTH_STORE_MODE === "redis";
const REDIS_KEY_PREFIX = "relayHealth:";
const REDIS_KEYS_SET = `${REDIS_KEY_PREFIX}keys`;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeRelayScore(metrics: RelayHealthMetrics): number {
  // Circuit breaker dominates (OPEN relays should never be preferred).
  if (metrics.circuitBreakerState === "OPEN") return 0;

  // Base score from success rate (0..1) scaled.
  const successComponent = clamp(metrics.successRate, 0, 1) * 70;

  // Latency penalty: 0ms -> 0, 5000ms -> 20, >5000ms capped.
  const latencyPenalty = clamp(metrics.averageLatency / 5000, 0, 1) * 20;

  // Failure penalty: 0 failures -> 0, 5 failures -> 15, >5 capped.
  const failurePenalty = clamp(metrics.consecutiveFailures / 5, 0, 1) * 15;

  // Status adjustment.
  const statusAdjustment =
    metrics.status === "HEALTHY"
      ? 10
      : metrics.status === "DEGRADED"
        ? 0
        : metrics.status === "UNHEALTHY"
          ? -10
          : 0;

  // HALF_OPEN should be treated cautiously.
  const halfOpenPenalty = metrics.circuitBreakerState === "HALF_OPEN" ? 5 : 0;

  return clamp(
    Math.round(
      successComponent -
        latencyPenalty -
        failurePenalty +
        statusAdjustment -
        halfOpenPenalty
    ),
    0,
    100
  );
}

/**
 * Initialize relay health metrics
 */
function initializeRelayMetrics(relay: string): RelayHealthMetrics {
  const base: RelayHealthMetrics = {
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
    halfOpenSuccesses: 0,
    circuitBreakerState: "CLOSED",
    circuitBreakerOpenedAt: null,
    score: 50,
  };
  base.score = computeRelayScore(base);
  return base;
}

async function persistRelayMetricsToRedis(
  metrics: RelayHealthMetrics
): Promise<void> {
  if (!USE_REDIS_RELAY_HEALTH_STORE) return;

  const { redis } = await import("~/infra/queue");

  const key = `${REDIS_KEY_PREFIX}${metrics.relay}`;
  const payload = JSON.stringify({
    ...metrics,
    lastSuccessAt: metrics.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: metrics.lastFailureAt?.toISOString() ?? null,
    lastCheckedAt: metrics.lastCheckedAt?.toISOString() ?? null,
    circuitBreakerOpenedAt:
      metrics.circuitBreakerOpenedAt?.toISOString() ?? null,
  });

  await redis.set(key, payload, "EX", 60 * 60); // 1 hour TTL
  await redis.sadd(REDIS_KEYS_SET, key);
}

async function hydrateRelayMetricsFromRedis(relay: string): Promise<void> {
  if (!USE_REDIS_RELAY_HEALTH_STORE) return;

  const { redis } = await import("~/infra/queue");

  const key = `${REDIS_KEY_PREFIX}${relay}`;
  const raw = await redis.get(key);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Omit<
      RelayHealthMetrics,
      | "lastSuccessAt"
      | "lastFailureAt"
      | "lastCheckedAt"
      | "circuitBreakerOpenedAt"
      | "score"
    > & {
      lastSuccessAt: string | null;
      lastFailureAt: string | null;
      lastCheckedAt: string | null;
      circuitBreakerOpenedAt: string | null;
      score?: number;
    };

    const hydrated: RelayHealthMetrics = {
      ...parsed,
      lastSuccessAt: parsed.lastSuccessAt
        ? new Date(parsed.lastSuccessAt)
        : null,
      lastFailureAt: parsed.lastFailureAt
        ? new Date(parsed.lastFailureAt)
        : null,
      lastCheckedAt: parsed.lastCheckedAt
        ? new Date(parsed.lastCheckedAt)
        : null,
      circuitBreakerOpenedAt: parsed.circuitBreakerOpenedAt
        ? new Date(parsed.circuitBreakerOpenedAt)
        : null,
      score: typeof parsed.score === "number" ? parsed.score : 50,
    };

    hydrated.score = computeRelayScore(hydrated);
    healthStore.setMetrics(relay, hydrated);
  } catch {
    // ignore hydration failures
  }
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
  if (USE_REDIS_RELAY_HEALTH_STORE) {
    // Best-effort hydration for cross-process deployments.
    void hydrateRelayMetricsFromRedis(relay);
  }
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
    metrics.halfOpenSuccesses++;
    // If we have enough successes in half-open, close the circuit
    if (
      metrics.halfOpenSuccesses >=
      DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold
    ) {
      metrics.circuitBreakerState = "CLOSED";
      metrics.circuitBreakerOpenedAt = null;
      metrics.halfOpenSuccesses = 0;
      logInfo("Relay circuit breaker closed", { relay });
    }
  }

  metrics.status = determineHealthStatus(
    metrics.successRate,
    metrics.consecutiveFailures,
    metrics.averageLatency
  );
  metrics.score = computeRelayScore(metrics);

  healthStore.setMetrics(relay, metrics);
  void persistRelayMetricsToRedis(metrics);
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
      metrics.halfOpenSuccesses = 0;
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
    metrics.halfOpenSuccesses = 0;
    logWarning("Relay circuit breaker reopened", { relay, error });
  }

  metrics.status = determineHealthStatus(
    metrics.successRate,
    metrics.consecutiveFailures,
    metrics.averageLatency
  );
  metrics.score = computeRelayScore(metrics);

  healthStore.setMetrics(relay, metrics);
  void persistRelayMetricsToRedis(metrics);
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
        metrics.halfOpenSuccesses = 0;
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
  const normalized = Array.from(
    new Set(relays.map((r) => r.trim()).filter((r) => r.length > 0))
  );

  const relayMetrics = normalized
    .map((relay) => ({ relay, metrics: getOrCreateMetrics(relay) }))
    .filter(({ relay }) => canUseRelay(relay)) // Filter out relays with open circuit breakers
    .sort((a, b) => {
      // Higher score first; tie-break by relay string for determinism.
      const scoreDiff = b.metrics.score - a.metrics.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.relay.localeCompare(b.relay);
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
