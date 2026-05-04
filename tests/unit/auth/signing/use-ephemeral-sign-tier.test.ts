/**
 * @vitest-environment jsdom
 *
 * PR 4: subtle-then-escalate UI tier for ephemeral signing intents.
 *
 * `useEphemeralSignTier` is the hook that flips between the
 * `SubtleSignPending` inline spinner and the `CompactSignStatus`
 * Resume/Cancel pill. The contract this suite asserts:
 *
 *   1. Ephemeral attempts in `signing` / `submitting` / `resuming` render
 *      the subtle spinner (never the compact pill, regardless of how
 *      long the attempt has been running  -  those states aren't blocked
 *      on the user).
 *   2. Ephemeral attempts in `awaiting_signer` render subtle for the
 *      first `EPHEMERAL_ESCALATION_MS`, then escalate to compact.
 *   3. `expired` always renders compact (so the pill can show the
 *      "timed out / Dismiss" affordance).
 *   4. Terminal states (`completed`, `failed`, `idle`) render nothing
 *      (`null`).
 *   5. The hook does not require multi-slot mode  -  `start({ ephemeral })`
 *      coexists with a foreground durable attempt under the default
 *      single-slot flag (verifies the additive ephemeral rule added to
 *      `signing-attempts.start()` in PR 4).
 *   6. `signing-attempts.runAttempt` writes `awaitingSince` on the
 *      transition into `awaiting_signer` and clears it on resume  -  the
 *      hook keys off this field.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetForTests as resetSigningAttempts,
  EPHEMERAL_ESCALATION_MS,
  getAllAttempts,
  getForegroundAttempt,
  markCompleted,
  start,
  type SigningAttempt,
} from "~/features/auth/signing/signing-attempts.client";
import { useEphemeralSignTier } from "~/features/auth/signing/use-ephemeral-sign-tier.client";
import {
  durableIntent,
  ephemeralIntent,
  useSigningAttemptById,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";
import {
  _setClientFeatureFlagsForTests,
  clientFeatureFlags,
} from "~/lib/feature-flags.client";

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("useEphemeralSignTier", () => {
  let savedFlag: boolean;

  beforeEach(() => {
    savedFlag = clientFeatureFlags.signingMultiSlot;
    // PR 4 must work under the default single-slot flag  -  that's the
    // production state until PR 6 flips multi-slot on.
    _setClientFeatureFlagsForTests({ signingMultiSlot: false });
    resetSigningAttempts();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetSigningAttempts();
    _setClientFeatureFlagsForTests({ signingMultiSlot: savedFlag });
  });

  function renderTierForAttempt(attemptId: string) {
    return renderHook(() => {
      const attempt = useSigningAttemptById(attemptId);
      return { attempt, tier: useEphemeralSignTier(attempt) };
    });
  }

  it("returns 'subtle' while an ephemeral attempt is signing", async () => {
    const sign = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const id = start({
      performSignAndSubmit: sign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "lookup:note:1",
    });

    await flushMicrotasks();
    const { result } = renderTierForAttempt(id);
    expect(result.current.attempt?.state).toBe("signing");
    expect(result.current.tier).toBe("subtle");
  });

  it("stays 'subtle' for the first EPHEMERAL_ESCALATION_MS in awaiting_signer, then escalates to 'compact'", async () => {
    const sign = vi
      .fn()
      .mockRejectedValueOnce(new RemoteSignerTimeoutError("Bunker offline"));
    const id = start({
      performSignAndSubmit: sign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "notifications:row:abc",
    });
    await flushMicrotasks();

    const attempt = getForegroundAttempt() as SigningAttempt;
    expect(attempt.state).toBe("awaiting_signer");
    expect(attempt.awaitingSince).toBeTypeOf("number");

    const { result, rerender } = renderTierForAttempt(id);
    // Immediately after entering awaiting_signer  -  still subtle.
    expect(result.current.tier).toBe("subtle");

    // Just under the threshold  -  still subtle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EPHEMERAL_ESCALATION_MS - 100);
    });
    rerender();
    expect(result.current.tier).toBe("subtle");

    // Cross the threshold  -  should escalate to compact.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    rerender();
    expect(result.current.tier).toBe("compact");
  });

  it("returns 'compact' for an expired attempt regardless of intent kind", async () => {
    const sign = vi
      .fn()
      .mockRejectedValueOnce(new RemoteSignerTimeoutError("Bunker offline"));
    const id = start({
      performSignAndSubmit: sign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "notifications:row:exp",
    });
    await flushMicrotasks();

    // Fast-forward past the recovery window to force expiry.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    });

    const { result } = renderTierForAttempt(id);
    expect(result.current.attempt?.state).toBe("expired");
    expect(result.current.tier).toBe("compact");
  });

  it("returns null for terminal states (completed) so the pill disappears", async () => {
    const sign = vi.fn().mockResolvedValue(undefined);
    const id = start({
      performSignAndSubmit: sign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "notifications:row:done",
    });
    await flushMicrotasks();
    markCompleted(id);

    const { result } = renderTierForAttempt(id);
    expect(result.current.attempt?.state).toBe("completed");
    expect(result.current.tier).toBeNull();
  });

  it("ephemeral attempts coexist with a foreground durable attempt under the single-slot flag", async () => {
    const composerSign = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const reactionSign = vi.fn().mockReturnValue(new Promise<void>(() => {}));

    const composerId = start({
      performSignAndSubmit: composerSign,
      intent: durableIntent("composer_publish", "idem-composer", "Publish"),
      surface: "composer",
    });
    await flushMicrotasks();
    expect(getForegroundAttempt()?.attemptId).toBe(composerId);

    // A "Like" click during a composer publish must NOT cancel the
    // foreground composer attempt, even with multi-slot OFF.
    const reactionId = start({
      performSignAndSubmit: reactionSign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "notifications:row:1",
    });
    await flushMicrotasks();

    const all = getAllAttempts().map((a) => a.attemptId);
    expect(all).toContain(composerId);
    expect(all).toContain(reactionId);
    expect(all).toHaveLength(2);
  });

  it("clears awaitingSince on resume so the tier reverts to subtle", async () => {
    const sign = vi
      .fn()
      .mockRejectedValueOnce(new RemoteSignerTimeoutError("Bunker offline"))
      .mockReturnValueOnce(new Promise<void>(() => {}));
    const id = start({
      performSignAndSubmit: sign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "notifications:row:resume",
    });
    await flushMicrotasks();

    const parked = getForegroundAttempt() as SigningAttempt;
    expect(parked.state).toBe("awaiting_signer");
    expect(parked.awaitingSince).toBeTypeOf("number");

    // Past escalation threshold  -  would render compact at this point.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EPHEMERAL_ESCALATION_MS + 100);
    });
    const { result, rerender } = renderTierForAttempt(id);
    expect(result.current.tier).toBe("compact");

    // Resume; the second sign hangs forever so the attempt sits in
    // `resuming` (which is still subtle).
    await act(async () => {
      // Read getter to avoid importing the namespaced object twice.
      const { signingAttempts } =
        await import("~/features/auth/signing/signing-attempts.client");
      signingAttempts.maybeResume();
      await flushMicrotasks();
    });
    rerender();
    const resumed = getForegroundAttempt() as SigningAttempt;
    expect(resumed.state).toBe("resuming");
    expect(resumed.awaitingSince).toBeNull();
    expect(result.current.tier).toBe("subtle");
  });
});
