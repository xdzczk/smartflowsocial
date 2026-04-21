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
 *      non-recoverable error — preserves the legacy throwing contract for
 *      the call sites that re-throw the failure.
 *   3. `ok: false, reason: "expired"` when the recovery window elapses.
 *   4. `ok: false, reason: "cancelled"` when the user (or another start()
 *      under the single-slot flag) tears down the attempt before it
 *      completes.
 *   5. The promise NEVER rejects — every outcome flows through `result`.
 *      Migrated callers depend on this so a rogue throw inside the
 *      sign+submit closure can't escape the wrapper and surface as an
 *      unhandled rejection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetForTests as resetSigningAttempts,
  cancelAll,
  markCompleted,
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
    // unconditionally overwrite the attempt state with `"submitting"` —
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
    // Attempt is parked, not yet resolved — the wrapper waits for the
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
