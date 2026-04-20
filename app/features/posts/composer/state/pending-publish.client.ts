/**
 * Pending publish attempt state machine (client-side, in-memory).
 *
 * Provides a single, observable representation of an in-flight publish click
 * so that:
 *   - The UI always knows whether we are signing, awaiting a stalled signer,
 *     resuming after a reconnect, or expired past the recovery window.
 *   - Resumable attempts carry a stable `submissionId` (uuid) that the server
 *     uses as the basis for the creation idempotency key, so two unrelated
 *     publish clicks of the same content never collide and a resumed retry
 *     always dedupes onto the same Post row.
 *   - Recovery is bounded by a single explicit timer (`RECOVERY_WINDOW_MS`),
 *     and reconnects after expiry never silently autocomplete.
 *
 * The store is intentionally module-scoped so that any composer hook,
 * `nostr-connection-healthy` listener, or unmount/remount of `UnifiedComposer`
 * sees the same attempt — exactly what the user-reported "Scenario A vs B"
 * bug needs.
 */

import {
  isConnectionLikeError,
  isSignTimeoutError,
} from "~/lib/signer-error-classification";

export type PendingPublishState =
  | "idle"
  | "signing"
  | "awaiting_signer"
  | "resuming"
  | "submitting"
  | "completed"
  | "expired"
  | "failed";

export interface PendingPublishAttempt {
  /** Stable client-generated uuid; used as the server-side `submissionId`. */
  id: string;
  state: PendingPublishState;
  /** Epoch millis when the attempt was started (first sign call). */
  createdAt: number;
  /**
   * Epoch millis after which the attempt is no longer eligible to autocomplete
   * via {@link maybeResume}. Set the first time the attempt enters
   * `awaiting_signer`.
   */
  resumeUntil: number | null;
  /** Last error message surfaced to the UI, when relevant. */
  lastError: string | null;
}

interface PendingAttemptInternal extends PendingPublishAttempt {
  /**
   * Generation counter so a late sign rejection from a previous run cannot
   * mutate state belonging to a fresher attempt.
   */
  generation: number;
  /** Active expiry timeout, if any. */
  expiryTimer: ReturnType<typeof setTimeout> | null;
  /** Re-sign callback supplied by the caller; null when the attempt is dormant. */
  resumeSign: ((submissionId: string) => Promise<void>) | null;
}

export interface StartAttemptInput {
  /**
   * Performs the sign + submit. Implementations should call
   * `nostrAdapter.signEventWithOneRetry(...)` followed by `fetcher.submit(...)`
   * with the resulting payload. Throwing a sign timeout / connection error
   * places the attempt in `awaiting_signer`; throwing anything else marks it
   * `failed`.
   *
   * The `submissionId` argument MUST be appended to the FormData/payload as
   * the `submissionId` field so the server can dedupe correctly.
   */
  performSignAndSubmit: (submissionId: string) => Promise<void>;
}

/** 5 minutes — matches the user's chosen recovery scope. */
export const RECOVERY_WINDOW_MS = 5 * 60 * 1000;

type Listener = () => void;

const listeners = new Set<Listener>();

let current: PendingAttemptInternal | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function clearExpiryTimer(attempt: PendingAttemptInternal | null): void {
  if (!attempt) return;
  if (attempt.expiryTimer != null) {
    clearTimeout(attempt.expiryTimer);
    attempt.expiryTimer = null;
  }
}

function snapshotOf(
  attempt: PendingAttemptInternal | null
): PendingPublishAttempt | null {
  if (!attempt) return null;
  return {
    id: attempt.id,
    state: attempt.state,
    createdAt: attempt.createdAt,
    resumeUntil: attempt.resumeUntil,
    lastError: attempt.lastError,
  };
}

let lastSnapshotKey = "";
let lastSnapshot: PendingPublishAttempt | null = null;

