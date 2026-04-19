/**
 * @vitest-environment jsdom
 * Unit tests for nostr-signer-connection orchestrator (targeted entry points with mocks).
 * Tests app/features/auth/signer/nostr-signer-connection.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import {
  cacheNip46SignerFromLogin,
  cancelSignerInFlight,
  getActiveSigner,
  markNip46TransportStale,
  teardownActiveNip46Signer,
} from "~/features/auth/signer/nostr-signer-connection.client";
import type { ActiveSignerConfig } from "~/features/auth/signer/nostr-signer-storage.client";

const inFlightRefs = vi.hoisted(() => ({
  promise: null as Promise<unknown> | null,
  configJson: null as string | null,
}));

/** 64-char hex pubkey — required when post-connect steps call getPublicKey → convertToHex */
const MOCK_SIGNER_HEX_PUBKEY = "a".repeat(64);
const mockCachedSigner: NostrSigner = {
  type: "nip46",
  getPublicKey: vi.fn().mockResolvedValue(MOCK_SIGNER_HEX_PUBKEY),
} as unknown as NostrSigner;
const mockGetCachedSigner = vi.fn<() => NostrSigner | null>(() => null);
const mockSetCachedSigner = vi.fn();
const mockResetCachedSigner = vi.fn();
const mockGetActiveSignerConfig = vi.fn<() => ActiveSignerConfig | null>(
  () => null
);
const mockCacheNip46SignerFromLoginImpl = vi.fn();

vi.mock("~/features/auth/signer/connection-cache.client", () => ({
  getCachedSigner: () => mockGetCachedSigner(),
  setCachedSigner: (s: unknown) => mockSetCachedSigner(s),
  resetCachedSigner: () => mockResetCachedSigner(),
  getInFlightSignerPromise: () => inFlightRefs.promise,
  getInFlightSignerConfigJson: () => inFlightRefs.configJson,
  cacheNip46SignerFromLogin: (...args: unknown[]) =>
    mockCacheNip46SignerFromLoginImpl(...args),
  setInFlightSignerConfigJson: (s: string | null) => {
    inFlightRefs.configJson = s;
  },
  setInFlightSignerPromise: (p: Promise<unknown> | null) => {
    inFlightRefs.promise = p;
  },
}));

vi.mock("~/features/auth/signer/connection-health.client", () => ({
  syncRelaysWithRemoteSigner: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-connect.client", () => ({
  createNip46SignerFromStoredConfig: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-resolve.client", () => ({
  resolveNip46SignerFromConfig: vi.fn(),
}));

vi.mock("~/features/auth/signer/nostr-signer-storage.client", () => ({
  getActiveSignerConfig: () => mockGetActiveSignerConfig(),
  persistActiveSignerConfigWithoutReset: vi.fn(),
  setActiveSignerConfig: vi.fn(),
}));

