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
  recordSuccessfulSign,
  teardownActiveNip46Signer,
  teardownVisibilityHandler,
} from "~/features/auth/signer/nostr-signer-connection.client";
import type { ActiveSignerConfig } from "~/features/auth/signer/nostr-signer-storage.client";

const { visibilityCleanup } = vi.hoisted(() => ({
  visibilityCleanup: vi.fn(),
}));
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
const mockGetConnectionEstablishedAt = vi.fn<() => number | null>(() => null);
const mockGetLastActivityTime = vi.fn<() => number | null>(() => null);
const mockSetLastActivityTime = vi.fn();
const mockSetCachedSigner = vi.fn();
const mockResetCachedSigner = vi.fn();
const mockGetActiveSignerConfig = vi.fn<() => ActiveSignerConfig | null>(
  () => null
);
const mockIsTransportLikelyHealthy = vi.fn(() => true);
const mockVerifySignerConnection = vi.fn();
const mockCacheNip46SignerFromLoginImpl = vi.fn();
const mockRecordSuccessfulSignImpl = vi.fn();

vi.mock("~/features/auth/signer/connection-cache.client", () => ({
  getCachedSigner: () => mockGetCachedSigner(),
  getConnectionEstablishedAt: () => mockGetConnectionEstablishedAt(),
  getLastActivityTime: () => mockGetLastActivityTime(),
  setLastActivityTime: (t: number | null) => mockSetLastActivityTime(t),
  setCachedSigner: (s: unknown) => mockSetCachedSigner(s),
  resetCachedSigner: () => mockResetCachedSigner(),
  getInFlightSignerPromise: () => inFlightRefs.promise,
  getInFlightSignerConfigJson: () => inFlightRefs.configJson,
  setConnectionEstablishedAt: vi.fn(),
  getLastVisibilityReconnectAt: () => 0,
  setLastVisibilityReconnectAt: vi.fn(),
  setWasHidden: vi.fn(),
  getWasHidden: () => false,
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
}));

vi.mock("~/features/auth/signer/connection-health.client", () => ({
  isTransportLikelyHealthy: () => mockIsTransportLikelyHealthy(),
  verifySignerConnection: (...args: unknown[]) =>
    mockVerifySignerConnection(...args),
  syncRelaysWithRemoteSigner: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-connect.client", () => ({
  createNip46SignerFromStoredConfig: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-resolve.client", () => ({
  resolveNip46SignerFromConfig: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-visibility.client", () => ({
  initVisibilityHandler: () => visibilityCleanup,
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
    mockGetConnectionEstablishedAt.mockReturnValue(null);
    mockGetLastActivityTime.mockReturnValue(null);
    mockIsTransportLikelyHealthy.mockReturnValue(true);
  });

  describe("getActiveSigner", () => {
    it("returns null when no config and no cached signer", async () => {
      const result = await getActiveSigner();
      expect(result).toBeNull();
    });

    it("returns cached signer when transport is healthy", async () => {
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      mockIsTransportLikelyHealthy.mockReturnValue(true);
      const result = await getActiveSigner({ allowReconnect: false });
      expect(result).toBe(mockCachedSigner);
      expect(mockSetLastActivityTime).toHaveBeenCalled();
    });

    it("clears cache and returns null when transport is unhealthy and reconnect disabled", async () => {
      mockGetCachedSigner.mockReturnValue(mockCachedSigner);
      mockIsTransportLikelyHealthy.mockReturnValue(false);
      mockGetActiveSignerConfig.mockReturnValue({
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      });
      const result = await getActiveSigner({ allowReconnect: false });
      expect(result).toBeNull();
      expect(mockResetCachedSigner).toHaveBeenCalled();
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

  describe("teardownVisibilityHandler", () => {
    it("calls cleanup when one was set", () => {
      teardownVisibilityHandler();
      expect(visibilityCleanup).toHaveBeenCalled();
    });
  });

  describe("cacheNip46SignerFromLogin", () => {
    it("delegates to the cache impl", () => {
      const signer = { type: "nip46" };

      cacheNip46SignerFromLogin(signer as never);
      expect(mockCacheNip46SignerFromLoginImpl).toHaveBeenCalledWith(signer);
    });
  });

  describe("recordSuccessfulSign", () => {
    it("delegates to recordSuccessfulSignImpl", () => {
      recordSuccessfulSign();
      expect(mockRecordSuccessfulSignImpl).toHaveBeenCalled();
    });
  });
});
