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

const mockCachedSigner: NostrSigner = {
  type: "nip46",
  getPublicKey: vi.fn(),
} as unknown as NostrSigner;
const mockGetCachedSigner = vi.fn<() => NostrSigner | null>(() => null);
const mockGetConnectionEstablishedAt = vi.fn<() => number | null>(() => null);
const mockGetLastVerificationTime = vi.fn(() => null);
const mockGetLastActivityTime = vi.fn(() => null);
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
  setLastActivityTime: (t: number) => mockSetLastActivityTime(t),
  setCachedSigner: (s: unknown) => mockSetCachedSigner(s),
  resetCachedSigner: () => mockResetCachedSigner(),
  getInFlightSignerPromise: () => null,
  getInFlightSignerConfigJson: () => null,
  getSignerResolutionRequestId: () => 0,
  incrementSignerResolutionRequestId: () => 0,
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
  setInFlightSignerConfigJson: vi.fn(),
  setInFlightSignerPromise: vi.fn(),
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