export function getSnapshot(): PendingPublishAttempt | null {
  // Stable snapshot: useSyncExternalStore relies on referential equality when
  // nothing has changed. Only mint a new object when the visible fields differ.
  const key = current
    ? `${current.id}:${current.state}:${current.createdAt}:${current.resumeUntil ?? "x"}:${current.lastError ?? ""}`
    : "";
  if (key !== lastSnapshotKey) {
    lastSnapshotKey = key;
    lastSnapshot = snapshotOf(current);
  }
  return lastSnapshot;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Generate a fresh client submissionId. Exported for callers that want the id
 * before they actually start an attempt (e.g. building an optimistic UI tag).
 */
export function createSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without WebCrypto (older Safari, jsdom).
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

function classifySignError(error: unknown): "signer_unavailable" | "fatal" {
  if (isSignTimeoutError(error) || isConnectionLikeError(error)) {
    return "signer_unavailable";
  }
  return "fatal";
}

function scheduleExpiryTimer(attempt: PendingAttemptInternal): void {
  clearExpiryTimer(attempt);
  if (attempt.resumeUntil == null) return;
  const remaining = Math.max(0, attempt.resumeUntil - Date.now());
  attempt.expiryTimer = setTimeout(() => {
    if (current !== attempt) return;
    if (attempt.state !== "awaiting_signer") return;
    attempt.state = "expired";
    attempt.expiryTimer = null;
    emit();
  }, remaining);
}

async function runAttempt(
  attempt: PendingAttemptInternal,
  performSignAndSubmit: (submissionId: string) => Promise<void>
): Promise<void> {
  attempt.state = attempt.state === "idle" ? "signing" : "resuming";
  attempt.lastError = null;
  emit();
  try {
    await performSignAndSubmit(attempt.id);
    if (current !== attempt) return;
    attempt.state = "submitting";
    clearExpiryTimer(attempt);
    emit();
  } catch (error) {
    if (current !== attempt) return;
    const kind = classifySignError(error);
    attempt.lastError = error instanceof Error ? error.message : String(error);
    if (kind === "signer_unavailable") {
      attempt.resumeUntil ??= Date.now() + RECOVERY_WINDOW_MS;
      if (Date.now() >= attempt.resumeUntil) {
        attempt.state = "expired";
        clearExpiryTimer(attempt);
      } else {
        attempt.state = "awaiting_signer";
        scheduleExpiryTimer(attempt);
      }
    } else {
      attempt.state = "failed";
      clearExpiryTimer(attempt);
    }
    emit();
  }
}

/**
 * Start a fresh publish attempt. Cancels any previous in-flight or awaiting
 * attempt (their generations are bumped so late callbacks become no-ops).
 *
 * Returns the attempt's `submissionId` so the caller can also embed it
 * directly in the payload if it builds one before the resume callback runs.
 */
export function start(input: StartAttemptInput): string {
  if (current) {
    clearExpiryTimer(current);
    current.generation += 1;
  }
  const attempt: PendingAttemptInternal = {
    id: createSubmissionId(),
    state: "idle",
    createdAt: Date.now(),
    resumeUntil: null,
    lastError: null,
    generation: (current?.generation ?? 0) + 1,
    expiryTimer: null,
    resumeSign: input.performSignAndSubmit,
  };
  current = attempt;
  void runAttempt(attempt, input.performSignAndSubmit);
  return attempt.id;
}

/**
 * Triggered from the `nostr-connection-healthy` listener. If the current
 * attempt is in `awaiting_signer` and still inside its recovery window,
 * re-runs the original sign+submit closure with the same `submissionId`.
 *
 * Returns true when a resume was actually started.
 */
export function maybeResume(): boolean {
  const attempt = current;
  if (!attempt) return false;
  if (attempt.state !== "awaiting_signer") return false;
  if (attempt.resumeUntil != null && Date.now() >= attempt.resumeUntil) {
    attempt.state = "expired";
    clearExpiryTimer(attempt);
    emit();
    return false;
  }
  const sign = attempt.resumeSign;
  if (!sign) return false;
  void runAttempt(attempt, sign);
  return true;
}

/**
 * Cancel the current attempt and bump the generation so any late sign
 * completion can no longer mutate the store. Safe to call multiple times.
 */
export function cancel(): void {
  if (!current) return;
  clearExpiryTimer(current);
  current.generation += 1;
  current = null;
  emit();
}

/**
 * Mark the current attempt as completed once the server submission has
 * succeeded (status 2xx). Idempotent.
 */
export function markCompleted(submissionId: string): void {
  if (current?.id !== submissionId) return;
  clearExpiryTimer(current);
  current.state = "completed";
  current.lastError = null;
  emit();
}

/**
 * Mark the current attempt as failed when the server returns a non-recoverable
 * error (4xx/5xx other than the signer-unavailable family). Idempotent.
 */
export function markFailed(submissionId: string, message: string): void {
  if (current?.id !== submissionId) return;
  clearExpiryTimer(current);
  current.state = "failed";
  current.lastError = message;
  emit();
}

/** Convenience helpers for tests and consumers that prefer namespaced access. */
export const pendingPublish = {
  start,
  cancel,
  maybeResume,
  markCompleted,
  markFailed,
  getSnapshot,
  subscribe,
  createSubmissionId,
};

/**
 * Test-only helper to wipe the store between cases. Not exported through the
 * default object so production callers cannot accidentally reset state.
 */
export function _resetForTests(): void {
  if (current) clearExpiryTimer(current);
  current = null;
  listeners.clear();
  lastSnapshotKey = "";
  lastSnapshot = null;
}
