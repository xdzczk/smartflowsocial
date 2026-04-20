/**
 * Unit tests for auth reconnect flows (Nostr Connect and Bunker).
 * Tests runExistingNostrConnectReconnect, runExistingBunkerReconnect, handleExistingReconnectFailure.
 * These modules are excluded from coverage (*.client.ts); tests run in CI to guard behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth/signer", () => ({
  createNip46SignerFromStoredConfig: vi.fn().mockResolvedValue({
    signer: {
      close: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue(undefined),
    },
    pubkey: "pubkey-hex-123",
  }),
  updateSession: vi.fn(),
  setActiveSignerConfig: vi.fn(),
  cacheNip46SignerFromLogin: vi.fn(),
  resetCachedSigner: vi.fn(),
  recordConnectionEvent: vi.fn(),
  detectSignerAppName: vi.fn().mockReturnValue("Primal"),
  parseSecretKeyHex: vi.fn().mockReturnValue(new Uint8Array(32)),
  getActiveSession: vi.fn().mockReturnValue({
    connection: { id: "conn-1" },
    currentSession: null,
  }),
  attemptPrimarySignerFailover: vi
    .fn()
    .mockResolvedValue({ recovered: false, reason: "no_fallback" }),
}));

vi.mock("~/lib/nostr-conversion", () => ({
  convertToHex: vi.fn((x: string) =>
    x.startsWith("npub") ? "pubkey-hex-123" : x
  ),
}));

vi.mock("~/features/auth/nostr-signer.client", () => ({
  connectNip46WithNostrConnectUri: vi.fn().mockResolvedValue({
    signer: {
      close: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue(undefined),
    },
    pubkey: "pubkey-hex-123",
  }),
}));

vi.mock("~/features/auth/reconnect-dialog-utils.client", () => ({
  buildRelayUnion: vi.fn((stored: string[]) =>
    stored.length > 0 ? stored : ["wss://relay.example.com"]
  ),
  DEFAULT_RELAYS_ARRAY: ["wss://relay.example.com"],
  EXISTING_SESSION_RECONNECT_TIMEOUTS_MS: [100, 200],
  EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS: 10,
  PROFILE_MISMATCH_MESSAGE: "Profile mismatch",
  RELAY_UNION_CAP: 8,
  TOAST_RECONNECT_SUCCESS: "Remote signer reconnected.",
  debugReconnectTrace: vi.fn(),
}));

vi.mock("~/features/auth/reconnect-uri.client", () => ({
  parseBunkerInput: vi.fn().mockResolvedValue({
    pubkey: "pubkey-hex-123",
    relays: ["wss://relay.example.com"],
    secret: null,
  }),
}));

vi.mock("nostr-tools", () => ({
  SimplePool: class MockSimplePool {
    close = vi.fn();
  },
}));

import {
  runExistingBunkerReconnect,
  type RunExistingBunkerReconnectOptions,
} from "~/features/auth/reconnect/reconnect-existing-bunker.client";
import { handleExistingReconnectFailure } from "~/features/auth/reconnect/reconnect-existing-failure.client";
import {
  runExistingNostrConnectReconnect,
  type RunExistingNostrConnectReconnectOptions,
} from "~/features/auth/reconnect/reconnect-existing-nostrconnect.client";

const baseNostrConnectOptions: RunExistingNostrConnectReconnectOptions = {
  connectionView: {
    connection: {
      id: "conn-1",
      label: "",
      config: {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://...",
        relays: ["wss://relay.example.com"],
        clientSecretKeyHex: "ab".repeat(32),
        signerPubkey: "pubkey-hex-123",
      },
      metadata: {
        pubkey: "npub1abc",
        status: "active",
        connectedAt: 0,
        lastActivityAt: 0,
        signerAppName: null,
        relays: [],
        lastError: null,
        createdAt: 0,
        updatedAt: 0,
      },
      currentSessionId: null,
    },
    currentSession: null,
  },
  expectedPubkeyHex: "pubkey-hex-123",
  trigger: "manual_retry",
  runId: 1,
  getIsRunStale: () => false,
  setCancel: vi.fn(),
  setState: vi.fn(),
  setError: vi.fn(),
  setExistingReconnectAttempt: vi.fn(),
  onSuccess: vi.fn(),
};

const baseBunkerOptions: RunExistingBunkerReconnectOptions = {
  connectionView: {
    connection: {
      id: "conn-1",
      label: "",
      config: {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "bunker+nostr://...",
        clientSecretKeyHex: "ab".repeat(32),
      },
      metadata: {
        pubkey: "npub1abc",
        status: "active",
        connectedAt: 0,
        lastActivityAt: 0,
        signerAppName: null,
        relays: [],
        lastError: null,
        createdAt: 0,
        updatedAt: 0,
      },
      currentSessionId: null,
    },
    currentSession: null,
  },
  expectedPubkeyHex: "pubkey-hex-123",
  trigger: "manual_retry",
  runId: 1,
  getIsRunStale: () => false,
  setCancel: vi.fn(),
  setState: vi.fn(),
  setError: vi.fn(),
  setExistingReconnectAttempt: vi.fn(),
  onSuccess: vi.fn(),
};

const defaultSignerWithPing = () => ({
  signer: {
    close: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(undefined),
  },
  pubkey: "pubkey-hex-123",
});

describe("reconnect flows", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createNip46SignerFromStoredConfig } =
      await import("~/features/auth/signer");
    (
      createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
    ).mockResolvedValue(defaultSignerWithPing());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("runExistingNostrConnectReconnect", () => {
    it("calls setState reconnecting_existing then connected and onSuccess on success", async () => {
      const setState = vi.fn();
      const onSuccess = vi.fn();

      await runExistingNostrConnectReconnect({
        ...baseNostrConnectOptions,
        setState,
        onSuccess,
      });

      expect(setState).toHaveBeenCalledWith("reconnecting_existing");
      expect(setState).toHaveBeenCalledWith("connected");
      expect(onSuccess).toHaveBeenCalledWith("conn-1");
    });

    it("calls setError and setState failed when pubkey mismatch", async () => {
      const setState = vi.fn();
      const setError = vi.fn();

      await runExistingNostrConnectReconnect({
        ...baseNostrConnectOptions,
        expectedPubkeyHex: "different-pubkey",
        setState,
        setError,
      });

      expect(setError).toHaveBeenCalledWith("Profile mismatch");
      expect(setState).toHaveBeenCalledWith("failed");
    });

    it("retries with relay union when first attempt fails and second succeeds", async () => {
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer");
      const { buildRelayUnion } =
        await import("~/features/auth/reconnect-dialog-utils.client");
      const setState = vi.fn();
      const setExistingReconnectAttempt = vi.fn();
      const onSuccess = vi.fn();

      (createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockResolvedValueOnce({
          signer: {
            close: vi.fn().mockResolvedValue(undefined),
            ping: vi.fn().mockResolvedValue(undefined),
          },
          pubkey: "pubkey-hex-123",
        });

      await runExistingNostrConnectReconnect({
        ...baseNostrConnectOptions,
        setState,
        setExistingReconnectAttempt,
        onSuccess,
      });

      expect(setExistingReconnectAttempt).toHaveBeenCalledWith(1);
      expect(setExistingReconnectAttempt).toHaveBeenCalledWith(2);
      expect(buildRelayUnion).toHaveBeenCalled();
      expect(setState).toHaveBeenCalledWith("connected");
      expect(onSuccess).toHaveBeenCalledWith("conn-1");
    });

    it("calls resetCachedSigner and setState idle when ping fails after connect", async () => {
      const { createNip46SignerFromStoredConfig, resetCachedSigner } =
        await import("~/features/auth/signer");
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        signer: {
          close: vi.fn().mockResolvedValue(undefined),
          ping: vi.fn().mockRejectedValue(new Error("Ping failed")),
        },
        pubkey: "pubkey-hex-123",
      });

      const setState = vi.fn();
      const setError = vi.fn();

      await runExistingNostrConnectReconnect({
        ...baseNostrConnectOptions,
        setState,
        setError,
      });

      expect(resetCachedSigner).toHaveBeenCalled();
      expect(setError).toHaveBeenCalledWith(
        expect.stringContaining("Connection could not be verified")
      );
      expect(setState).toHaveBeenCalledWith("idle");
    });
  });

  describe("runExistingBunkerReconnect", () => {
    it("calls setState reconnecting_existing then connected and onSuccess on success", async () => {
      const setState = vi.fn();
      const onSuccess = vi.fn();

      await runExistingBunkerReconnect({
        ...baseBunkerOptions,
        setState,
        onSuccess,
      });

      expect(setState).toHaveBeenCalledWith("reconnecting_existing");
      expect(setState).toHaveBeenCalledWith("connected");
      expect(onSuccess).toHaveBeenCalledWith("conn-1");
    });

    it("throws when parseBunkerInput returns null", async () => {
      const { parseBunkerInput } =
        await import("~/features/auth/reconnect-uri.client");
      (parseBunkerInput as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null
      );

      await expect(
        runExistingBunkerReconnect(baseBunkerOptions)
      ).rejects.toThrow("Invalid bunker input");
    });

    it("first attempt fails, second succeeds", async () => {
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer");
      const setState = vi.fn();
      const setExistingReconnectAttempt = vi.fn();
      const onSuccess = vi.fn();

      (createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockResolvedValueOnce({
          signer: {
            close: vi.fn().mockResolvedValue(undefined),
            ping: vi.fn().mockResolvedValue(undefined),
          },
          pubkey: "pubkey-hex-123",
        });

      await runExistingBunkerReconnect({
        ...baseBunkerOptions,
        setState,
        setExistingReconnectAttempt,
        onSuccess,
      });

      expect(setExistingReconnectAttempt).toHaveBeenCalledWith(1);
      expect(setExistingReconnectAttempt).toHaveBeenCalledWith(2);
      expect(setState).toHaveBeenCalledWith("connected");
      expect(onSuccess).toHaveBeenCalledWith("conn-1");
    });

    it("throws when both attempts fail", async () => {
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer");
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error("Connection failed"));

      await expect(
        runExistingBunkerReconnect(baseBunkerOptions)
      ).rejects.toThrow("Connection failed");
    });

    it("closes signer and does not call onSuccess when getIsRunStale returns true after connect", async () => {
      const closeFn = vi.fn().mockResolvedValue(undefined);
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer");
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        signer: { close: closeFn, ping: vi.fn().mockResolvedValue(undefined) },
        pubkey: "pubkey-hex-123",
      });

      const onSuccess = vi.fn();
      await runExistingBunkerReconnect({
        ...baseBunkerOptions,
        getIsRunStale: () => true,
        onSuccess,
      });

      expect(closeFn).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("calls setError and setState failed on pubkey mismatch", async () => {
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer");
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        signer: {
          close: vi.fn().mockResolvedValue(undefined),
          ping: vi.fn().mockResolvedValue(undefined),
        },
        pubkey: "wrong-pubkey",
      });

      const setState = vi.fn();
      const setError = vi.fn();

      await runExistingBunkerReconnect({
        ...baseBunkerOptions,
        expectedPubkeyHex: "pubkey-hex-123",
        setState,
        setError,
      });

      expect(setError).toHaveBeenCalledWith("Profile mismatch");
      expect(setState).toHaveBeenCalledWith("failed");
    });

    it("calls resetCachedSigner and setState idle when ping fails after connect", async () => {
      const { createNip46SignerFromStoredConfig, resetCachedSigner } =
        await import("~/features/auth/signer");
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        signer: {
          close: vi.fn().mockResolvedValue(undefined),
          ping: vi.fn().mockRejectedValue(new Error("Ping failed")),
        },
        pubkey: "pubkey-hex-123",
      });

      const setState = vi.fn();
      const setError = vi.fn();

      await runExistingBunkerReconnect({
        ...baseBunkerOptions,
        setState,
        setError,
      });

      expect(resetCachedSigner).toHaveBeenCalled();
      expect(setError).toHaveBeenCalledWith(
        expect.stringContaining("Connection could not be verified")
      );
      expect(setState).toHaveBeenCalledWith("idle");
    });
  });

  describe("handleExistingReconnectFailure", () => {
    it("calls setState idle and setError when primary failover does not recover", async () => {
      const setState = vi.fn();
      const setError = vi.fn();
      const setExistingReconnectAttempt = vi.fn();

      await handleExistingReconnectFailure({
        error: new Error("Connection closed"),
        runId: 1,
        trigger: "manual_retry",
        getCurrentRunId: () => 1,
        getClosedByExternalReconnect: () => false,
        getWasHiddenDuringExistingReconnect: () => false,
        getForegroundResumeAttemptFailed: () => false,
        setState,
        setError,
        setExistingReconnectAttempt,
        setForegroundResumeAttemptFailed: vi.fn(),
        expectedPubkeyHex: null,
        onOpenChange: vi.fn(),
        toastSuccess: vi.fn(),
        debugTrace: vi.fn(),
      });

      expect(setState).toHaveBeenCalledWith("idle");
      expect(setError).toHaveBeenCalled();
      expect(setExistingReconnectAttempt).toHaveBeenCalledWith(0);
    });

    it("calls toastSuccess and onReconnectSuccess when primary failover recovers", async () => {
      const { attemptPrimarySignerFailover } =
        await import("~/features/auth/signer");
      (
        attemptPrimarySignerFailover as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        recovered: true,
      });

      const setState = vi.fn();
      const toastSuccess = vi.fn();
      const onReconnectSuccess = vi.fn();
      const onOpenChange = vi.fn();

      await handleExistingReconnectFailure({
        error: new Error("Connection closed"),
        runId: 1,
        trigger: "manual_retry",
        getCurrentRunId: () => 1,
        getClosedByExternalReconnect: () => false,
        getWasHiddenDuringExistingReconnect: () => false,
        getForegroundResumeAttemptFailed: () => false,
        setState,
        setError: vi.fn(),
        setExistingReconnectAttempt: vi.fn(),
        setForegroundResumeAttemptFailed: vi.fn(),
        expectedPubkeyHex: null,
        onReconnectSuccess,
        onOpenChange,
        toastSuccess,
        debugTrace: vi.fn(),
      });

      expect(setState).toHaveBeenCalledWith("connected");
      expect(toastSuccess).toHaveBeenCalled();
      expect(onReconnectSuccess).toHaveBeenCalledWith("conn-1");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("returns early when run is stale", async () => {
      const setState = vi.fn();

      await handleExistingReconnectFailure({
        error: new Error("Connection closed"),
        runId: 1,
        trigger: "manual_retry",
        getCurrentRunId: () => 2,
        getClosedByExternalReconnect: () => false,
        getWasHiddenDuringExistingReconnect: () => false,
        getForegroundResumeAttemptFailed: () => false,
        setState,
        setError: vi.fn(),
        setExistingReconnectAttempt: vi.fn(),
        setForegroundResumeAttemptFailed: vi.fn(),
        expectedPubkeyHex: null,
        onOpenChange: vi.fn(),
        toastSuccess: vi.fn(),
        debugTrace: vi.fn(),
      });

      expect(setState).not.toHaveBeenCalled();
    });
  });
});
