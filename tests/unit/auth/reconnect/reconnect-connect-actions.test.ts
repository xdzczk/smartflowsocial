/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  connectWithBunker,
  connectWithNostrConnectUri,
  resumeWithPendingUri,
} from "~/features/auth/reconnect/reconnect-connect-actions.client";

const mocks = vi.hoisted(() => ({
  connectNip46WithBunkerInput: vi.fn(),
  connectNip46WithNostrConnectUri: vi.fn(),
  parseRelayList: vi.fn(),
  createNip46NostrConnectUri: vi.fn(),
  setPendingReconnect: vi.fn(),
  clearPendingReconnectStorage: vi.fn(),
  parseBunkerInput: vi.fn(),
  bunkerCanonicalKey: vi.fn(),
  generateSecretKey: vi.fn(),
}));

vi.mock("nostr-tools", () => ({
  generateSecretKey: (...args: unknown[]) => mocks.generateSecretKey(...args),
  SimplePool: class {
    close = vi.fn();
  },
}));

vi.mock("~/features/auth/nostr-signer.client", () => ({
  connectNip46WithBunkerInput: (...args: unknown[]) =>
    mocks.connectNip46WithBunkerInput(...args),
  connectNip46WithNostrConnectUri: (...args: unknown[]) =>
    mocks.connectNip46WithNostrConnectUri(...args),
}));

vi.mock("~/features/auth/reconnect-uri.client", () => ({
  parseRelayList: (...args: unknown[]) => mocks.parseRelayList(...args),
  createNip46NostrConnectUri: (...args: unknown[]) =>
    mocks.createNip46NostrConnectUri(...args),
  setPendingReconnect: (...args: unknown[]) =>
    mocks.setPendingReconnect(...args),
  clearPendingReconnectStorage: (...args: unknown[]) =>
    mocks.clearPendingReconnectStorage(...args),
  parseBunkerInput: (...args: unknown[]) => mocks.parseBunkerInput(...args),
  bunkerCanonicalKey: (...args: unknown[]) => mocks.bunkerCanonicalKey(...args),
}));

