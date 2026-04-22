/**
 * Publish-attempt dedupe (once-only guard for `/api/publish` side effects).
 *
 * The `/api/publish` route accepts an optional client-generated `attemptId`
 * (uuid). Resuming a signed-but-not-acked submit (e.g. the network blip
 * recovery flow in `signing-attempts.client.ts`) re-POSTs the same signed
 * event with the same `attemptId`. Relays already dedupe by event id, but
 * the route's post-publish side effects (`recordReplyPost`,
 * `persistPublishRelayAcks`, `invalidateRelayIntentCache`) are not all
 * intrinsically once-only — `recordReplyPost` in particular would create a
 * second `Post` row on a replay.
 *
 * This module exposes a tiny "claim" primitive backed by Redis SETNX with a
 * TTL, with an in-memory fallback for tests and for environments where
 * Redis is unavailable. The first call for a given `(userId, attemptId)`
 * pair returns `claimed: true` and is expected to run the side effects;
 * subsequent calls return `claimed: false` and the route signals
 * `{ deduped: true }` to the client.
 *
 * Failure mode: if Redis is reachable but errors, we fail OPEN (claim the
 * attempt) so a transient Redis hiccup never blocks a legitimate publish.
 * Worst case is a duplicate side-effect run, which is no worse than the
 * pre-PR behavior. Failing closed would be strictly more dangerous.
 */

import { redis } from "~/infra/queue";
import { env } from "~/lib/env.server";
import { logWarning } from "~/lib/error-logger.server";

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const REDIS_KEY_PREFIX = "publish-attempt:";
const ATTEMPT_ID_MAX_LENGTH = 128;

interface MemoryEntry {
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

function isTestEnvironment(): boolean {
  return env.NODE_ENV === "test";
}

function isRedisAvailable(): boolean {
  return Boolean(env.REDIS_URL) && redis.status === "ready";
}

function buildRedisKey(userId: string, attemptId: string): string {
  return `${REDIS_KEY_PREFIX}${userId}:${attemptId}`;
}

function pruneMemoryStore(now: number): void {
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

/**
 * Validate and normalize a client-supplied attemptId from a request body.
 * Returns the trimmed string when well-formed, otherwise `undefined`.
 *
 * Mirrors the defensive bounds in `readSubmissionId` (composer):
 *   - must be a non-empty string
 *   - must be ≤ 128 chars (real uuids are 36)
 */
export function readAttemptIdFromBody(
  body: Record<string, unknown> | null | undefined
): string | undefined {
  if (body == null) return undefined;
  const raw = body["attemptId"];
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (value.length === 0) return undefined;
  if (value.length > ATTEMPT_ID_MAX_LENGTH) return undefined;
  return value;
}

/**
 * Attempt to claim a publish attempt for once-only side-effect execution.
 *
 * @returns `{ claimed: true }` on the first call for this `(userId, attemptId)`
 *   within the TTL window; `{ claimed: false }` if already claimed.
 */
export async function claimPublishAttempt(input: {
  attemptId: string;
  userId: string;
  ttlSeconds?: number;
}): Promise<{ claimed: boolean }> {
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const key = buildRedisKey(input.userId, input.attemptId);

  if (isTestEnvironment() || !isRedisAvailable()) {
    const now = Date.now();
    pruneMemoryStore(now);
    if (memoryStore.has(key)) return { claimed: false };
    memoryStore.set(key, { expiresAt: now + ttl * 1000 });
    return { claimed: true };
  }

  try {
    const result = await redis.set(key, "1", "EX", ttl, "NX");
    return { claimed: result === "OK" };
  } catch (error) {
    logWarning(
      "publish-attempt-dedupe: Redis SETNX failed; failing open to avoid blocking legitimate publish",
      {
        key,
        error: error instanceof Error ? error.message : String(error),
      }
    );
    return { claimed: true };
  }
}

/**
 * Test-only helper: clear the in-memory dedupe store between test cases.
 * Not exported via the public surface; tests import directly.
 */
export function _resetPublishAttemptDedupeForTests(): void {
  memoryStore.clear();
}
