/**
 * @vitest-environment jsdom
 *
 * Contract tests for the PR 5 bulk-signing helper.
 *
 * `signBatchWithRecovery` is the foundation that `useBulkPostSigning`,
 * `useDraftBulkResumeState`, and the `buildAndSign{Repost,Quote}Schedules`
 * helpers all stand on. The properties asserted here are the shape every
 * call site relies on:
 *
 *   1. Resolves `ok: true` when every item signs successfully  -  leaves
 *      the attempt in `submitting` so the caller can `markCompleted`
 *      after their downstream submit lands.
 *   2. Resolves `ok: false, reason: "partial"` when some items fail
 *      with non-recoverable errors after the retry pass  -  auto-cancels
 *      the attempt so the foreground banner clears.
 *   3. Parks the attempt as `awaiting_signer` on a sign-timeout error
 *      and resumes from the next-unsigned index (already-signed items
 *      are NEVER re-signed across resumes).
 *   4. The promise NEVER rejects  -  every outcome flows through the
 *      `result` value.
 *   5. Pre-acquires the signer once, then re-acquires for the second
 *      pass (matches the historical bulk perf characteristics).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActiveSigner = vi.fn();
vi.mock("~/features/auth/signer", () => ({
  getActiveSigner: () => mockGetActiveSigner(),
}));

import { signBatchWithRecovery } from "~/features/auth/signing/sign-batch-with-recovery.client";
import {
  _resetForTests as resetSigningAttempts,
  cancelAll,
  signingAttempts,
} from "~/features/auth/signing/signing-attempts.client";
import { durableIntent } from "~/features/auth/signing/use-recoverable-sign.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";

async function flushMicrotasks(cycles = 20): Promise<void> {
  for (let i = 0; i < cycles; i++) {
    await Promise.resolve();
  }
}

describe("signBatchWithRecovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSigningAttempts();
    mockGetActiveSigner.mockReset();
    mockGetActiveSigner.mockResolvedValue({ kind: "fake" });
  });
  afterEach(() => {
    cancelAll();
    resetSigningAttempts();
    vi.useRealTimers();
  });

  it("signs every item, leaves the attempt in submitting, and reports ok:true", async () => {
    const promise = signBatchWithRecovery<number, { value: number }>({
      items: [1, 2, 3],
      intent: durableIntent("composer_publish", "idem-batch-1", "Bulk"),
      surface: "test:bulk",
      perItemDelayMs: 0,
      retryPassDelayMs: 0,
      signItem: async (item) => ({ value: item * 10 }),
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.signed).toEqual([
      { originalIndex: 0, signed: { value: 10 } },
      { originalIndex: 1, signed: { value: 20 } },
      { originalIndex: 2, signed: { value: 30 } },
    ]);
    expect(result.failedIndices).toEqual([]);
    const stored = signingAttempts.getAllAttempts();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.state).toBe("submitting");
    expect(mockGetActiveSigner).toHaveBeenCalledTimes(1);
  });

  it("collects fatal per-item errors into failedIndices and resolves ok:false reason:partial", async () => {
    const calls: number[] = [];
    const promise = signBatchWithRecovery<number, number>({
      items: [1, 2, 3, 4],
      intent: durableIntent("composer_publish", "idem-batch-2", "Bulk"),
      surface: "test:bulk-partial",
      perItemDelayMs: 0,
      retryPassDelayMs: 0,
      signItem: async (item, index) => {
        calls.push(index);
        if (index === 1 || index === 3) {
          throw new TypeError(`bad item ${item}`);
        }
        return item * 10;
      },
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("partial");
    expect(result.signed.map((s) => s.originalIndex)).toEqual([0, 2]);
    expect(result.failedIndices).toEqual([1, 3]);
    // Auto-cancel keeps the foreground clear for the host UI to take over.
    expect(signingAttempts.getAllAttempts()).toHaveLength(0);
    // Pass 2 re-acquires the signer (default behavior).
    expect(mockGetActiveSigner).toHaveBeenCalledTimes(2);
    // Each failed item retried once on pass 2.
    expect(calls.filter((i) => i === 1)).toHaveLength(2);
    expect(calls.filter((i) => i === 3)).toHaveLength(2);
  });

  it("parks the attempt as awaiting_signer on a sign-timeout error mid-batch and never re-signs already-signed items on resume", async () => {
    let throwOnNext = true;
    const signedAtCallTime: number[] = [];
    const promise = signBatchWithRecovery<number, number>({
      items: [1, 2, 3],
      intent: durableIntent("composer_publish", "idem-batch-3", "Bulk"),
      surface: "test:bulk-park",
      perItemDelayMs: 0,
      retryPassDelayMs: 0,
      signItem: async (item, index) => {
        signedAtCallTime.push(index);
        if (index === 1 && throwOnNext) {
          throwOnNext = false;
          throw new RemoteSignerTimeoutError("Bunker did not respond");
        }
        return item * 10;
      },
    });

    // Drain microtasks (no timers needed for the immediate-throw path).
    await flushMicrotasks();
    // After pass 1 hit the timeout, the attempt should be parked.
    const parked = signingAttempts.getAllAttempts();
    expect(parked).toHaveLength(1);
    expect(parked[0]?.state).toBe("awaiting_signer");

    // Resume: index 0 has already been signed and MUST NOT be re-signed.
    signingAttempts.maybeResume();
    await flushMicrotasks();

    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.signed.map((s) => s.originalIndex)).toEqual([0, 1, 2]);
    // Index 0 appears exactly once across pass 1 + resume.
    expect(signedAtCallTime.filter((i) => i === 0)).toHaveLength(1);
    // Index 1 appears twice: once that threw, once on resume that succeeded.
    expect(signedAtCallTime.filter((i) => i === 1)).toHaveLength(2);
    expect(signedAtCallTime.filter((i) => i === 2)).toHaveLength(1);
  });

  it("does not run a retry pass when the main pass succeeds for every item", async () => {
    const promise = signBatchWithRecovery<number, number>({
      items: [1, 2, 3],
      intent: durableIntent("composer_publish", "idem-batch-4", "Bulk"),
      surface: "test:bulk-no-retry",
      perItemDelayMs: 0,
      retryPassDelayMs: 0,
      signItem: async (item) => item,
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(true);
    // Only the initial signer acquisition; pass 2 re-acquire never fires.
    expect(mockGetActiveSigner).toHaveBeenCalledTimes(1);
  });

  it("resolves ok:false reason:expired when the recovery window elapses while parked", async () => {
    const promise = signBatchWithRecovery<number, number>({
      items: [1, 2],
      intent: durableIntent("composer_publish", "idem-batch-5", "Bulk"),
      surface: "test:bulk-expired",
      perItemDelayMs: 0,
      retryPassDelayMs: 0,
      signItem: async () => {
        throw new RemoteSignerTimeoutError("Bunker did not respond");
      },
    });

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    const result = await promise;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("expired");
  });

  it("never rejects even when signItem throws synchronously", async () => {
    const promise = signBatchWithRecovery<number, number>({
      items: [1],
      intent: durableIntent("composer_publish", "idem-batch-6", "Bulk"),
      surface: "test:bulk-sync-throw",
      perItemDelayMs: 0,
      retryPassDelayMs: 0,

      signItem: async () => {
        throw new TypeError("hard fail");
      },
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();
  });

  it("forwards the cached signer to signItem and accepts null when no signer is available", async () => {
    mockGetActiveSigner.mockResolvedValueOnce(null);
    const seenSigners: unknown[] = [];
    const promise = signBatchWithRecovery<number, number>({
      items: [1, 2],
      intent: durableIntent("composer_publish", "idem-batch-7", "Bulk"),
      surface: "test:bulk-no-signer",
      perItemDelayMs: 0,
      retryPassDelayMs: 0,
      signItem: async (item, _index, signer) => {
        seenSigners.push(signer);
        return item;
      },
    });
    await vi.runAllTimersAsync();
    await promise;
    expect(seenSigners).toEqual([null, null]);
  });
});
