/**
 * @vitest-environment jsdom
 *
 * Verifies the resumable publish-attempt state machine that fixes the
 * "Scenario A vs Scenario B" divergence in the user-reported signer-restart
 * bug:
 *   - A sign call that fails because the signer is unavailable parks the
 *     attempt in `awaiting_signer` with a finite recovery window.
 *   - `maybeResume()` only re-runs the original sign+submit closure when
 *     the attempt is still inside that window and is currently parked.
 *   - Once the window elapses, the attempt is `expired` and a reconnect
 *     never silently autocompletes  -  the user must explicitly retry.
 *   - A late callback from a previous generation cannot mutate the store
 *     after `cancel()` or a fresh `start()`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  pendingPublish,
  RECOVERY_WINDOW_MS,
  _resetForTests as resetPendingPublish,
} from "~/features/auth/signing/signing-attempts.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";

async function flushMicrotasks(): Promise<void> {
  // We can't `setTimeout(resolve, 0)` here because vi.useFakeTimers() patches
  // setTimeout; instead pump the microtask queue a few times so any chained
  // `.then`s on the sign promise have a chance to settle.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("pending-publish state machine", () => {
  beforeEach(() => {
    resetPendingPublish();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetPendingPublish();
  });

  it("parks in awaiting_signer when signer is unavailable and exposes a recovery window", async () => {
    const signerUnavailable = new RemoteSignerTimeoutError(
      "Bunker did not respond"
    );
    const performSignAndSubmit = vi.fn().mockRejectedValue(signerUnavailable);

    const startedAt = Date.now();
    pendingPublish.start({ performSignAndSubmit });

    // Don't `runAllTimersAsync` here: that would also fire the recovery
    // expiry timer and immediately push us to `expired`. We only need
    // microtasks to settle so the rejected sign promise lands.
    await flushMicrotasks();

    const snapshot = pendingPublish.getSnapshot();
    expect(snapshot?.state).toBe("awaiting_signer");
    expect(snapshot?.resumeUntil).not.toBeNull();
    expect(snapshot?.resumeUntil ?? 0).toBeGreaterThanOrEqual(
      startedAt + RECOVERY_WINDOW_MS - 50
    );
    expect(snapshot?.lastError).toContain("did not respond");
    expect(performSignAndSubmit).toHaveBeenCalledTimes(1);
  });

  it("re-runs the original sign+submit on maybeResume when still inside the window", async () => {
    const signerUnavailable = new RemoteSignerTimeoutError(
      "Bunker did not respond"
    );
    const performSignAndSubmit = vi
      .fn()
      .mockRejectedValueOnce(signerUnavailable)
      .mockResolvedValueOnce(undefined);

    const submissionId = pendingPublish.start({ performSignAndSubmit });

    await flushMicrotasks();
    expect(pendingPublish.getSnapshot()?.state).toBe("awaiting_signer");

    const resumed = pendingPublish.maybeResume();
    expect(resumed).toBe(true);

    await flushMicrotasks();

    expect(performSignAndSubmit).toHaveBeenCalledTimes(2);
    expect(performSignAndSubmit.mock.calls[0]?.[0]).toBe(submissionId);
    expect(performSignAndSubmit.mock.calls[1]?.[0]).toBe(submissionId);
    expect(pendingPublish.getSnapshot()?.state).toBe("submitting");
  });

  it("expires the attempt after the recovery window and refuses silent resume", async () => {
    const signerUnavailable = new RemoteSignerTimeoutError(
      "Bunker did not respond"
    );
    const performSignAndSubmit = vi.fn().mockRejectedValue(signerUnavailable);

    pendingPublish.start({ performSignAndSubmit });

    await flushMicrotasks();
    expect(pendingPublish.getSnapshot()?.state).toBe("awaiting_signer");

    await vi.advanceTimersByTimeAsync(RECOVERY_WINDOW_MS + 1000);
    await flushMicrotasks();

    expect(pendingPublish.getSnapshot()?.state).toBe("expired");
    const resumed = pendingPublish.maybeResume();
    expect(resumed).toBe(false);
    expect(performSignAndSubmit).toHaveBeenCalledTimes(1);
  });

  it("classifies non-signer errors as fatal and marks the attempt failed", async () => {
    const fatal = new Error("Schedule cap exceeded");
    const performSignAndSubmit = vi.fn().mockRejectedValue(fatal);

    pendingPublish.start({ performSignAndSubmit });

    await vi.runAllTimersAsync();
    await flushMicrotasks();

    expect(pendingPublish.getSnapshot()?.state).toBe("failed");
    expect(pendingPublish.getSnapshot()?.lastError).toBe(
      "Schedule cap exceeded"
    );
  });

  it("ignores stale callbacks after cancel()", async () => {
    const deferred: { reject?: (err: unknown) => void } = {};
    const inflight = new Promise<void>((_resolve, reject) => {
      deferred.reject = reject;
    });
    const performSignAndSubmit = vi.fn().mockReturnValue(inflight);

    pendingPublish.start({ performSignAndSubmit });

    pendingPublish.cancel();
    expect(pendingPublish.getSnapshot()).toBeNull();

    deferred.reject?.(new RemoteSignerTimeoutError("Bunker did not respond"));
    await flushMicrotasks();

    // Cancel must win: a late rejection from a generation we abandoned must
    // not resurrect the attempt as awaiting_signer.
    expect(pendingPublish.getSnapshot()).toBeNull();
  });

  it("markCompleted only acts on the matching submissionId", async () => {
    const performSignAndSubmit = vi.fn().mockResolvedValue(undefined);
    const submissionId = pendingPublish.start({ performSignAndSubmit });

    await flushMicrotasks();
    pendingPublish.markCompleted("not-the-right-id");
    expect(pendingPublish.getSnapshot()?.state).not.toBe("completed");

    pendingPublish.markCompleted(submissionId);
    expect(pendingPublish.getSnapshot()?.state).toBe("completed");
  });

  it("returns a referentially-stable snapshot when nothing observable changed", () => {
    const performSignAndSubmit = vi.fn().mockResolvedValue(undefined);
    pendingPublish.start({ performSignAndSubmit });

    const a = pendingPublish.getSnapshot();
    const b = pendingPublish.getSnapshot();
    expect(a).toBe(b);
  });

  // Guards the "duplicate publish on stop-then-restart-bunker" regression:
  // the reconnect hook checks `isActiveAttempt()` to decide whether the UI
  // can be cleared. Anything that means "a publish is still in flight or
  // waiting on the user's signer" must report active so the Publish button
  // never reappears mid-attempt.
  describe("isActiveAttempt", () => {
    it("is false when there's no current attempt", () => {
      expect(pendingPublish.isActiveAttempt()).toBe(false);
    });

    it("is true while signing (sign call still hanging)", () => {
      pendingPublish.start({
        performSignAndSubmit: () =>
          new Promise<void>(() => {
            /* never resolves */
          }),
      });
      expect(pendingPublish.getSnapshot()?.state).toBe("signing");
      expect(pendingPublish.isActiveAttempt()).toBe(true);
    });

    it("is true while parked in awaiting_signer", async () => {
      pendingPublish.start({
        performSignAndSubmit: vi
          .fn()
          .mockRejectedValue(
            new RemoteSignerTimeoutError("Bunker did not respond")
          ),
      });
      await flushMicrotasks();
      expect(pendingPublish.getSnapshot()?.state).toBe("awaiting_signer");
      expect(pendingPublish.isActiveAttempt()).toBe(true);
    });

    it("is false once the attempt has expired, completed, failed, or been cancelled", async () => {
      pendingPublish.start({
        performSignAndSubmit: vi
          .fn()
          .mockRejectedValue(
            new RemoteSignerTimeoutError("Bunker did not respond")
          ),
      });
      await flushMicrotasks();
      await vi.advanceTimersByTimeAsync(RECOVERY_WINDOW_MS + 1000);
      await flushMicrotasks();
      expect(pendingPublish.getSnapshot()?.state).toBe("expired");
      expect(pendingPublish.isActiveAttempt()).toBe(false);

      pendingPublish.cancel();
      expect(pendingPublish.isActiveAttempt()).toBe(false);
    });
  });
});
