/**
 * @vitest-environment jsdom
 * Tests useReconnectDialogState: poll tryBackgroundReconnect while modal open,
 * visibilitychange triggers reconnect once, cleanup on close/unmount,
 * visibility hidden during reconnecting_existing cancels and sets idle.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockTryBackgroundReconnect = vi.fn();
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
  syncRelaysWithRemoteSigner: vi.fn(),
  tryBackgroundReconnect: (...args: unknown[]) =>
    mockTryBackgroundReconnect(...args),
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

const RECONNECT_POLL_MS = 12_000;

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
    mockTryBackgroundReconnect.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("poll tryBackgroundReconnect while modal open", () => {
    it("calls tryBackgroundReconnect every 12s when open is true", () => {
      renderHook(() =>
        useReconnectDialogState({ ...defaultParams, open: true })
      );

      expect(mockTryBackgroundReconnect).not.toHaveBeenCalled();

      vi.advanceTimersByTime(RECONNECT_POLL_MS);
      expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(RECONNECT_POLL_MS);
      expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(RECONNECT_POLL_MS);
      expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(3);
    });

    it("does not run poll interval when open is false", () => {
      renderHook(() =>
        useReconnectDialogState({ ...defaultParams, open: false })
      );

      vi.advanceTimersByTime(RECONNECT_POLL_MS * 3);

      expect(mockTryBackgroundReconnect).not.toHaveBeenCalled();
    });

    it("stops polling when open changes from true to false", () => {
      const { rerender } = renderHook(
        (props) => useReconnectDialogState({ ...defaultParams, ...props }),
        { initialProps: { open: true } }
      );

      vi.advanceTimersByTime(RECONNECT_POLL_MS);
      expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(1);

      rerender({ open: false });
      vi.advanceTimersByTime(RECONNECT_POLL_MS * 2);

      expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(1);
    });

    it("cleans up interval on unmount", () => {
      const { unmount } = renderHook(() =>
        useReconnectDialogState({ ...defaultParams, open: true })
      );

      vi.advanceTimersByTime(RECONNECT_POLL_MS);
      expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(1);

      unmount();
      vi.advanceTimersByTime(RECONNECT_POLL_MS * 2);

      expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("visibilitychange when modal open", () => {
    const visibleState = () => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
    };

    it("calls tryBackgroundReconnect when document becomes visible and modal is open", () => {
      renderHook(() =>
        useReconnectDialogState({ ...defaultParams, open: true })
      );

      mockTryBackgroundReconnect.mockClear();
      visibleState();
      document.dispatchEvent(new Event("visibilitychange"));

      expect(mockTryBackgroundReconnect).toHaveBeenCalled();
      const countAfterFirst = mockTryBackgroundReconnect.mock.calls.length;

      document.dispatchEvent(new Event("visibilitychange"));
      expect(mockTryBackgroundReconnect.mock.calls.length).toBeGreaterThan(
        countAfterFirst
      );
    });

    it("adds visibility listener only when open is true", () => {
      const addSpy = vi.spyOn(document, "addEventListener");
      renderHook(() =>
        useReconnectDialogState({ ...defaultParams, open: false })
      );

      const visibilityAdds = addSpy.mock.calls.filter(
        (c) => c[0] === "visibilitychange"
      );
      addSpy.mockRestore();

      // Both visibility effects in the hook guard on open; with open false neither adds a listener.
      expect(visibilityAdds.length).toBe(0);
    });

    it("visibility handler calls tryBackgroundReconnect when open is true", () => {
      renderHook(() =>
        useReconnectDialogState({ ...defaultParams, open: true })
      );

      mockTryBackgroundReconnect.mockClear();
      visibleState();
      document.dispatchEvent(new Event("visibilitychange"));
      expect(mockTryBackgroundReconnect).toHaveBeenCalled();
    });

    it("cleans up visibility listener on unmount", () => {
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
});
