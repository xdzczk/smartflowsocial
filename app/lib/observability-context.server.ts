/**
 * Observability Context
 *
 * A small helper to standardize the keys we attach to logs and Sentry spans.
 * Keeping these fields consistent makes production debugging dramatically easier.
 */

export interface ObservabilityContext {
  correlationId?: string;
  publishAttemptId?: string;
  postId?: string;
  userId?: string;
  outboxEventId?: string;
  eventType?: string;
  queueName?: string;
  jobId?: string;
  attemptsMade?: number;
}

/**
 * Build a normalized context object with only defined keys.
 */
export function buildObsContext<T extends ObservabilityContext>(ctx: T): T {
  const entries = Object.entries(ctx).filter(
    ([, value]) => value !== undefined
  );
  return Object.fromEntries(entries) as T;
}
