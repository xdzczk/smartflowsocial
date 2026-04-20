/**
 * @vitest-environment jsdom
 * Tests useReconnectDialogState: visibility hidden during reconnecting_existing
 * cancels the in-flight attempt and returns to idle (no reconnect loop).
 *
 * The previous "poll tryBackgroundReconnect every 12s while open" and
 * "visibility-visible triggers tryBackgroundReconnect" behaviours were
 * removed: the reconnect dialog is now click-driven only (the user clicks
 * "Reconnect" or "Try again"), matching Ditto's UX. Polling caused contention
 * with the user's first sign attempt and added redundant `sign_event`
 * publishes that overwhelmed the bunker.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockOnConnectionHealthy = vi.fn();
const mockGetActiveSession = vi.fn().mockReturnValue(null);

vi.mock("~/features/auth/signer", () => ({
  clearActiveSignerConfig: vi.fn(),
  detectSignerAppName: vi.fn(),
  getActiveConnection: vi.fn().mockReturnValue(null),
  getActiveSigner: vi.fn(),
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
  matchOrCreateSession: vi.fn(),
  parseSecretKeyHex: vi.fn(),
  recordConnectionEvent: vi.fn(),
  serializeSecretKey: vi.fn(),
  setActiveSession: vi.fn(),
  setActiveSignerConfig: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("~/features/auth/reconnect-health.client", () => ({
  useRemoteSignerHealthPolling: vi.fn(() => ({
    onConnectionHealthy: (callback: () => void) => {
      mockOnConnectionHealthy(callback);
      return () => {};
    },
  })),
}));

const mockRunExistingNostrConnectReconnect = vi.fn();
vi.mock(
  "~/features/auth/reconnect/reconnect-existing-nostrconnect.client",
  () => ({
    runExistingNostrConnectReconnect: (...args: unknown[]) =>
      mockRunExistingNostrConnectReconnect(...args),
  })
);
vi.mock("~/features/auth/reconnect/reconnect-existing-bunker.client", () => ({
  runExistingBunkerReconnect: vi.fn(),
}));

import { useReconnectDialogState } from "~/features/auth/useReconnectDialogState.client";

describe("useReconnectDialogState", () => {
  const defaultParams = {
    open: false,
    openMode: "default" as const,
    expectedPubkeyHex: null as string | null,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not register a visibilitychange listener when open is false", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    renderHook(() =>
      useReconnectDialogState({ ...defaultParams, open: false })
    );

    const visibilityAdds = addSpy.mock.calls.filter(
      (c) => c[0] === "visibilitychange"
    );
    addSpy.mockRestore();

    expect(visibilityAdds.length).toBe(0);
  });

  it("removes the visibilitychange listener on unmount when open is true", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() =>
      useReconnectDialogState({ ...defaultParams, open: true })
    );

    const removesBefore = removeSpy.mock.calls.filter(
      (c) => c[0] === "visibilitychange"
    ).length;

    unmount();

    const removesAfter = removeSpy.mock.calls.filter(
      (c) => c[0] === "visibilitychange"
    ).length;
    removeSpy.mockRestore();

    expect(removesAfter).toBeGreaterThan(removesBefore);
  });

  it("when visibility goes hidden during reconnecting_existing, state becomes idle (cancel in-flight, no reconnect loop)", async () => {
    const nostrConnectSession = {
      connection: {
        id: "conn-1",
        config: {
          type: "nip46" as const,
          method: "nostrconnect_uri" as const,
          uri: "nostrconnect://x?relay=wss://a&secret=s",
          relays: ["wss://a"],
        },
        metadata: {},
      },
      currentSession: null,
    };
    mockGetActiveSession.mockReturnValue(nostrConnectSession);
    mockRunExistingNostrConnectReconnect.mockReturnValue(
      new Promise<void>(() => {})
    );

    const { result } = renderHook(() =>
      useReconnectDialogState({
        ...defaultParams,
        open: true,
        openMode: "default",
      })
    );

    await act(async () => {
      await result.current.tryReconnectWithExistingConnection("initial");
    });

    expect(result.current.state).toBe("reconnecting_existing");

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.state).toBe("idle");
  });
});
