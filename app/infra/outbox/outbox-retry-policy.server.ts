/**
 * Outbox Retry Policy
 *
 * Defines retry behavior for outbox event processing (DB-backed outbox worker).
 * This is separate from BullMQ retry policy: outbox retries govern the enqueue/cancel step.
 */

export interface OutboxRetryPolicy {
  /** Maximum number of processing attempts before dead-lettering */
  maxAttempts: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  multiplier: number;
  /** Whether to add jitter to prevent thundering herd */
  useJitter: boolean;
  /** Jitter percentage (0-1), e.g. 0.15 = ±15% */
  jitterFactor: number;
}

const DEFAULT_OUTBOX_RETRY_POLICY: OutboxRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 2000,
  maxDelayMs: 10 * 60 * 1000, // 10 minutes
  multiplier: 2,
  useJitter: true,
  jitterFactor: 0.15,
};

export function getOutboxRetryPolicy(): OutboxRetryPolicy {
  return DEFAULT_OUTBOX_RETRY_POLICY;
}

/**
 * Compute exponential backoff delay (ms) for a given attempt index.
 *
 * attemptIndex is 0-based: first retry => 0, second retry => 1, ...
 * Provide `random` to make jitter deterministic in tests.
 */
export function computeOutboxRetryDelayMs(input: {
  attemptIndex: number;
  policy: OutboxRetryPolicy;
  random?: () => number;
}): number {
  const random = input.random ?? Math.random;
  const attemptIndex = Math.max(0, Math.floor(input.attemptIndex));
  const policy = input.policy;

  const exponentialDelay = Math.min(
    policy.baseDelayMs * Math.pow(policy.multiplier, attemptIndex),
    policy.maxDelayMs
  );

  if (!policy.useJitter || policy.jitterFactor <= 0) {
    return Math.floor(exponentialDelay);
  }

  const jitterRange = exponentialDelay * policy.jitterFactor;
  const jitter = (random() * 2 - 1) * jitterRange; // ±jitterRange
  return Math.max(0, Math.floor(exponentialDelay + jitter));
}

export function computeNextAttemptAt(input: {
  now: Date;
  attemptsAfterIncrement: number;
  policy: OutboxRetryPolicy;
  random?: () => number;
  minimumDelayMs?: number;
}): Date {
  // First failure => attemptsAfterIncrement=1 => attemptIndex=0 => baseDelay
  const attemptIndex = Math.max(0, input.attemptsAfterIncrement - 1);
  const delay = computeOutboxRetryDelayMs({
    attemptIndex,
    policy: input.policy,
    random: input.random,
  });
  const minDelay = Math.max(0, input.minimumDelayMs ?? 0);
  const effectiveDelay = Math.max(delay, minDelay);
  return new Date(input.now.getTime() + effectiveDelay);
}
