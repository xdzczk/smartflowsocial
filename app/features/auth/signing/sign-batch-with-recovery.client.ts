/**
 * Bulk-sign helper that drives N items through the signing-attempts
 * recovery state machine as a single durable attempt.
 *
 * PR 5 of the unified-signing-recovery plan replaces the bespoke
 * pass-1 / pass-2 / partial-state machinery in `useBulkPostSigning`,
 * `useDraftBulkResumeState`, and `repost-quote-events.client.ts` with
 * one helper that:
 *
 *   - Wraps the entire batch in a single `signingAttempts.start()` call
 *     so the foreground recovery banner reflects bulk progress instead
 *     of N parallel banners fighting for the slot.
 *   - Pre-acquires the signer once and reuses it across the loop,
 *     matching the historical performance characteristics of the bulk
 *     flow (avoids rebuilding `BunkerSigner` per item after a bfcache
 *     resume).
 *   - Bails out on signer-unavailable errors (sign-timeout / connection
 *     errors) so the attempt parks in `awaiting_signer`. On
 *     `nostr-connection-healthy` the loop resumes from the next
 *     unsigned index — already-signed items are not re-signed.
 *   - Collects fatal per-item errors into `failedIndices` without
 *     cancelling the batch. After the main pass, runs an optional
 *     retry pass (with a re-acquired signer) over the failures, then
 *     resolves with `reason: "partial"` so the host UI can present a
 *     "schedule successful only / retry failed" affordance.
 *
 * The helper does NOT call `markCompleted` itself; it treats reaching
 * the `submitting` state as the success terminal (the entire signing
 * pass finished) and leaves the attempt registered so the caller can
 * mark it completed/failed once their downstream submission lands.
 */

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import { getActiveSigner } from "~/features/auth/signer";
import {
  isConnectionLikeError,
  isSignTimeoutError,
} from "~/lib/signer-error-classification";

import {
  signingAttempts,
  type SigningAttempt,
  type SigningIntent,
} from "./signing-attempts.client";

/** Pass identifier for `onItemFailed` callbacks. */
export type SignBatchPass = 1 | 2;

export interface SignBatchInput<TItem, TSigned> {
  /** Items to sign, in order. Stable indices used in callbacks/results. */
  items: readonly TItem[];
  /**
   * Sign a single item. Receives the (cached) active signer so the
   * caller can pass it through to `nostrAdapter.signEvent`. Throw a
   * sign-timeout / connection error to park the batch as
   * `awaiting_signer`; throw anything else to record a per-item fatal
   * failure and continue.
   */
  signItem: (
    item: TItem,
    index: number,
    signer: NostrSigner | null
  ) => Promise<TSigned>;
  /** Tagged-union describing the user intent (durable for bulk flows). */
  intent: SigningIntent;
  /** Free-form surface label, e.g. `"bulkposts"`, `"drafts:bulk"`. */
  surface?: string;
  /**
   * Whether to re-acquire the active signer for the second pass. The
   * default matches the historical bulk behavior: if pass 1 hit a
   * transport hiccup, picking up any staleness flag raised in the
   * meantime is the right move. Set to false to keep the original
   * signer for pass 2 (e.g. tight-loop tests).
   */
  reacquireSignerOnRetry?: boolean;
  /** ms delay between successful per-item signs. Default 100. */
  perItemDelayMs?: number;
  /** ms delay before the retry pass kicks in. Default 1500. */
  retryPassDelayMs?: number;
  /** Optional per-batch progress hook (signed-so-far, total). */
  onProgress?: (current: number, total: number) => void;
  /** Optional hook fired immediately after a successful per-item sign. */
  onItemSigned?: (signed: TSigned, index: number, pass: SignBatchPass) => void;
  /**
   * Optional hook fired when an item fails with a non-recoverable
   * error (recoverable signer-unavailable errors are NOT surfaced here
   * — they park the attempt and re-enter through the recovery flow).
   */
  onItemFailed?: (error: unknown, index: number, pass: SignBatchPass) => void;
  /**
   * Optional liveness check forwarded to {@link signingAttempts.start}.
   * Use for batches whose underlying resource (deleted draft set,
   * logged-out user, closed modal) may disappear between sign attempts.
   */
  isResourceAlive?: () => boolean;
}

export type SignBatchFailureReason =
  /** Some items failed with non-recoverable errors after both passes. */
  | "partial"
  /** Recovery window expired before all items signed. */
  | "expired"
  /** Attempt was cancelled (user / LRU eviction). */
  | "cancelled"
  /** A non-signer error escaped `signItem` and aborted the loop. */
  | "fatal";

export interface SignedBatchEntry<TSigned> {
  /** Original index in {@link SignBatchInput.items}. */
  originalIndex: number;
  signed: TSigned;
}

export type SignBatchResult<TSigned> =
  | {
      ok: true;
      attemptId: string;
      signed: Array<SignedBatchEntry<TSigned>>;
      failedIndices: never[];
    }
  | {
      ok: false;
      attemptId: string;
      signed: Array<SignedBatchEntry<TSigned>>;
      failedIndices: number[];
      reason: SignBatchFailureReason;
      lastError: string | null;
    };

