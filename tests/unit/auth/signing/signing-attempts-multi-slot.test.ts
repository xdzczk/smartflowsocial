/**
 * @vitest-environment jsdom
 *
 * Multi-slot semantics for the signing-attempts core (PR 2 of the unified
 * signing recovery plan).
 *
 * Single-slot behavior (flag OFF) is covered by the existing
 * `tests/unit/posts/composer/pending-publish.test.ts` suite — those tests
 * MUST still pass byte-identical because the composer is built around the
 * single-slot contract until the rest of the migrations land.
 *
 * This file covers the new behavior gated by
 * `clientFeatureFlags.signingMultiSlot`:
 *   - multiple coexisting attempts with distinct attemptIds
 *   - getAttemptsForSurface fan-out
 *   - LRU eviction over MAX_ATTEMPTS, with a `attempt:evicted` telemetry
 *     event
 *   - per-attempt `isResourceAlive` cancellation on resume
 *   - `nostr-connection-healthy` resumes attempts in createdAt order
 *   - structured telemetry payloads
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetForTests as resetSigningAttempts,
  cancelAttempt,
  getAllAttempts,
  getAttemptsForSurface,
  getForegroundAttempt,
  isActiveAttempt,
  MAX_ATTEMPTS,
  markCompleted,
  maybeResume,
  start,
  type SigningIntent,
} from "~/features/auth/signing/signing-attempts.client";
import {
  onSigningTelemetry,
  type SigningTelemetryEventDetail,
} from "~/features/auth/signing/signing-telemetry.client";
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

function durableIntent(name: string, label = name): SigningIntent {
  return {
    kind: "durable",
    name: name as "composer_publish",
    idempotencyKey: `idem-${name}`,
    label,
  };
}

function ephemeralIntent(name: string, label = name): SigningIntent {
  return {
    kind: "ephemeral",
    name: name as "reaction",
    label,
  };
}

describe("signing-attempts (multi-slot mode)", () => {
  let savedFlag: boolean;
  let unsubscribeTelemetry: (() => void) | null = null;
  let telemetry: SigningTelemetryEventDetail[] = [];

  beforeEach(() => {
    savedFlag = clientFeatureFlags.signingMultiSlot;
    _setClientFeatureFlagsForTests({ signingMultiSlot: true });
    resetSigningAttempts();
    vi.useFakeTimers();
    telemetry = [];
    unsubscribeTelemetry = onSigningTelemetry((detail) => {
      telemetry.push(detail);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSigningAttempts();
    _setClientFeatureFlagsForTests({ signingMultiSlot: savedFlag });
    unsubscribeTelemetry?.();
    unsubscribeTelemetry = null;
  });

  it("keeps multiple coexisting attempts with distinct attemptIds and surfaces", async () => {
    const composerSign = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const rescheduleSign = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const reactionSign = vi.fn().mockReturnValue(new Promise<void>(() => {}));

    const composerId = start({
      performSignAndSubmit: composerSign,
      intent: durableIntent("composer_publish", "Publish"),
      surface: "composer",
    });
    const rescheduleId = start({
      performSignAndSubmit: rescheduleSign,
      intent: durableIntent("reschedule_post", "Reschedule"),
      surface: "scheduling:row:abc",
    });
    const reactionId = start({
      performSignAndSubmit: reactionSign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "notifications:row:xyz",
    });

    expect(composerId).not.toBe(rescheduleId);
    expect(rescheduleId).not.toBe(reactionId);

    const all = getAllAttempts();
    expect(all.map((a) => a.attemptId)).toEqual([
      composerId,
      rescheduleId,
      reactionId,
    ]);
    expect(isActiveAttempt()).toBe(true);

    expect(getAttemptsForSurface("composer")).toHaveLength(1);
    expect(getAttemptsForSurface("scheduling:row:abc")).toHaveLength(1);
    expect(getAttemptsForSurface("notifications:row:xyz")).toHaveLength(1);

    const foreground = getForegroundAttempt();
    expect(foreground?.attemptId).toBe(reactionId);
  });

  it("evicts the oldest non-foreground attempt when MAX_ATTEMPTS is exceeded", async () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) {
      ids.push(
        start({
          performSignAndSubmit: vi.fn().mockReturnValue(new Promise(() => {})),
          intent: durableIntent("composer_publish"),
          surface: `surface:${i}`,
        })
      );
      // Stagger createdAt so the eviction picker has a clear oldest.
      await vi.advanceTimersByTimeAsync(10);
    }

    const remaining = getAllAttempts().map((a) => a.attemptId);
    expect(remaining).toHaveLength(MAX_ATTEMPTS);
    expect(remaining).not.toContain(ids[0]);

    const evictionEvents = telemetry.filter(
      (event) => event.name === "attempt:evicted"
    );
    expect(evictionEvents).toHaveLength(1);
    expect(evictionEvents[0]?.payload).toMatchObject({
      attemptId: ids[0],
      reason: "over_cap",
    });
  });

  it("cancelAttempt removes only the targeted attempt", async () => {
    const sign = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const a = start({
      performSignAndSubmit: sign,
      intent: durableIntent("composer_publish"),
      surface: "composer",
    });
    const b = start({
      performSignAndSubmit: sign,
      intent: durableIntent("publish_reply"),
      surface: "notifications:row:1",
    });

    cancelAttempt(a);
    const remaining = getAllAttempts();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.attemptId).toBe(b);

    const cancelEvents = telemetry.filter(
      (event) => event.name === "attempt:cancelled"
    );
    expect(cancelEvents.some((event) => event.payload.attemptId === a)).toBe(
      true
    );
  });

  it("auto-cancels on resume when isResourceAlive returns false", async () => {
    const signer = vi
      .fn()
      .mockRejectedValueOnce(new RemoteSignerTimeoutError("Bunker offline"));
    const isAlive = vi.fn().mockReturnValue(false);

    const id = start({
      performSignAndSubmit: signer,
      intent: durableIntent("reschedule_post"),
      surface: "scheduling:row:gone",
      isResourceAlive: isAlive,
    });

    await flushMicrotasks();
    expect(getForegroundAttempt()?.state).toBe("awaiting_signer");

    const resumed = maybeResume();
    expect(resumed).toBe(false);
    expect(isAlive).toHaveBeenCalledTimes(1);
    expect(getAllAttempts()).toHaveLength(0);

    const cancelEvent = telemetry.find(
      (event) =>
        event.name === "attempt:cancelled" && event.payload.attemptId === id
    );
    expect(cancelEvent?.payload["reason"]).toBe("resource_gone");
  });

  it("resumes parked attempts in createdAt order on a single healthy event", async () => {
    const callOrder: string[] = [];
    let signACalls = 0;
    let signBCalls = 0;
    let aId = "";
    let bId = "";

    const signA = vi.fn().mockImplementation(async () => {
      signACalls += 1;
      callOrder.push(`A:${aId}:${signACalls}`);
      if (signACalls === 1) {
        throw new RemoteSignerTimeoutError("Bunker offline");
      }
    });
    const signB = vi.fn().mockImplementation(async () => {
      signBCalls += 1;
      callOrder.push(`B:${bId}:${signBCalls}`);
      if (signBCalls === 1) {
        throw new RemoteSignerTimeoutError("Bunker offline");
      }
    });

    aId = start({
      performSignAndSubmit: signA,
      intent: durableIntent("composer_publish"),
      surface: "composer",
    });
    await vi.advanceTimersByTimeAsync(10);
    bId = start({
      performSignAndSubmit: signB,
      intent: durableIntent("publish_reply"),
      surface: "notifications:row:1",
    });

    await flushMicrotasks();
    expect(getAllAttempts().map((x) => x.state)).toEqual([
      "awaiting_signer",
      "awaiting_signer",
    ]);

    // Reset the call ledger before resume so we only assert the resume
    // ordering, not the initial sign-then-fail run.
    callOrder.length = 0;

    expect(maybeResume()).toBe(true);
    await flushMicrotasks();

    expect(callOrder).toEqual([`A:${aId}:2`, `B:${bId}:2`]);
  });

  it("emits attempt:started, attempt:signed, attempt:submit_ok with timing metadata", async () => {
    const sign = vi.fn().mockResolvedValue(undefined);
    const id = start({
      performSignAndSubmit: sign,
      intent: durableIntent("composer_publish"),
      surface: "composer",
    });

    await flushMicrotasks();
    markCompleted(id);

    const seen = telemetry.map((event) => event.name);
    expect(seen).toContain("attempt:started");
    expect(seen).toContain("attempt:signed");
    expect(seen).toContain("attempt:submit_ok");

    const started = telemetry.find((event) => event.name === "attempt:started");
    expect(started?.payload).toMatchObject({
      attemptId: id,
      intentName: "composer_publish",
      intentKind: "durable",
      surface: "composer",
    });
    expect(typeof started?.payload["elapsed_ms"]).toBe("number");
  });
});

describe("signing-attempts (single-slot mode, flag OFF)", () => {
  let savedFlag: boolean;

  beforeEach(() => {
    savedFlag = clientFeatureFlags.signingMultiSlot;
    _setClientFeatureFlagsForTests({ signingMultiSlot: false });
    resetSigningAttempts();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSigningAttempts();
    _setClientFeatureFlagsForTests({ signingMultiSlot: savedFlag });
  });

  it("a fresh start cancels every prior attempt", async () => {
    const signA = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const signB = vi.fn().mockReturnValue(new Promise<void>(() => {}));

    const a = start({
      performSignAndSubmit: signA,
      intent: durableIntent("composer_publish"),
      surface: "composer",
    });
    const b = start({
      performSignAndSubmit: signB,
      intent: durableIntent("publish_reply"),
      surface: "notifications:row:1",
    });

    expect(a).not.toBe(b);
    expect(getAllAttempts()).toHaveLength(1);
    expect(getForegroundAttempt()?.attemptId).toBe(b);
  });
});
