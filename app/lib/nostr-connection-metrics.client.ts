/**
 * Connection Quality Metrics for Nostr Authentication
 *
 * Tracks connection success rates, timing, and failure patterns
 * to enable data-driven improvements and adaptive behavior.
 */

interface ConnectionAttempt {
  timestamp: number;
  signerType: "nip07" | "nip46";
  method?: "bunker_input" | "nostrconnect_uri";
  platform: "ios" | "android" | "desktop";
  success: boolean;
  duration?: number;
  errorCode?: string;
  retryCount: number;
}

interface ConnectionMetrics {
  attempts: ConnectionAttempt[];
  lastReset: number;
}

const METRICS_STORAGE_KEY = "__nostr_connection_metrics";
const MAX_ATTEMPTS_TO_STORE = 100;
const METRICS_RESET_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Detect platform
 */
function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";

  const ua = navigator.userAgent;
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/Android/.test(ua)) {
    return "android";
  }
  return "desktop";
}

/**
 * Get stored metrics
 */
function getStoredMetrics(): ConnectionMetrics {
  try {
    const stored = localStorage.getItem(METRICS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ConnectionMetrics;
      // Check if metrics need reset (weekly)
      const now = Date.now();
      if (now - parsed.lastReset > METRICS_RESET_INTERVAL_MS) {
        // Reset metrics
        const reset: ConnectionMetrics = {
          attempts: [],
          lastReset: now,
        };
        localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(reset));
        return reset;
      }
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }

  return {
    attempts: [],
    lastReset: Date.now(),
  };
}

/**
 * Save metrics
 */
function saveMetrics(metrics: ConnectionMetrics): void {
  try {
    // Keep only recent attempts
    if (metrics.attempts.length > MAX_ATTEMPTS_TO_STORE) {
      metrics.attempts = metrics.attempts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_ATTEMPTS_TO_STORE);
    }
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Record a connection attempt
 */
export function recordConnectionAttempt(params: {
  signerType: "nip07" | "nip46";
  method?: "bunker_input" | "nostrconnect_uri";
  success: boolean;
  duration?: number;
  errorCode?: string;
  retryCount: number;
}): void {
  const metrics = getStoredMetrics();
  const attempt: ConnectionAttempt = {
    timestamp: Date.now(),
    platform: detectPlatform(),
    ...params,
  };
  metrics.attempts.push(attempt);
  saveMetrics(metrics);
}

/**
 * Get connection success rate by platform
 */
export function getSuccessRateByPlatform(): Record<
  "ios" | "android" | "desktop",
  { success: number; total: number; rate: number }
> {
  const metrics = getStoredMetrics();
  const stats: Record<
    "ios" | "android" | "desktop",
    { success: number; total: number; rate: number }
  > = {
    ios: { success: 0, total: 0, rate: 0 },
    android: { success: 0, total: 0, rate: 0 },
    desktop: { success: 0, total: 0, rate: 0 },
  };

  for (const attempt of metrics.attempts) {
    const stat = stats[attempt.platform];
    stat.total++;
    if (attempt.success) {
      stat.success++;
    }
    stat.rate = stat.total > 0 ? stat.success / stat.total : 0;
  }

  return stats;
}

/**
 * Get average connection time by method
 */
export function getAverageConnectionTime(): Record<
  "bunker_input" | "nostrconnect_uri",
  number | null
> {
  const metrics = getStoredMetrics();
  const times: Record<
    "bunker_input" | "nostrconnect_uri",
    { total: number; sum: number }
  > = {
    bunker_input: { total: 0, sum: 0 },
    nostrconnect_uri: { total: 0, sum: 0 },
  };

  for (const attempt of metrics.attempts) {
    if (attempt.success && attempt.duration && attempt.method) {
      const method = attempt.method;
      times[method].total++;
      times[method].sum += attempt.duration;
    }
  }

  return {
    bunker_input:
      times.bunker_input.total > 0
        ? times.bunker_input.sum / times.bunker_input.total
        : null,
    nostrconnect_uri:
      times.nostrconnect_uri.total > 0
        ? times.nostrconnect_uri.sum / times.nostrconnect_uri.total
        : null,
  };
}

/**
 * Get failure reasons distribution
 */
export function getFailureReasons(): Record<string, number> {
  const metrics = getStoredMetrics();
  const reasons: Record<string, number> = {};

  for (const attempt of metrics.attempts) {
    if (!attempt.success && attempt.errorCode) {
      reasons[attempt.errorCode] = (reasons[attempt.errorCode] ?? 0) + 1;
    }
  }

  return reasons;
}

/**
 * Get retry success rate
 */
export function getRetrySuccessRate(): {
  firstAttempt: { success: number; total: number; rate: number };
  retry: { success: number; total: number; rate: number };
} {
  const metrics = getStoredMetrics();
  const firstAttempt = { success: 0, total: 0, rate: 0 };
  const retry = { success: 0, total: 0, rate: 0 };

  for (const attempt of metrics.attempts) {
    if (attempt.retryCount === 0) {
      firstAttempt.total++;
      if (attempt.success) firstAttempt.success++;
    } else {
      retry.total++;
      if (attempt.success) retry.success++;
    }
  }

  firstAttempt.rate =
    firstAttempt.total > 0 ? firstAttempt.success / firstAttempt.total : 0;
  retry.rate = retry.total > 0 ? retry.success / retry.total : 0;

  return { firstAttempt, retry };
}

/**
 * Get recommended connection method based on historical data
 */
export function getRecommendedMethod():
  | "bunker_input"
  | "nostrconnect_uri"
  | null {
  // If we have data for both methods, prefer the one with better success rate
  // For now, return null to let user choose (could be enhanced with more data)

  void getAverageConnectionTime();

  void getSuccessRateByPlatform();
  return null;
}

/**
 * Reset all metrics (for testing or user request)
 */
export function resetMetrics(): void {
  const reset: ConnectionMetrics = {
    attempts: [],
    lastReset: Date.now(),
  };
  saveMetrics(reset);
}