describe("reconnect-connect-actions", () => {
  const setState = vi.fn();
  const setError = vi.fn();
  const setNostrConnectUri = vi.fn();
  const setCancel = vi.fn();
  const matchOrCreateSession = vi.fn(() => ({
    connection: { id: "conn-1", metadata: {}, config: {} },
  }));
  const setActiveSession = vi.fn();
  const updateSession = vi.fn();
  const recordConnectionEvent = vi.fn();
  const setActiveSignerConfig = vi.fn();
  const detectSignerAppName = vi.fn(() => "Signer");
  const syncRelaysAfterReconnect = vi.fn(async () => {});
  const onReconnectSuccess = vi.fn();
  const onOpenChange = vi.fn();
  const toastSuccess = vi.fn();
  const serializeSecretKey = vi.fn(() => "abc");
  const parseSecretKeyHex = vi.fn(() => new Uint8Array([1, 2, 3]));

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateSecretKey.mockReturnValue(new Uint8Array([9, 9, 9]));
    mocks.parseRelayList.mockReturnValue(["wss://one"]);
    mocks.createNip46NostrConnectUri.mockReturnValue({
      uri: "nostrconnect://uri",
      clientSecretKey: new Uint8Array([1, 1]),
      relays: ["wss://one"],
      pool: { close: vi.fn() },
    });
    mocks.connectNip46WithBunkerInput.mockResolvedValue({ pubkey: "pk-good" });
    mocks.connectNip46WithNostrConnectUri.mockResolvedValue({
      pubkey: "pk-good",
    });
    mocks.parseBunkerInput.mockResolvedValue({
      pubkey: "x",
      relays: ["wss://one"],
    });
    mocks.bunkerCanonicalKey.mockReturnValue("canon");
  });

  it("connectWithBunker marks failed on profile mismatch", async () => {
    mocks.connectNip46WithBunkerInput.mockResolvedValue({ pubkey: "other" });

    await connectWithBunker({
      bunkerInput: " bunker://x ",
      connectionLabel: "Label",
      expectedPubkeyHex: "pk-good",
      getActiveSession: () => null,
      setState,
      setError,
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      parseSecretKeyHex,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });

    expect(setError).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith("failed");
    expect(matchOrCreateSession).not.toHaveBeenCalled();
  });

  it("connectWithBunker completes happy path", async () => {
    await connectWithBunker({
      bunkerInput: " bunker://x ",
      connectionLabel: "Label",
      expectedPubkeyHex: null,
      getActiveSession: () => null,
      setState,
      setError,
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      parseSecretKeyHex,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });

    expect(setActiveSession).toHaveBeenCalledWith("conn-1");
    expect(recordConnectionEvent).toHaveBeenCalledWith("conn-1", {
      type: "connected",
      pubkey: "pk-good",
    });
    expect(setState).toHaveBeenCalledWith("connected");
    expect(onReconnectSuccess).toHaveBeenCalledWith("conn-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("connectWithBunker reuses existing bunker session key when canonical input matches", async () => {
    mocks.parseBunkerInput
      .mockResolvedValueOnce({ pubkey: "x", relays: ["wss://one"] })
      .mockResolvedValueOnce({ pubkey: "x", relays: ["wss://one"] });
    mocks.bunkerCanonicalKey.mockReturnValue("same-canonical");

    await connectWithBunker({
      bunkerInput: "bunker://same",
      connectionLabel: "Label",
      expectedPubkeyHex: null,
      getActiveSession: () =>
        ({
          connection: {
            config: {
              type: "nip46",
              method: "bunker_input",
              bunkerInput: "bunker://same",
              clientSecretKeyHex: "stored-secret",
            },
          },
        }) as unknown as ReturnType<
          Parameters<typeof connectWithBunker>[0]["getActiveSession"]
        >,
      setState,
      setError,
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      parseSecretKeyHex,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });

    expect(parseSecretKeyHex).toHaveBeenCalledWith("stored-secret");
    expect(mocks.generateSecretKey).not.toHaveBeenCalled();
    expect(serializeSecretKey).not.toHaveBeenCalled();
  });

  it("connectWithNostrConnectUri stores pending and handles mismatch", async () => {
    mocks.connectNip46WithNostrConnectUri.mockResolvedValue({
      pubkey: "wrong",
    });

    await connectWithNostrConnectUri({
      relayList: "wss://one",
      connectionLabel: "",
      expectedPubkeyHex: "pk-good",
      getActiveSession: () => null,
      setState,
      setError,
      setNostrConnectUri,
      setCancel,
      currentState: "initial",
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });

    expect(mocks.setPendingReconnect).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith("failed");
    expect(setError).toHaveBeenCalled();
  });

  it("connectWithNostrConnectUri completes happy path and clears pending state", async () => {
    await connectWithNostrConnectUri({
      relayList: "wss://one",
      connectionLabel: "",
      expectedPubkeyHex: null,
      getActiveSession: () => null,
      setState,
      setError,
      setNostrConnectUri,
      setCancel,
      currentState: "initial",
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });

    expect(mocks.clearPendingReconnectStorage).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith("connected");
  });

  it("resumeWithPendingUri returns immediately when nothing pending", async () => {
    await resumeWithPendingUri({
      connectionLabel: "",
      expectedPubkeyHex: null,
      getPendingReconnect: () => null,
      getActiveSession: () => null,
      setState,
      setError,
      setNostrConnectUri,
      setCancel,
      currentState: "waiting",
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });
    expect(setState).not.toHaveBeenCalledWith("failed");
  });

  it("resumeWithPendingUri suppresses transient connection error when still waiting", async () => {
    mocks.connectNip46WithNostrConnectUri.mockRejectedValue(
      new Error("websocket subscription closed")
    );
    const pending = {
      uri: "nostrconnect://uri",
      clientSecretKey: new Uint8Array([1, 1]),
      relays: ["wss://one"],
    };

    await resumeWithPendingUri({
      connectionLabel: "",
      expectedPubkeyHex: null,
      getPendingReconnect: () => pending,
      getActiveSession: () => null,
      setState,
      setError,
      setNostrConnectUri,
      setCancel,
      currentState: "waiting",
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });

    expect(setState).not.toHaveBeenCalledWith("failed");
    expect(setError).not.toHaveBeenCalledWith("websocket subscription closed");
  });

  it("resumeWithPendingUri marks failed and records active-session error for non-connection failures", async () => {
    mocks.connectNip46WithNostrConnectUri.mockRejectedValue(
      new Error("invalid signer response")
    );
    const pending = {
      uri: "nostrconnect://uri",
      clientSecretKey: new Uint8Array([1, 1]),
      relays: ["wss://one"],
    };

    await resumeWithPendingUri({
      connectionLabel: "",
      expectedPubkeyHex: null,
      getPendingReconnect: () => pending,
      getActiveSession: () =>
        ({
          connection: { id: "active-1" },
        }) as unknown as ReturnType<
          Parameters<typeof resumeWithPendingUri>[0]["getActiveSession"]
        >,
      setState,
      setError,
      setNostrConnectUri,
      setCancel,
      currentState: "failed",
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });

    expect(setError).toHaveBeenCalledWith("invalid signer response");
    expect(setState).toHaveBeenCalledWith("failed");
    expect(recordConnectionEvent).toHaveBeenCalledWith("active-1", {
      type: "error",
      error: "invalid signer response",
    });
  });

  it("resumeWithPendingUri fails on pubkey mismatch", async () => {
    const pending = {
      uri: "nostrconnect://uri",
      clientSecretKey: new Uint8Array([1, 1]),
      relays: ["wss://one"],
    };
    mocks.connectNip46WithNostrConnectUri.mockResolvedValue({
      pubkey: "wrong",
    });

    await resumeWithPendingUri({
      connectionLabel: "",
      expectedPubkeyHex: "pk-good",
      getPendingReconnect: () => pending,
      getActiveSession: () => null,
      setState,
      setError,
      setNostrConnectUri,
      setCancel,
      currentState: "waiting",
      matchOrCreateSession,
      setActiveSession,
      updateSession,
      recordConnectionEvent,
      setActiveSignerConfig,
      detectSignerAppName,
      serializeSecretKey,
      syncRelaysAfterReconnect,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
    });

    expect(setError).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith("failed");
    expect(matchOrCreateSession).not.toHaveBeenCalled();
  });
});
