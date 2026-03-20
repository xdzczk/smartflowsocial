/**
 * @vitest-environment jsdom
 * Tests composer signer reconnect: clear on healthy event, tryBackgroundReconnect interval when isSigning.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockTryBackgroundReconnect = vi.fn();
vi.mock("~/features/auth/signer", () => ({
  tryBackgroundReconnect: (...args: unknown[]) =>
    mockTryBackgroundReconnect(...args),
}));

import { useComposerSignerReconnect } from "~/features/posts/composer/hooks/useComposerSignerReconnect";

describe("useComposerSignerReconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("does not run reconnect interval when isSigning is false", () => {
    const clearSigningState = vi.fn();
    renderHook(() => useComposerSignerReconnect(clearSigningState, false));

    vi.advanceTimersByTime(30_000);

    expect(mockTryBackgroundReconnect).not.toHaveBeenCalled();
  });

  it("does not call tryBackgroundReconnect periodically when isSigning is true (reconnect only on healthy event)", () => {
    const clearSigningState = vi.fn();
    renderHook(() => useComposerSignerReconnect(clearSigningState, true));

    vi.advanceTimersByTime(60_000);

    expect(mockTryBackgroundReconnect).not.toHaveBeenCalled();
  });

  it("cleans up healthy listener and interval on unmount", () => {
    const clearSigningState = vi.fn();
    const { unmount } = renderHook(() =>
      useComposerSignerReconnect(clearSigningState, true)
    );

    unmount();

    window.dispatchEvent(new CustomEvent("nostr-connection-healthy"));
    expect(clearSigningState).not.toHaveBeenCalled();

    vi.advanceTimersByTime(15_000);
    expect(mockTryBackgroundReconnect).not.toHaveBeenCalled();
  });
});