vi.mock("~/features/auth/signer/remote-signer-sessions.client", () => ({
  getActiveConnection: vi.fn(() => null),
  updateSession: vi.fn(),
  detectSignerAppName: vi.fn(() => null),
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

vi.mock("~/features/nostr/shared-pool.client", () => ({
  getSharedPool: vi.fn(() => ({})),
}));

describe("nostr-signer-connection", () => {
  beforeEach(() => {
    // Reset module-level staleness flag so tests don't bleed state.
    // Done BEFORE clearAllMocks so the cancel call's interactions with the
    // mocked cache module don't pollute per-test counters.
    cancelSignerInFlight();
    vi.clearAllMocks();
    (
      mockCachedSigner.getPublicKey as ReturnType<typeof vi.fn>
    ).mockResolvedValue(MOCK_SIGNER_HEX_PUBKEY);
    inFlightRefs.promise = null;
    inFlightRefs.configJson = null;
    mockGetCachedSigner.mockReturnValue(null);
    mockGetActiveSignerConfig.mockReturnValue(null);
  });

  describe("getActiveSigner", () => {
    it("returns null when no config and no cached signer", async () => {
      const result = await getActiveSigner();
      expect(result).toBeNull();
    });

    it("returns the cached signer when allowReconnect is false (probe path)", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      const { resolveNip46SignerFromConfig } =
        await import("~/features/auth/signer/connection-resolve.client");
      const result = await getActiveSigner({ allowReconnect: false });
      expect(result).toBe(mockCachedSigner);
      // Probe path must never trigger a rebuild round-trip.
      expect(resolveNip46SignerFromConfig).not.toHaveBeenCalled();
      expect(mockResetCachedSigner).not.toHaveBeenCalled();
    });

    it("returns cached nip46 signer without rebuilding when transport is not stale", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      const cached = {
        ...mockCachedSigner,
        type: "nip46",
      } as unknown as NostrSigner;
      mockGetCachedSigner.mockReturnValue(cached);

      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer/connection-connect.client");
      const { resolveNip46SignerFromConfig } =
        await import("~/features/auth/signer/connection-resolve.client");

      const result = await getActiveSigner({ allowReconnect: true });

      expect(result).toBe(cached);
      // Happy path: no rebuild, no full resolve.
      expect(createNip46SignerFromStoredConfig).not.toHaveBeenCalled();
      expect(resolveNip46SignerFromConfig).not.toHaveBeenCalled();
      expect(mockSetCachedSigner).not.toHaveBeenCalled();
    });

    it("rebuilds via createNip46SignerFromStoredConfig after markNip46TransportStale", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      const previousClose = vi.fn().mockResolvedValue(undefined);
      const previousSigner = {
        ...mockCachedSigner,
        type: "nip46",
        close: previousClose,
      } as unknown as NostrSigner;
      mockGetCachedSigner.mockReturnValue(previousSigner);

      const freshSigner = {
        type: "nip46",
        getPublicKey: vi.fn().mockResolvedValue(MOCK_SIGNER_HEX_PUBKEY),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as NostrSigner;
      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer/connection-connect.client");
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        signer: freshSigner,
        pubkey: MOCK_SIGNER_HEX_PUBKEY,
      });
      const { resolveNip46SignerFromConfig } =
        await import("~/features/auth/signer/connection-resolve.client");

      // Simulate bfcache resume / long-hidden / explicit error: flip the
      // staleness flag, then ask for the signer.
      markNip46TransportStale("test_bfcache_resume");
      const result = await getActiveSigner({ allowReconnect: true });

      expect(result).toBe(freshSigner);
      expect(createNip46SignerFromStoredConfig).toHaveBeenCalledTimes(1);
      // Silent-rebuild path: the full resolve (with session-metadata side
      // effects) must NOT run when we already have a NIP-46 cached signer.
      expect(resolveNip46SignerFromConfig).not.toHaveBeenCalled();
      expect(mockSetCachedSigner).toHaveBeenCalledWith(freshSigner);
    });

    it("clears the staleness flag after a successful rebuild so the next call reuses the cache", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      const previousSigner = {
        ...mockCachedSigner,
        type: "nip46",
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as NostrSigner;
      const freshSigner = {
        type: "nip46",
        getPublicKey: vi.fn().mockResolvedValue(MOCK_SIGNER_HEX_PUBKEY),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as NostrSigner;

      const { createNip46SignerFromStoredConfig } =
        await import("~/features/auth/signer/connection-connect.client");

      // First call: stale → rebuild.
      mockGetCachedSigner.mockReturnValue(previousSigner);
      (
        createNip46SignerFromStoredConfig as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        signer: freshSigner,
        pubkey: MOCK_SIGNER_HEX_PUBKEY,
      });
      markNip46TransportStale("test");
      await getActiveSigner({ allowReconnect: true });
      expect(createNip46SignerFromStoredConfig).toHaveBeenCalledTimes(1);

      // Second call: cache returns the freshly installed signer; flag is
      // clear → no further rebuild.
      mockGetCachedSigner.mockReturnValue(freshSigner);
      const second = await getActiveSigner({ allowReconnect: true });
      expect(second).toBe(freshSigner);
      expect(createNip46SignerFromStoredConfig).toHaveBeenCalledTimes(1);
    });

    it("returns nip07 signer when config is nip07 and cache empty", async () => {
      const nip07Config: ActiveSignerConfig = { type: "nip07" };
      mockGetActiveSignerConfig.mockReturnValue(nip07Config);
      const result = await getActiveSigner();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("type", "nip07");
      expect(mockSetCachedSigner).toHaveBeenCalledWith(result);
    });

    it("invokes resolveNip46SignerFromConfig when nip46 config is present and no cache", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x?relay=wss://x&secret=s",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
        bunkerPointer: { pubkey: "pk", relays: ["wss://x"], secret: null },
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      const { resolveNip46SignerFromConfig } =
        await import("~/features/auth/signer/connection-resolve.client");
      (
        resolveNip46SignerFromConfig as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockCachedSigner);
      const result = await getActiveSigner({ allowReconnect: true });
      expect(resolveNip46SignerFromConfig).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockCachedSigner);
    });

    it("returns null without invoking resolve when allowReconnect is false and cache is empty", async () => {
      const nip46Config: ActiveSignerConfig = {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      const { resolveNip46SignerFromConfig } =
        await import("~/features/auth/signer/connection-resolve.client");
      const result = await getActiveSigner({ allowReconnect: false });
      expect(result).toBeNull();
      expect(resolveNip46SignerFromConfig).not.toHaveBeenCalled();
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
      const { resolveNip46SignerFromConfig } =
        await import("~/features/auth/signer/connection-resolve.client");
      let resolveConnect: (v: NostrSigner) => void;
      const connectPromise = new Promise<NostrSigner>((r) => {
        resolveConnect = r;
      });
      (
        resolveNip46SignerFromConfig as ReturnType<typeof vi.fn>
      ).mockReturnValue(connectPromise);
      const promise1 = getActiveSigner({ allowReconnect: true });
      const promise2 = getActiveSigner({ allowReconnect: true });
      resolveConnect!(mockCachedSigner);
      const [r1, r2] = await Promise.all([promise1, promise2]);
      expect(r1).toBe(mockCachedSigner);
      expect(r2).toBe(mockCachedSigner);
      expect(resolveNip46SignerFromConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancelSignerInFlight", () => {
    it("closes a cached NIP-46 signer and resets the cache", async () => {
      const close = vi.fn().mockResolvedValue(undefined);
      mockGetCachedSigner.mockReturnValue({
        ...mockCachedSigner,
        type: "nip46",
        close,
      });
      const { cancelSignerInFlight } =
        await import("~/features/auth/signer/nostr-signer-connection.client");
      cancelSignerInFlight();
      // close is fired-and-forgotten; cache reset is the synchronous contract.
      expect(mockResetCachedSigner).toHaveBeenCalledTimes(1);
      // Allow the close microtask to run and verify it was invoked.
      await Promise.resolve();
      expect(close).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when no signer is cached", async () => {
      mockGetCachedSigner.mockReturnValue(null);
      const { cancelSignerInFlight } =
        await import("~/features/auth/signer/nostr-signer-connection.client");
      cancelSignerInFlight();
      // Cache reset still runs (it's safe even with empty cache).
      expect(mockResetCachedSigner).toHaveBeenCalledTimes(1);
    });

    it("does not call close on a NIP-07 cached signer", async () => {
      mockGetCachedSigner.mockReturnValue({
        type: "nip07",
        getPublicKey: vi.fn(),
        signEvent: vi.fn(),
      } as unknown as NostrSigner);
      const { cancelSignerInFlight } =
        await import("~/features/auth/signer/nostr-signer-connection.client");
      cancelSignerInFlight();
      expect(mockResetCachedSigner).toHaveBeenCalledTimes(1);
    });
  });

  describe("teardownActiveNip46Signer", () => {
    it("calls resetCachedSigner when a nip46 signer is cached", () => {
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      mockGetActiveSignerConfig.mockReturnValue({
        type: "nip46" as const,
        method: "bunker_input" as const,
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      });
      teardownActiveNip46Signer();
      expect(mockResetCachedSigner).toHaveBeenCalled();
    });
  });

  describe("cacheNip46SignerFromLogin", () => {
    it("delegates to the cache impl", () => {
      const signer = { type: "nip46" };

      cacheNip46SignerFromLogin(signer as never);
      expect(mockCacheNip46SignerFromLoginImpl).toHaveBeenCalledWith(signer);
    });
  });
});
