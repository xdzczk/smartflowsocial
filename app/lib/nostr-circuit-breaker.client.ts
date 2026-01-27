/**
 * Circuit Breaker for Nostr Signer Connections
 *
 * Prevents hammering failed connections by implementing a circuit breaker pattern.
 * Tracks consecutive failures and enters cooldown periods when failures exceed threshold.
 */

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  lastSuccessTime: number;
}

const CIRCUIT_BREAKER_STORAGE_KEY = "__nostr_circuit_breaker";
const MAX_FAILURES = 3;
const OPEN_STATE_DURATION_MS = 30_000; // 30 seconds

/**
 * Get circuit breaker state for a signer type
 */
function getCircuitBreakerState(
  signerType: "nip07" | "nip46"
): CircuitBreakerState {
  try {
    const stored = sessionStorage.getItem(
      `${CIRCUIT_BREAKER_STORAGE_KEY}_${signerType}`
    );
    if (stored) {
      const parsed = JSON.parse(stored) as CircuitBreakerState;
      // Validate state - runtime validation for safety (TypeScript type is already narrowed)
      if (parsed.state === "closed" || parsed.state === "open") {
        return parsed;
      }
      // Only "half-open" remains as valid state
      // TypeScript doesn't narrow the union type here, but we know it must be "half-open" at this point
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Type narrowing limitation
      if (parsed.state === "half-open") {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }

  return {
    state: "closed",
    failures: 0,
    lastFailureTime: 0,
    lastSuccessTime: 0,
  };
}

/**
 * Save circuit breaker state for a signer type
 */
function saveCircuitBreakerState(
  signerType: "nip07" | "nip46",
  state: CircuitBreakerState
): void {
  try {
    sessionStorage.setItem(
      `${CIRCUIT_BREAKER_STORAGE_KEY}_${signerType}`,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Record a failure in the circuit breaker
 */
export function recordCircuitBreakerFailure(
  signerType: "nip07" | "nip46"
): void {
  const current = getCircuitBreakerState(signerType);
  const now = Date.now();

  current.failures++;
  current.lastFailureTime = now;

  if (current.failures >= MAX_FAILURES) {
    current.state = "open";
  }

  saveCircuitBreakerState(signerType, current);
}

/**
 * Record a success in the circuit breaker (resets failures)
 */
export function recordCircuitBreakerSuccess(
  signerType: "nip07" | "nip46"
): void {
  const current = getCircuitBreakerState(signerType);
  const now = Date.now();

  current.state = "closed";
  current.failures = 0;
  current.lastSuccessTime = now;

  saveCircuitBreakerState(signerType, current);
}

/**
 * Check if circuit breaker allows an attempt
 * Returns true if attempt is allowed, false if circuit is open
 */
export function canAttemptCircuitBreaker(
  signerType: "nip07" | "nip46"
): boolean {
  const current = getCircuitBreakerState(signerType);
  const now = Date.now();

  // If closed, always allow
  if (current.state === "closed") {
    return true;
  }

  // If open, check if cooldown period has passed
  if (current.state === "open") {
    const timeSinceLastFailure = now - current.lastFailureTime;
    if (timeSinceLastFailure >= OPEN_STATE_DURATION_MS) {
      // Transition to half-open
      current.state = "half-open";
      saveCircuitBreakerState(signerType, current);
      return true;
    }
    return false;
  }

  // If half-open, allow one attempt
  // At this point, state must be "half-open" (TypeScript doesn't narrow, but we know from logic)
  return true;
}

/**
 * Get circuit breaker status for UI display
 */
export function getCircuitBreakerStatus(signerType: "nip07" | "nip46"): {
  state: CircuitState;
  canAttempt: boolean;
  cooldownRemaining?: number;
} {
  const current = getCircuitBreakerState(signerType);
  const now = Date.now();

  if (current.state === "open") {
    const timeSinceLastFailure = now - current.lastFailureTime;
    const cooldownRemaining = Math.max(
      0,
      OPEN_STATE_DURATION_MS - timeSinceLastFailure
    );
    return {
      state: "open",
      canAttempt: false,
      cooldownRemaining,
    };
  }

  return {
    state: current.state,
    canAttempt: true,
  };
}

/**
 * Reset circuit breaker for a signer type (for testing or manual reset)
 */
export function resetCircuitBreaker(signerType: "nip07" | "nip46"): void {
  const reset: CircuitBreakerState = {
    state: "closed",
    failures: 0,
    lastFailureTime: 0,
    lastSuccessTime: 0,
  };
  saveCircuitBreakerState(signerType, reset);
}
