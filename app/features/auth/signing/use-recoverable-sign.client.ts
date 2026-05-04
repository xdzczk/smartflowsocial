/**
 * Recoverable-sign helper for ad-hoc surfaces (modals, hooks).
 *
 * Wraps {@link signingAttempts.start} in an awaitable Promise that resolves
 * once the attempt reaches a terminal state (completed / failed / expired /
 * cancelled). Callers that previously did:
 *
 *     const { signedEvent } = await nostrAdapter.signEventWithOneRetry(data);
 *     const res = await fetch("/api/publish", { body: JSON.stringify(...) });
 *     if (!res.ok) throw new Error("...");
 *
 * migrate to:
 *
 *     const result = await startRecoverableSign({
 *       intent: durableIntent("publish_reply", `reply:${eventId}:${ts}`),
 *       surface: "notifications:row:abc",
 *       performSignAndSubmit: async (submissionId) => {
 *         const { signedEvent } = await nostrAdapter.signEvent(data, {
 *           clearCacheOnError: false,
 *         });
 *         const res = await fetch("/api/publish", {
 *           method: "POST",
 *           headers: { "Content-Type": "application/json" },
 *           body: JSON.stringify({
 *             relays,
 *             event: signedEvent,
 *             attemptId: submissionId,
 *           }),
 *         });
 *         if (!res.ok) {
 *           signingAttempts.markFailed(submissionId, await res.text());
 *           throw new Error("publish failed");
 *         }
 *         signingAttempts.markCompleted(submissionId);
 *       },
 *     });
 *
 * The caller gets back a structured outcome (`ok` + reason on failure) and
 * the recovery banner is wired up automatically: a stalled bunker parks the
 * attempt as `awaiting_signer`, a `nostr-connection-healthy` event resumes
 * it, the recovery window expires it, etc.
 *
 * Why a Promise wrapper rather than just calling `start()` directly?
 *   - Existing call sites are written as `async function handleX(): Promise<boolean>`
 *     and need a single boolean back. Restructuring every caller to listen
 *     for `markCompleted` via `subscribe()` is the right long-term shape but
 *     would be a much larger refactor than PR 3 wants to ship.
 *   - The Promise contract makes per-callsite error handling identical to
 *     today's `try/catch` shape, so the migration is a near-mechanical
 *     swap of the sign helper.
 */

import { useRef, useSyncExternalStore } from "react";

import {
  signingAttempts,
  type DurableIntentName,
  type EphemeralIntentName,
  type SigningAttempt,
  type SigningIntent,
  type StartAttemptInput,
} from "./signing-attempts.client";

export type RecoverableSignFailureReason =
  | "fatal"
  | "expired"
  | "cancelled"
  | "evicted";

export type RecoverableSignResult =
  | {
      ok: true;
      attemptId: string;
    }
  | {
      ok: false;
      attemptId: string;
      reason: RecoverableSignFailureReason;
      lastError: string | null;
    };

/**
 * Start a signing attempt and await its terminal outcome.
 *
 * The promise NEVER rejects  -  failures are returned as `{ ok: false }` so
 * the caller can branch without a try/catch. Anything thrown inside
 * `performSignAndSubmit` is captured by the store and surfaced as either
 * `awaiting_signer` (transient signer error) or `failed` (anything else).
 *
 * The caller's `performSignAndSubmit` is responsible for invoking
 * `signingAttempts.markCompleted(submissionId)` after a successful publish
 * so the awaitable resolves promptly with `ok: true`. If it doesn't, the
 * attempt sits in `submitting` forever  -  defensive but visible.
 */
