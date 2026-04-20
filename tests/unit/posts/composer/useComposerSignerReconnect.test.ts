/**
 * @vitest-environment jsdom
 * Tests composer signer reconnect: clear on healthy event, optional retry callback.
 *
 * Background polling was removed: the hook only listens for the
 * "nostr-connection-healthy" event and never spins up an interval.
 *
 * Resolution order on the healthy event:
 *   1. `pendingPublish.maybeResume()` — only fires when the composer
 *      registered a state-machine attempt; in these unit tests no attempt is
 *      registered, so the helper short-circuits and we exercise the legacy
 *      retry / clear paths exactly as before.
 *   2. caller-supplied `onHealthyWhileSigning` retry callback.
 *   3. `clearSigningState` fallback.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useComposerSignerReconnect } from "~/features/posts/composer/hooks/useComposerSignerReconnect";
import { _resetForTests as resetPendingPublish } from "~/features/posts/composer/state/pending-publish.client";

describe("useComposerSignerReconnect", () => {
  beforeEach(() => {
    // Make sure no cross-test pending attempt accidentally swallows the
    // healthy event before the legacy callbacks see it.
    resetPendingPublish();
  });

  it("clears signing state when nostr-connection-healthy is dispatched", () => {
    const clearSigningState = vi.fn();
    renderHook(() => useComposerSignerReconnect(clearSigningState, false));

    window.dispatchEvent(new CustomEvent("nostr-connection-healthy"));

    expect(clearSigningState).toHaveBeenCalledTimes(1);
  });

  it("calls onHealthyWhileSigning first and skips clear when retry returns true", () => {
    const clearSigningState = vi.fn();
    const onHealthyWhileSigning = vi.fn(() => true);
    renderHook(() =>
      useComposerSignerReconnect(
        clearSigningState,
        false,
        onHealthyWhileSigning
      )
    );

    window.dispatchEvent(new CustomEvent("nostr-connection-healthy"));

    expect(onHealthyWhileSigning).toHaveBeenCalledTimes(1);
    expect(clearSigningState).not.toHaveBeenCalled();
  });

  it("calls clearSigningState when onHealthyWhileSigning returns false", () => {
    const clearSigningState = vi.fn();
    const onHealthyWhileSigning = vi.fn(() => false);
    renderHook(() =>
      useComposerSignerReconnect(
        clearSigningState,
        false,
        onHealthyWhileSigning
      )
    );

    window.dispatchEvent(new CustomEvent("nostr-connection-healthy"));

    expect(onHealthyWhileSigning).toHaveBeenCalledTimes(1);
    expect(clearSigningState).toHaveBeenCalledTimes(1);
  });

  it("cleans up the healthy listener on unmount", () => {
    const clearSigningState = vi.fn();
    const { unmount } = renderHook(() =>
      useComposerSignerReconnect(clearSigningState, true)
    );

    unmount();

    window.dispatchEvent(new CustomEvent("nostr-connection-healthy"));
    expect(clearSigningState).not.toHaveBeenCalled();
  });
});
