/**
 * @vitest-environment jsdom
 *
 * Contract tests for the PR 3 recoverable-sign helper.
 *
 * `startRecoverableSign` is the awaitable wrapper used by every PR 3 medium
 * flow (reschedule, reply, quote, poll vote). The properties asserted here
 * are the shape every migrated call site relies on:
 *
 *   1. `ok: true` after the caller's `performSignAndSubmit` resolves AND
 *      the caller has marked the attempt completed (the caller owns the
 *      transition because only it knows the server response).
 *   2. `ok: false, reason: "fatal"` when the caller's closure throws a
 *      non-recoverable error  -  preserves the legacy throwing contract for
 *      the call sites that re-throw the failure.
 *   3. `ok: false, reason: "expired"` when the recovery window elapses.
 *   4. `ok: false, reason: "cancelled"` when the user (or another start()
 *      under the single-slot flag) tears down the attempt before it
 *      completes.
 *   5. The promise NEVER rejects  -  every outcome flows through `result`.
 *      Migrated callers depend on this so a rogue throw inside the
 *      sign+submit closure can't escape the wrapper and surface as an
 *      unhandled rejection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetForTests as resetSigningAttempts,
  cancelAll,
  markCompleted,
  markFailed,
  signingAttempts,
} from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  ephemeralIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("startRecoverableSign", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSigningAttempts();
  });
  afterEach(() => {
    cancelAll();
    resetSigningAttempts();
    vi.useRealTimers();
  });

  it("resolves ok:true once the caller marks the attempt completed", async () => {
    const promise = startRecoverableSign({
      intent: durableIntent("publish_reply", "idem-1", "Reply"),
      surface: "test:reply",
      performSignAndSubmit: async (submissionId) => {
        // Simulate the realistic shape: sign synchronously, then mark
        // completed once the (mocked) server returns 2xx.
        markCompleted(submissionId);
      },
    });

    await flushMicrotasks();
    const result = await promise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attemptId).toMatch(/.+/);
    }
  });

  it("leaves the attempt state at completed (not submitting) when the callback marks completion inline", async () => {
    // Regression: after the callback returned, `runAttempt` used to
    // unconditionally overwrite the attempt state with `"submitting"`  -
    // clobbering the terminal `"completed"` set by `markCompleted` inside
    // the callback. That left the in-row ephemeral spinner
    // (SubtleSignPending) and the reaction toast bound to the attempt
    // visible forever after a successful Like / Repost.
    const promise = startRecoverableSign({
      intent: ephemeralIntent("reaction", "Like"),
      surface: "test:like",
      performSignAndSubmit: async (submissionId) => {
        markCompleted(submissionId);
      },
    });

    await flushMicrotasks();
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = signingAttempts
      .getAllAttempts()
      .find((a) => a.attemptId === result.attemptId);
    expect(stored?.state).toBe("completed");
  });

  it("resolves ok:false reason:fatal when the closure throws a non-recoverable error", async () => {
    const promise = startRecoverableSign({
      intent: durableIntent("publish_quote", "idem-2", "Quote"),
      surface: "test:quote",
      performSignAndSubmit: async () => {
        throw new TypeError("bad payload");
      },
    });

    await flushMicrotasks();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("fatal");
      expect(result.lastError).toContain("bad payload");
    }
  });

  it("parks the attempt as awaiting_signer on a signer timeout, then resolves expired after the recovery window", async () => {
    const promise = startRecoverableSign({
      intent: durableIntent("reschedule_post", "idem-3", "Reschedule"),
      surface: "test:reschedule",
      performSignAndSubmit: async () => {
        throw new RemoteSignerTimeoutError("Bunker offline");
      },
    });

    await flushMicrotasks();
    // Attempt is parked, not yet resolved  -  the wrapper waits for the
    // recovery window to elapse (or a maybeResume to succeed).
    const inFlight = signingAttempts.getAllAttempts();
    expect(inFlight).toHaveLength(1);
    expect(inFlight[0]?.state).toBe("awaiting_signer");

    // Fast-forward past the recovery window.
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
    }
  });

  it("resolves ok:false reason:cancelled when the attempt is removed mid-flight", async () => {
    let capturedSubmissionId = "";
    const promise = startRecoverableSign({
      intent: durableIntent("publish_dm", "idem-4", "Send"),
      surface: "test:dm",
      performSignAndSubmit: async (submissionId) => {
        capturedSubmissionId = submissionId;
        // Never resolves on its own; the test cancels the attempt.
        await new Promise(() => {
          /* noop */
        });
      },
    });

    await flushMicrotasks();
    expect(capturedSubmissionId).toMatch(/.+/);
    cancelAll();

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("cancelled");
    }
  });

  it("preserves the terminal completed state when the callback marks completion and then throws (catch-path guard)", async () => {
    // Regression: `runAttempt`'s catch used to overwrite `attempt.state`
    // with `awaiting_signer` / `failed` / `expired` even when the
    // callback had already finalized the attempt via `markCompleted`
    // before raising. That resurrected the recovery banner / per-row
    // spinner for an attempt the caller had already moved past.
    const promise = startRecoverableSign({
      intent: durableIntent("publish_reply", "idem-catch-1", "Reply"),
      surface: "test:reply-then-throw",
      performSignAndSubmit: async (submissionId) => {
        markCompleted(submissionId);
        // Simulate a downstream cleanup error AFTER the server has
        // confirmed the submit. The wrapper must still resolve `ok:true`
        // because the caller already declared success.
        throw new Error("post-submit cleanup failed");
      },
    });

    await flushMicrotasks();
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = signingAttempts
      .getAllAttempts()
      .find((a) => a.attemptId === result.attemptId);
    expect(stored?.state).toBe("completed");
  });

  it("ignores a stale markFailed after the attempt is already completed (terminal-state idempotency)", async () => {
    // Regression: out-of-order callbacks could flip the state machine
    // backwards (`completed` -> `failed`). Both `markCompleted` and
    // `markFailed` must early-return on an already-terminal attempt so
    // the recovery banner / row spinner is not resurrected.
    const promise = startRecoverableSign({
      intent: durableIntent("publish_quote", "idem-double-1", "Quote"),
      surface: "test:double-mark",
      performSignAndSubmit: async (submissionId) => {
        markCompleted(submissionId);
        markFailed(submissionId, "spurious late failure callback");
      },
    });

    await flushMicrotasks();
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = signingAttempts
      .getAllAttempts()
      .find((a) => a.attemptId === result.attemptId);
    expect(stored?.state).toBe("completed");
    expect(stored?.lastError).toBeNull();
  });

  it("ignores a stale markCompleted after the attempt is already failed (terminal-state idempotency)", async () => {
    // Mirror of the previous test: a late `markCompleted` must not
    // overwrite a `failed` terminal state set by an earlier
    // `markFailed` callback, otherwise the user would see a spurious
    // success after a real submit failure.
    const promise = startRecoverableSign({
      intent: durableIntent("publish_dm", "idem-double-2", "Send"),
      surface: "test:fail-then-complete",
      performSignAndSubmit: async (submissionId) => {
        markFailed(submissionId, "real failure");
        markCompleted(submissionId);
      },
    });

    await flushMicrotasks();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("fatal");

    const stored = signingAttempts
      .getAllAttempts()
      .find((a) => a.attemptId === result.attemptId);
    expect(stored?.state).toBe("failed");
    expect(stored?.lastError).toBe("real failure");
  });

  it("never rejects even when the closure throws synchronously", async () => {
    const promise = startRecoverableSign({
      intent: ephemeralIntent("reaction", "Like"),
      surface: "test:reaction",
      performSignAndSubmit: () => {
        throw new Error("synchronous oops");
      },
    });

    // The most important guarantee: callers that `await` this can rely
    // on it to always resolve, never reject.
    await expect(promise).resolves.toBeDefined();
  });
});
