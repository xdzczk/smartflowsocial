/**
 * @vitest-environment jsdom
 * Unit tests for nostr-signer-connection orchestrator (targeted entry points with mocks).
 * Tests app/features/auth/signer/nostr-signer-connection.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import {
  cacheNip46SignerFromLogin,
  getActiveSigner,
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

describe("nostr-signer-connection", () => {
  beforeEach(() => {
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

    it("returns the cached signer without consulting transport health", async () => {
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      const result = await getActiveSigner({ allowReconnect: false });
      expect(result).toBe(mockCachedSigner);
      expect(mockResetCachedSigner).not.toHaveBeenCalled();
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