export function startRecoverableSign(
  input: StartAttemptInput
): Promise<RecoverableSignResult> {
  return new Promise<RecoverableSignResult>((resolve) => {
    let attemptId = "";
    let resolved = false;
    let lastSeenAttempt: SigningAttempt | null = null;

    const finish = (result: RecoverableSignResult): void => {
      if (resolved) return;
      resolved = true;
      try {
        unsubscribe();
      } catch {
        // unsubscribe never throws in current impl, but stay defensive so
        // an exotic listener slot can't strand the awaiting caller.
      }
      resolve(result);
    };

    const checkTerminal = (): void => {
      if (!attemptId || resolved) return;
      const attempt =
        signingAttempts
          .getAllAttempts()
          .find((a) => a.attemptId === attemptId) ?? null;
      if (!attempt) {
        // Removed from the store: either user-cancelled or LRU-evicted.
        const reason: RecoverableSignFailureReason =
          lastSeenAttempt?.state === "completed" ? "cancelled" : "cancelled";
        finish({
          ok: false,
          attemptId,
          reason,
          lastError: lastSeenAttempt?.lastError ?? null,
        });
        return;
      }
      lastSeenAttempt = attempt;
      switch (attempt.state) {
        case "completed":
          finish({ ok: true, attemptId });
          return;
        case "failed":
          finish({
            ok: false,
            attemptId,
            reason: "fatal",
            lastError: attempt.lastError,
          });
          return;
        case "expired":
          finish({
            ok: false,
            attemptId,
            reason: "expired",
            lastError: attempt.lastError,
          });
          return;
        default:
          // idle / signing / awaiting_signer / resuming / submitting  -
          // not terminal yet, keep listening.
          return;
      }
    };

    const unsubscribe = signingAttempts.subscribe(checkTerminal);
    attemptId = signingAttempts.start(input);
    // The state machine emits synchronously inside `start()` for the
    // initial `idle -> signing` transition, but the subscriber was added
    // *before* `start()` so we'll catch any synchronous terminal
    // transitions too (e.g. an immediately-thrown fatal error from inside
    // `performSignAndSubmit`).
    checkTerminal();
  });
}

/**
 * Build a `durable` SigningIntent. Sugar for the common case so call
 * sites don't need to spell out the discriminator.
 */
export function durableIntent(
  name: DurableIntentName,
  idempotencyKey: string,
  label?: string
): SigningIntent {
  return {
    kind: "durable",
    name,
    idempotencyKey,
    label: label ?? defaultLabelFor(name),
  };
}

/** Build an `ephemeral` SigningIntent. */
export function ephemeralIntent(
  name: EphemeralIntentName,
  label?: string
): SigningIntent {
  return {
    kind: "ephemeral",
    name,
    label: label ?? defaultLabelFor(name),
  };
}

function defaultLabelFor(
  name: DurableIntentName | EphemeralIntentName
): string {
  switch (name) {
    case "composer_publish":
      return "Publish";
    case "publish_reply":
      return "Reply";
    case "publish_quote":
      return "Quote";
    case "reschedule_post":
      return "Reschedule";
    case "publish_dm":
      return "Send message";
    case "nip65_publish":
      return "Update relay list";
    case "long_form_publish":
      return "Publish article";
    case "schedule_repost_quote":
      return "Schedule repost";
    case "publish_poll_vote":
      return "Vote";
    case "publish_zap_request":
      return "Zap";
    case "reaction":
      return "Like";
    case "search_engagement_lookup":
      return "Lookup";
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

/**
 * Subscribe to a single attempt by id. Returns `null` when the attempt
 * has been removed from the store (user cancel, LRU eviction).
 *
 * Snapshots are cached so successive calls during a single React render
 * return referentially-equal values  -  required by `useSyncExternalStore`'s
 * tearing-detection in concurrent mode.
 */
export function useSigningAttemptById(
  attemptId: string | null
): SigningAttempt | null {
  // Per-hook cache: store the last (id, snapshot) pair we returned so the
  // snapshot getter can return the same reference for unchanged states.
  const cacheRef = useRef<{
    attemptId: string | null;
    snapshot: SigningAttempt | null;
    key: string;
  }>({ attemptId: null, snapshot: null, key: "" });

  return useSyncExternalStore<SigningAttempt | null>(
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- useSyncExternalStore mandates a (subscriber) => unsubscribe shape; not awaitable.
    (callback) => signingAttempts.subscribe(callback),
    () => {
      if (!attemptId) {
        if (cacheRef.current.attemptId !== null) {
          cacheRef.current = { attemptId: null, snapshot: null, key: "" };
        }
        return cacheRef.current.snapshot;
      }
      const fresh =
        signingAttempts
          .getAllAttempts()
          .find((a) => a.attemptId === attemptId) ?? null;
      const key = snapshotKey(fresh);
      const cached = cacheRef.current;
      if (cached.attemptId === attemptId && cached.key === key) {
        return cached.snapshot;
      }
      cacheRef.current = { attemptId, snapshot: fresh, key };
      return fresh;
    },
    () => null
  );
}

function snapshotKey(attempt: SigningAttempt | null): string {
  if (!attempt) return "";
  return `${attempt.state}:${attempt.resumeUntil ?? "x"}:${attempt.lastError ?? ""}`;
}
