/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useExistingReconnectFlow } from "~/features/auth/reconnect/useExistingReconnectFlow.client";

const mocks = vi.hoisted(() => ({
  getActiveSession: vi.fn(),
  runExistingNostrConnectReconnect: vi.fn(),
  runExistingBunkerReconnect: vi.fn(),
  handleExistingReconnectFailure: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: { success: (...args: unknown[]) => mocks.toastSuccess(...args) },
}));

vi.mock("~/features/auth/signer", () => ({
  getActiveSession: (...args: unknown[]) => mocks.getActiveSession(...args),
}));

vi.mock(
  "~/features/auth/reconnect/reconnect-existing-nostrconnect.client",
  () => ({
    runExistingNostrConnectReconnect: (...args: unknown[]) =>
      mocks.runExistingNostrConnectReconnect(...args),
  })
);

vi.mock("~/features/auth/reconnect/reconnect-existing-bunker.client", () => ({
  runExistingBunkerReconnect: (...args: unknown[]) =>
    mocks.runExistingBunkerReconnect(...args),
}));

vi.mock("~/features/auth/reconnect/reconnect-existing-failure.client", () => ({
  handleExistingReconnectFailure: (...args: unknown[]) =>
    mocks.handleExistingReconnectFailure(...args),
}));

describe("useExistingReconnectFlow", () => {
  const setState = vi.fn();
  const setError = vi.fn();
  const setExistingReconnectAttempt = vi.fn();
  const syncRelaysAfterReconnect = vi.fn(async () => {});
  const onReconnectSuccess = vi.fn();
  const onOpenChange = vi.fn();
  const cancelRef = { current: null as { cancel: () => void } | null };
  const getClosedByExternalReconnect = vi.fn(() => false);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.getActiveSession.mockReturnValue({
      connection: {
        id: "conn-1",
        config: {
          type: "nip46",
          method: "nostrconnect_uri",
          uri: "nostrconnect://x",
          relays: ["wss://relay"],
          clientSecretKeyHex: "ab",
        },
      },
    });
  });

  it("returns early when no active nip46 session", async () => {
    mocks.getActiveSession.mockReturnValue(null);
    const { result } = renderHook(() =>
      useExistingReconnectFlow({
        expectedPubkeyHex: null,
        setState,
        setError,
        setExistingReconnectAttempt,
        syncRelaysAfterReconnect,
        onReconnectSuccess,
        onOpenChange,
        cancelRef,
        getClosedByExternalReconnect,
      })
    );

    await result.current.tryReconnectWithExistingConnection("initial");
    expect(mocks.runExistingNostrConnectReconnect).not.toHaveBeenCalled();
  });

  it("fails fast while offline", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const { result } = renderHook(() =>
      useExistingReconnectFlow({
        expectedPubkeyHex: null,
        setState,
        setError,
        setExistingReconnectAttempt,
        syncRelaysAfterReconnect,
        onReconnectSuccess,
        onOpenChange,
        cancelRef,
        getClosedByExternalReconnect,
      })
    );

    await result.current.tryReconnectWithExistingConnection("initial");
    expect(setState).toHaveBeenCalledWith("failed");
    expect(setError).toHaveBeenCalledWith(
      "You're offline. Check your connection and try again."
    );
  });

  it("handles nostr connect reconnect success", async () => {
    mocks.runExistingNostrConnectReconnect.mockImplementation(
      async (input: { onSuccess: (id: string) => void }) => {
        input.onSuccess("conn-1");
      }
    );
    const { result } = renderHook(() =>
      useExistingReconnectFlow({
        expectedPubkeyHex: null,
        setState,
        setError,
        setExistingReconnectAttempt,
        syncRelaysAfterReconnect,
        onReconnectSuccess,
        onOpenChange,
        cancelRef,
        getClosedByExternalReconnect,
      })
    );

    await result.current.tryReconnectWithExistingConnection("initial");
    expect(mocks.runExistingNostrConnectReconnect).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalled();
    expect(onReconnectSuccess).toHaveBeenCalledWith("conn-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("routes errors into existing reconnect failure handler", async () => {
    mocks.runExistingNostrConnectReconnect.mockRejectedValue(
      new Error("timeout")
    );
    const { result } = renderHook(() =>
      useExistingReconnectFlow({
        expectedPubkeyHex: "abc",
        setState,
        setError,
        setExistingReconnectAttempt,
        syncRelaysAfterReconnect,
        onReconnectSuccess,
        onOpenChange,
        cancelRef,
        getClosedByExternalReconnect,
      })
    );

    await result.current.tryReconnectWithExistingConnection(
      "foreground_resume"
    );
    expect(mocks.handleExistingReconnectFailure).toHaveBeenCalled();
  });

  it("handles bunker reconnect flow", async () => {
    mocks.getActiveSession.mockReturnValue({
      connection: {
        id: "conn-1",
        config: {
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "bunker://x",
          clientSecretKeyHex: "ab",
        },
      },
    });
    mocks.runExistingBunkerReconnect.mockImplementation(
      async (input: { onSuccess: (id: string) => void }) => {
        input.onSuccess("conn-1");
      }
    );

    const { result } = renderHook(() =>
      useExistingReconnectFlow({
        expectedPubkeyHex: null,
        setState,
        setError,
        setExistingReconnectAttempt,
        syncRelaysAfterReconnect,
        onReconnectSuccess,
        onOpenChange,
        cancelRef,
        getClosedByExternalReconnect,
      })
    );

    await result.current.tryReconnectWithExistingBunkerConnection("initial");
    expect(mocks.runExistingBunkerReconnect).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });
});