function isRecoverableSignerError(error: unknown): boolean {
  return isSignTimeoutError(error) || isConnectionLikeError(error);
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drive a batch of N items through one durable signing attempt with
 * automatic park/resume on signer-unavailable errors.
 *
 * The returned promise NEVER rejects. Failures are surfaced via
 * `{ ok: false, reason, signed, failedIndices }` so callers can branch
 * without try/catch.
 *
 * On `ok: true`, the attempt is left in `submitting` state. The caller
 * MUST eventually call `signingAttempts.markCompleted(attemptId)` or
 * `signingAttempts.markFailed(attemptId, message)` after their
 * downstream submission lands so the foreground banner clears.
 *
 * On `ok: false` with `reason: "partial"`, the helper auto-cancels the
 * attempt before resolving so the foreground banner doesn't strand on
 * a non-actionable state. The caller owns the per-item retry UI.
 */
export async function signBatchWithRecovery<TItem, TSigned>(
  input: SignBatchInput<TItem, TSigned>
): Promise<SignBatchResult<TSigned>> {
  const totalItems = input.items.length;
  const perItemDelayMs = input.perItemDelayMs ?? 100;
  const retryPassDelayMs = input.retryPassDelayMs ?? 1500;
  const reacquireOnRetry = input.reacquireSignerOnRetry ?? true;

  // Persistent across resumes — captured by the closure so a parked
  // attempt can pick up exactly where it left off.
  const signedByIndex = new Map<number, TSigned>();
  const failedIndices = new Set<number>();
  let pass: SignBatchPass = 1;
  let cachedSigner: NostrSigner | null = null;
  let signerAcquired = false;
  let pass2Started = false;

  const acquireSigner = async (): Promise<void> => {
    cachedSigner = await getActiveSigner();
    signerAcquired = true;
  };

  const signOne = async (index: number, currentPass: SignBatchPass) => {
    const item = input.items[index];
    if (item === undefined) return;
    try {
      const signed = await input.signItem(item, index, cachedSigner);
      signedByIndex.set(index, signed);
      failedIndices.delete(index);
      input.onItemSigned?.(signed, index, currentPass);
      input.onProgress?.(signedByIndex.size, totalItems);
    } catch (error) {
      if (isRecoverableSignerError(error)) {
        // Park: re-throw so the state machine flips to awaiting_signer
        // and waits for `nostr-connection-healthy` to call us back.
        throw error;
      }
      failedIndices.add(index);
      input.onItemFailed?.(error, index, currentPass);
    }
  };

  const performSignAndSubmit = async (): Promise<void> => {
    if (!signerAcquired) {
      await acquireSigner();
    }

    if (pass === 1) {
      for (let index = 0; index < totalItems; index++) {
        if (signedByIndex.has(index)) continue;
        await signOne(index, 1);
        if (
          index < totalItems - 1 &&
          signedByIndex.has(index) &&
          perItemDelayMs > 0
        ) {
          await delay(perItemDelayMs);
        }
      }
      pass = 2;
    }

    // After pass 1 completes (or on resume after we already advanced
    // past it), drain any non-recoverable failures through one optional
    // retry pass.
    if (failedIndices.size > 0) {
      if (!pass2Started) {
        await delay(retryPassDelayMs);
        if (reacquireOnRetry) await acquireSigner();
        pass2Started = true;
      }
      const remaining = Array.from(failedIndices);
      for (let i = 0; i < remaining.length; i++) {
        const index = remaining[i];
        if (index === undefined) continue;
        await signOne(index, 2);
        if (
          i < remaining.length - 1 &&
          signedByIndex.has(index) &&
          perItemDelayMs > 0
        ) {
          await delay(perItemDelayMs);
        }
      }
    }
  };

  return new Promise<SignBatchResult<TSigned>>((resolve) => {
    let attemptId = "";
    let resolved = false;
    let lastSeen: SigningAttempt | null = null;

    const collectSigned = (): Array<SignedBatchEntry<TSigned>> =>
      Array.from(signedByIndex.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([originalIndex, signed]) => ({ originalIndex, signed }));
    const collectFailed = (): number[] =>
      Array.from(failedIndices).sort((a, b) => a - b);

    const finish = (result: SignBatchResult<TSigned>): void => {
      if (resolved) return;
      resolved = true;
      try {
        unsubscribe();
      } catch {
        // Defensive: never strand the awaiting caller on a listener
        // teardown hiccup.
      }
      // Auto-cancel partial outcomes so the foreground banner doesn't
      // get stuck on a non-actionable state. Success outcomes leave
      // the attempt in `submitting` for the caller to mark complete.
      if (!result.ok && result.reason === "partial" && attemptId) {
        signingAttempts.cancelAttempt(attemptId);
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
        finish({
          ok: false,
          attemptId,
          signed: collectSigned(),
          failedIndices: collectFailed(),
          reason: "cancelled",
          lastError: lastSeen?.lastError ?? null,
        });
        return;
      }
      lastSeen = attempt;
      switch (attempt.state) {
        case "submitting":
        case "completed": {
          if (failedIndices.size > 0) {
            finish({
              ok: false,
              attemptId,
              signed: collectSigned(),
              failedIndices: collectFailed(),
              reason: "partial",
              lastError: null,
            });
          } else {
            finish({
              ok: true,
              attemptId,
              signed: collectSigned(),
              failedIndices: [],
            });
          }
          return;
        }
        case "failed":
          finish({
            ok: false,
            attemptId,
            signed: collectSigned(),
            failedIndices: collectFailed(),
            reason: "fatal",
            lastError: attempt.lastError,
          });
          return;
        case "expired":
          finish({
            ok: false,
            attemptId,
            signed: collectSigned(),
            failedIndices: collectFailed(),
            reason: "expired",
            lastError: attempt.lastError,
          });
          return;
        default:
          // idle / signing / awaiting_signer / resuming — keep listening.
          return;
      }
    };

    const unsubscribe = signingAttempts.subscribe(checkTerminal);
    attemptId = signingAttempts.start({
      intent: input.intent,
      surface: input.surface,
      performSignAndSubmit,
      isResourceAlive: input.isResourceAlive,
    });
    checkTerminal();
  });
}
