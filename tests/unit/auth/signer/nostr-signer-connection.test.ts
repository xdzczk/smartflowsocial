/**
 * @vitest-environment jsdom
 * Unit tests for nostr-signer-connection orchestrator (targeted entry points with mocks).
 * Tests app/features/auth/signer/nostr-signer-connection.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import {
  getActiveSigner,
  teardownActiveNip46Signer,
  teardownVisibilityHandler,
  cacheNip46SignerFromLogin,
  recordSuccessfulSign,
} from "~/features/auth/signer/nostr-signer-connection.client";
import type { ActiveSignerConfig } from "~/features/auth/signer/nostr-signer-storage.client";

const { visibilityCleanup } = vi.hoisted(() => ({
  visibilityCleanup: vi.fn(),
}));
const inFlightRefs = vi.hoisted(() => ({
  promise: null as Promise<unknown> | null,
  configJson: null as string | null,
}));
const requestIdRef = vi.hoisted(() => ({ current: 0 }));

const mockCachedSigner: NostrSigner = {
  type: "nip46",
  getPublicKey: vi.fn(),
} as unknown as NostrSigner;
const mockGetCachedSigner = vi.fn<() => NostrSigner | null>(() => null);
const mockGetConnectionEstablishedAt = vi.fn<() => number | null>(() => null);
const mockGetLastVerificationTime = vi.fn<() => number | null>(() => null);
const mockGetLastActivityTime = vi.fn<() => number | null>(() => null);
const mockGetNeedsReprobe = vi.fn(() => false);
const mockSetLastActivityTime = vi.fn();
const mockSetCachedSigner = vi.fn();
const mockResetCachedSigner = vi.fn();
const mockGetActiveSignerConfig = vi.fn<() => ActiveSignerConfig | null>(
  () => null
);
const mockVerifySignerConnection = vi.fn();
const mockStartHealthCheckMonitoring = vi.fn();
const mockStopHealthCheckMonitoring = vi.fn();
const mockCacheNip46SignerFromLoginImpl = vi.fn();
const mockRecordSuccessfulSignImpl = vi.fn();

vi.mock("~/features/auth/signer/connection-cache.client", () => ({
  getCachedSigner: () => mockGetCachedSigner(),
  getConnectionEstablishedAt: () => mockGetConnectionEstablishedAt(),
  getLastVerificationTime: () => mockGetLastVerificationTime(),
  getLastActivityTime: () => mockGetLastActivityTime(),
  getNeedsReprobe: () => mockGetNeedsReprobe(),
  setLastActivityTime: (t: number | null) => mockSetLastActivityTime(t),
  setCachedSigner: (s: unknown) => mockSetCachedSigner(s),
  resetCachedSigner: () => mockResetCachedSigner(),
  getInFlightSignerPromise: () => inFlightRefs.promise,
  getInFlightSignerConfigJson: () => inFlightRefs.configJson,
  getSignerResolutionRequestId: () => requestIdRef.current,
  incrementSignerResolutionRequestId: () => ++requestIdRef.current,
  getSignerGeneration: () => 0,
  getConnectionCooldownUntil: () => 0,
  setConnectionEstablishedAt: vi.fn(),
  setLastVerificationTime: vi.fn(),
  getLastVisibilityReconnectAt: () => 0,
  setLastVisibilityReconnectAt: vi.fn(),
  setTeardownInProgress: vi.fn(),
  getTeardownInProgress: () => false,
  setWasHidden: vi.fn(),
  getWasHidden: () => false,
  setNeedsReprobe: vi.fn(),
  incrementSignerGeneration: vi.fn(),
  recordSuccessfulSign: (...args: unknown[]) =>
    mockRecordSuccessfulSignImpl(...args),
  cacheNip46SignerFromLogin: (...args: unknown[]) =>
    mockCacheNip46SignerFromLoginImpl(...args),
  setInFlightSignerConfigJson: (s: string | null) => {
    inFlightRefs.configJson = s;
  },
  setInFlightSignerPromise: (p: Promise<unknown> | null) => {
    inFlightRefs.promise = p;
  },
  setConnectionCooldownUntil: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-health.client", () => ({
  verifySignerConnection: (...args: unknown[]) =>
    mockVerifySignerConnection(...args),
  startHealthCheckMonitoring: () => mockStartHealthCheckMonitoring(),
  stopHealthCheckMonitoring: () => mockStopHealthCheckMonitoring(),
  syncRelaysWithRemoteSigner: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-connect.client", () => ({
  createNip46SignerFromStoredConfig: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-visibility.client", () => ({
  initVisibilityHandler: () => visibilityCleanup,
}));

vi.mock("~/features/auth/signer/nostr-signer-storage.client", () => ({
  getActiveSignerConfig: () => mockGetActiveSignerConfig(),
  persistActiveSignerConfigWithoutReset: vi.fn(),
}));

vi.mock("~/features/auth/signer/remote-signer-sessions.client", () => ({
  getActiveConnection: vi.fn(() => null),
  updateSession: vi.fn(),
}));

vi.mock("~/features/auth/signer/remote-signer-status.client", () => ({
  recordConnectionEvent: vi.fn(),
}));

vi.mock("~/features/auth/nostr-signer.client", () => ({
  Nip07Signer: vi.fn().mockImplementation(function (this: unknown) {
    return { type: "nip07", _: this };
  }),
  Nip46Signer: vi.fn(),
}));

vi.mock("~/features/auth/signer/nostr-signer-keys.client", () => ({
  hexToBytes: (hex: string) => new Uint8Array(hex.length >> 1),
}));

describe("nostr-signer-connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inFlightRefs.promise = null;
    inFlightRefs.configJson = null;
    requestIdRef.current = 0;
    mockGetCachedSigner.mockReturnValue(null);
    mockGetActiveSignerConfig.mockReturnValue(null);
    mockGetConnectionEstablishedAt.mockReturnValue(null);
    mockGetLastVerificationTime.mockReturnValue(null);
    mockGetLastActivityTime.mockReturnValue(null);
    mockGetNeedsReprobe.mockReturnValue(false);
  });

  describe("getActiveSigner", () => {
    it("returns null when no config and no cached signer", async () => {
      const result = await getActiveSigner();
      expect(result).toBeNull();
    });

    it("returns cached signer when cache is fresh (no verify path)", async () => {
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      mockGetConnectionEstablishedAt.mockReturnValue(Date.now() - 1000);
      const result = await getActiveSigner({ allowReconnect: false });
      expect(result).toBe(mockCachedSigner);
      expect(mockVerifySignerConnection).not.toHaveBeenCalled();
      expect(mockSetLastActivityTime).toHaveBeenCalled();
    });

    it("returns nip07 signer when config is nip07 and cache empty", async () => {
      const nip07Config: ActiveSignerConfig = { type: "nip07" };
      mockGetActiveSignerConfig
        .mockReturnValueOnce(nip07Config)
        .mockReturnValueOnce(nip07Config);
      const result = await getActiveSigner();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("type", "nip07");
      expect(mockSetCachedSigner).toHaveBeenCalledWith(result);
    });

    it("does not return cached signer when verification fails (stale connection)", async () => {
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      mockGetConnectionEstablishedAt.mockReturnValue(
        Date.now() - 20 * 60 * 1000
      );
      mockGetLastVerificationTime.mockReturnValue(Date.now() - 15 * 60 * 1000);
      mockGetLastActivityTime.mockReturnValue(Date.now() - 15 * 60 * 1000);
      mockVerifySignerConnection.mockResolvedValue(false);
      mockGetActiveSignerConfig.mockReturnValue({
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x?relay=wss://x&secret=s",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
      });
      const result = await getActiveSigner({ allowReconnect: false });
      expect(mockVerifySignerConnection).toHaveBeenCalled();
      expect(result).toBeNull();
      expect(mockResetCachedSigner).toHaveBeenCalled();
    });

    it("clears cached signer when needsReprobe is true and verification fails", async () => {
      mockGetNeedsReprobe.mockReturnValue(true);
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      mockGetConnectionEstablishedAt.mockReturnValue(
        Date.now() - 20 * 60 * 1000
      );
      mockGetLastVerificationTime.mockReturnValue(Date.now() - 15 * 60 * 1000);
      mockGetLastActivityTime.mockReturnValue(Date.now() - 15 * 60 * 1000);
      mockVerifySignerConnection.mockResolvedValue(false);
      mockGetActiveSignerConfig.mockReturnValue({
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x?relay=wss://x&secret=s",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
      });
      const result = await getActiveSigner({ allowReconnect: false });
      expect(mockResetCachedSigner).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("rejects when reconnect succeeds but probe-after-resume (verifySignerConnection) fails", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x?relay=wss://x&secret=s",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
        bunkerPointer: { pubkey: "pk", relays: ["wss://x"], secret: null },
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      mockGetNeedsReprobe.mockReturnValue(true);
      mockGetCachedSigner
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValue(mockCachedSigner);
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer/connection-connect.client");
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        signer: mockCachedSigner,
        pubkey: "pk",
      });
      const { getActiveConnection } =
        await import("~/features/auth/signer/remote-signer-sessions.client");
      (getActiveConnection as ReturnType<typeof vi.fn>).mockReturnValue({
        id: "conn-1",
        config: nip46Config,
        metadata: {},
      });
      mockVerifySignerConnection.mockResolvedValue(false);

      const { RemoteSignerTimeoutError } = await import("~/lib/errors");
      await expect(getActiveSigner({ allowReconnect: true })).rejects.toThrow(
        RemoteSignerTimeoutError
      );
    });

    it("returns null and does not overwrite cache when config changes while connect is in flight", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x?relay=wss://x&secret=s",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
        bunkerPointer: { pubkey: "pk", relays: ["wss://x"], secret: null },
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      mockGetCachedSigner.mockReturnValue(null);
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer/connection-connect.client");
      let resolveConnect!: (v: { signer: NostrSigner; pubkey: string }) => void;
      const connectPromise = new Promise<{
        signer: NostrSigner;
        pubkey: string;
      }>((r) => {
        resolveConnect = r;
      });
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockReturnValue(connectPromise);
      const { getActiveConnection } =
        await import("~/features/auth/signer/remote-signer-sessions.client");
      (getActiveConnection as ReturnType<typeof vi.fn>).mockReturnValue({
        id: "conn-1",
        config: nip46Config,
        metadata: {},
      });

      const resultPromise = getActiveSigner({ allowReconnect: true });
      mockGetActiveSignerConfig.mockReturnValue(null);
      const signerWithClose = {
        ...mockCachedSigner,
        close: vi.fn().mockResolvedValue(undefined),
      };
      resolveConnect({
        signer: signerWithClose,
        pubkey: "pk",
      });
      const result = await resultPromise;
      expect(result).toBeNull();
      expect(mockSetCachedSigner).not.toHaveBeenCalled();
    });

    it("deduplicates concurrent getActiveSigner calls with same config", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x?relay=wss://x&secret=s",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
        bunkerPointer: { pubkey: "pk", relays: ["wss://x"], secret: null },
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      mockGetCachedSigner
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValue(mockCachedSigner);
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer/connection-connect.client");
      let resolveConnect: (v: { signer: NostrSigner; pubkey: string }) => void;
      const connectPromise = new Promise<{
        signer: NostrSigner;
        pubkey: string;
      }>((r) => {
        resolveConnect = r;
      });
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockReturnValue(connectPromise);
      const { getActiveConnection } =
        await import("~/features/auth/signer/remote-signer-sessions.client");
      (getActiveConnection as ReturnType<typeof vi.fn>).mockReturnValue({
        id: "conn-1",
        config: nip46Config,
        metadata: {},
      });
      const promise1 = getActiveSigner({ allowReconnect: true });
      const promise2 = getActiveSigner({ allowReconnect: true });
      resolveConnect!({
        signer: mockCachedSigner,
        pubkey: "pk",
      });
      const [r1, r2] = await Promise.all([promise1, promise2]);
      expect(r1).toBe(mockCachedSigner);
      expect(r2).toBe(mockCachedSigner);
      expect(createNip46SignerFromStoredConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe("tryBackgroundReconnect", () => {
    it("returns false and does not cache signer when no active connection", async () => {
      const { tryBackgroundReconnect } =
        await import("~/features/auth/signer/nostr-signer-connection.client");
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x?relay=wss://x&secret=s",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      const { getActiveConnection } =
        await import("~/features/auth/signer/remote-signer-sessions.client");
      (getActiveConnection as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const result = await tryBackgroundReconnect();
      expect(result).toBe(false);
      expect(mockSetCachedSigner).not.toHaveBeenCalled();
    });

    it("returns false when getActiveSignerConfig is null", async () => {
      const { tryBackgroundReconnect } =
        await import("~/features/auth/signer/nostr-signer-connection.client");
      mockGetActiveSignerConfig.mockReturnValue(null);
      const result = await tryBackgroundReconnect();
      expect(result).toBe(false);
      expect(mockSetCachedSigner).not.toHaveBeenCalled();
    });
  });

  describe("teardownActiveNip46Signer", () => {
    it("calls resetCachedSigner and stopHealthCheckMonitoring when nip46 cached", () => {
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      mockGetActiveSignerConfig.mockReturnValue({
        type: "nip46" as const,
        method: "bunker_input" as const,
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      });
      teardownActiveNip46Signer();
      expect(mockResetCachedSigner).toHaveBeenCalled();
      expect(mockStopHealthCheckMonitoring).toHaveBeenCalled();
    });
  });

  describe("teardownVisibilityHandler", () => {
    it("calls cleanup when one was set", () => {
      teardownVisibilityHandler();
      expect(visibilityCleanup).toHaveBeenCalled();
    });
  });

  describe("cacheNip46SignerFromLogin", () => {
    it("delegates to cache impl with startHealthCheckMonitoring", () => {
      const signer = { type: "nip46" };

      cacheNip46SignerFromLogin(signer as never);
      expect(mockCacheNip46SignerFromLoginImpl).toHaveBeenCalledWith(
        signer,
        expect.any(Function)
      );
    });
  });

  describe("recordSuccessfulSign", () => {
    it("delegates to recordSuccessfulSignImpl", () => {
      recordSuccessfulSign();
      expect(mockRecordSuccessfulSignImpl).toHaveBeenCalled();
    });
  });
});
