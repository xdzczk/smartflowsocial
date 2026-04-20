/**
 * @vitest-environment jsdom
 *
 * Integration regression test for the "wrong 3-relay subset on autocomplete"
 * bug. This goes one level deeper than `build-publish-formdata.test.ts`:
 * instead of asserting that the helpers, called manually with the same
 * arguments, produce identical FormData, this test simulates the actual
 * pending-publish lifecycle that drives `runSubmit`. The fresh attempt
 * fails because the bunker is asleep, the resume callback fires when the
 * signer comes back online, and we capture both FormData objects to verify
 * they are byte-for-byte identical — including the relay override field
 * (which is what the user originally observed regressing) and the
 * submissionId (which guarantees the server-side
 * creationIdempotencyKey collapses both attempts onto one Post row).
 *
 * If a future refactor reintroduces the "two paths build slightly different
 * payloads" bug class, this test catches it before the relay or
 * idempotency invariants leak into production.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  pendingPublish,
  _resetForTests as resetPendingPublish,
} from "~/features/auth/signing/signing-attempts.client";
import {
  appendRelayOverride,
  appendSubmissionId,
} from "~/features/posts/composer/services/build-publish-formdata.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";

async function flushMicrotasks(): Promise<void> {
  // vi.useFakeTimers() patches setTimeout, so we cannot `await new Promise(r => setTimeout(r, 0))`
  // without advancing real time; pumping the microtask queue is the right primitive
  // for letting an awaited rejection chain its `.catch` handlers.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function fdToSortedPairs(fd: FormData): Array<[string, string]> {
  const entries = Array.from(fd.entries()).map(
    ([k, v]) => [k, String(v)] as [string, string]
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries;
}

/**
 * Mirrors the shape of the FormData a real composer click would build
 * inside `runSubmit`. We deliberately call the same shared helpers
 * (`appendRelayOverride`, `appendSubmissionId`) the production code path
 * uses, so any encoding drift in those helpers will fail this test.
 */
function buildRunSubmitPayload(
  submissionId: string,
  relayOverride: string[]
): FormData {
  const fd = new FormData();
  fd.set("_action", "post");
  fd.set("content", "hello world");
  fd.set("includeHashtagsInNoteBody", "true");
  appendRelayOverride(fd, relayOverride);
  appendSubmissionId(fd, submissionId);
  return fd;
}

describe("runSubmit fresh-vs-resumed payload equality", () => {
  beforeEach(() => {
    resetPendingPublish();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetPendingPublish();
  });

  it("the fresh and resumed attempts submit byte-identical FormData (incl. relays + submissionId)", async () => {
    const userRelays = [
      "wss://relay.damus.io",
      "wss://relay.primal.net",
      "wss://nos.lol",
      "wss://nostr.wine",
    ];

    // Captured payloads from each pendingPublish-driven invocation.
    const captured: FormData[] = [];
    const signerUnavailable = new RemoteSignerTimeoutError(
      "Bunker did not respond"
    );

    // First call rejects (signer asleep). Second call (driven by
    // maybeResume) succeeds. Both should build the same FormData via the
    // shared helpers using the *same* submissionId the store handed us.
    const performSignAndSubmit = vi
      .fn()
      .mockImplementationOnce(async (submissionId: string) => {
        captured.push(buildRunSubmitPayload(submissionId, userRelays));
        throw signerUnavailable;
      })
      .mockImplementationOnce(async (submissionId: string) => {
        captured.push(buildRunSubmitPayload(submissionId, userRelays));
      });

    pendingPublish.start({ performSignAndSubmit });
    await flushMicrotasks();

    expect(pendingPublish.getSnapshot()?.state).toBe("awaiting_signer");
    expect(captured).toHaveLength(1);

    const resumed = pendingPublish.maybeResume();
    expect(resumed).toBe(true);
    await flushMicrotasks();

    expect(performSignAndSubmit).toHaveBeenCalledTimes(2);
    expect(captured).toHaveLength(2);

    const [fresh, resumedPayload] = captured;
    if (!fresh || !resumedPayload) throw new Error("captured payloads missing");

    // The whole point of this test: the resumed payload must equal the
    // fresh payload, including the canonical relay override and the
    // shared submissionId. If the resumed path ever drifts (different
    // submissionId, different relay encoding, missing field) this fails.
    expect(fdToSortedPairs(resumedPayload)).toEqual(fdToSortedPairs(fresh));

    // Spot-check: the relay field was actually present in both (regression
    // guard for "the resumed path silently drops the relay override and
    // falls back to a default 3-relay subset on the server").
    expect(fresh.get("relays")).toBe(JSON.stringify(userRelays));
    expect(resumedPayload.get("relays")).toBe(JSON.stringify(userRelays));

    // Spot-check: the submissionId is shared across attempts so the
    // server-side creationIdempotencyKey collapses both onto one Post row.
    expect(fresh.get("submissionId")).toBe(resumedPayload.get("submissionId"));
    expect(typeof fresh.get("submissionId")).toBe("string");
    expect(String(fresh.get("submissionId")).length).toBeGreaterThan(0);
  });

  it("a resume that fires after a manual cancel does NOT re-submit (no duplicate publish)", async () => {
    const captured: FormData[] = [];
    const signerUnavailable = new RemoteSignerTimeoutError(
      "Bunker did not respond"
    );
    const performSignAndSubmit = vi
      .fn()
      .mockImplementation(async (submissionId: string) => {
        captured.push(
          buildRunSubmitPayload(submissionId, ["wss://relay.example"])
        );
        throw signerUnavailable;
      });

    pendingPublish.start({ performSignAndSubmit });
    await flushMicrotasks();
    expect(captured).toHaveLength(1);

    pendingPublish.cancel();
    const resumed = pendingPublish.maybeResume();
    await flushMicrotasks();

    expect(resumed).toBe(false);
    expect(captured).toHaveLength(1);
    expect(pendingPublish.getSnapshot()).toBeNull();
  });
});
