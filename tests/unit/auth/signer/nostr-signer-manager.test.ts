/**
 * Unit tests for nostr-signer-manager (setActiveSignerConfig, clearActiveSignerConfig, getActiveSignerConfig, getActiveSignerPubkeyHint).
 * Tests app/features/auth/signer/nostr-signer-manager.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

let mockConfig: unknown = null;
const mockSetStorage = vi.fn();
const mockClearStorage = vi.fn();
const mockGetStorage = vi.fn(() => mockConfig);

vi.mock("~/features/auth/signer/nostr-signer-storage.client", () => ({
  getActiveSignerConfig: () => mockGetStorage(),
  setActiveSignerConfig: (c: unknown) => mockSetStorage(c),
  clearActiveSignerConfig: () => mockClearStorage(),
  STORAGE_KEY: "test-key",
}));

vi.mock("~/features/auth/signer/nostr-signer-connection.client", () => ({
  getActiveSigner: vi.fn(),
  resetCachedSigner: vi.fn(),
  cacheNip46SignerFromLogin: vi.fn(),
  cancelSignerInFlight: vi.fn(),
  createNip46SignerFromStoredConfig: vi.fn(),
  teardownActiveNip46Signer: vi.fn(),
  NOSTR_CONNECTION_HEALTHY_EVENT: "nostr-connection-healthy",
  NOSTR_CONNECTION_STALE_EVENT: "nostr-connection-stale",
}));

vi.mock("~/features/auth/signer/connection-cache.client", () => ({
  getCachedSigner: vi.fn(),
  setCachedSigner: vi.fn(),
  resetCachedSigner: vi.fn(),
}));

vi.mock("nostr-tools", () => ({
  getPublicKey: vi.fn((sk: Uint8Array) => Promise.resolve("pk-" + sk.length)),
}));

import { getActiveSigner as getActiveSignerFromConnection } from "~/features/auth/signer/nostr-signer-connection.client";
import {
  getActiveSignerConfig,
  setActiveSignerConfig,
  clearActiveSignerConfig,
  getActiveSignerPubkeyHint,
  getWindowNostrLikeSigner,
} from "~/features/auth/signer/nostr-signer-manager.client";

describe("nostr-signer-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = null;
  });

  describe("getActiveSignerConfig", () => {
    it("returns value from storage", () => {
      const config = { type: "nip46", method: "bunker_input" as const };
      mockConfig = config;
      expect(getActiveSignerConfig()).toBe(config);
    });

    it("returns null when storage has no config", () => {
      mockConfig = null;
      expect(getActiveSignerConfig()).toBeNull();
    });
  });

  describe("setActiveSignerConfig", () => {
    it("calls storage set", () => {
      const config = {
        type: "nip46" as const,
        method: "bunker_input" as const,
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      };
      setActiveSignerConfig(config);
      expect(mockSetStorage).toHaveBeenCalledWith(config);
    });
  });

  describe("clearActiveSignerConfig", () => {
    it("calls storage clear", () => {
      clearActiveSignerConfig();
      expect(mockClearStorage).toHaveBeenCalled();
    });
  });

  describe("getActiveSignerPubkeyHint", () => {
    it("returns null when no config", async () => {
      mockConfig = null;
      expect(await getActiveSignerPubkeyHint()).toBeNull();
    });

    it("returns null for nip07 config", async () => {
      mockConfig = { type: "nip07" };
      expect(await getActiveSignerPubkeyHint()).toBeNull();
    });

    it("returns pubkey hint for nip46 config when getPublicKey succeeds", async () => {
      mockConfig = {
        type: "nip46",
        method: "bunker_input" as const,
        clientSecretKeyHex: "ab",
      };
      const hint = await getActiveSignerPubkeyHint();
      expect(hint).toBeDefined();
      expect(typeof hint).toBe("string");
    });
  });

  describe("getWindowNostrLikeSigner", () => {
    it("returns signer wrapper when getActiveSigner returns signer", async () => {
      const mockSigner = {
        getPublicKey: vi.fn().mockResolvedValue("pk"),
        signEvent: vi.fn().mockResolvedValue({ sig: "sig" }),
      };
      vi.mocked(getActiveSignerFromConnection).mockResolvedValue(
        mockSigner as never
      );
      const result = await getWindowNostrLikeSigner();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("getPublicKey");
      expect(result).toHaveProperty("signEvent");
      expect(await result!.getPublicKey()).toBe("pk");
    });

    it("returns null when getActiveSigner returns null and no window.nostr", async () => {
      vi.mocked(getActiveSignerFromConnection).mockResolvedValue(null);
      const result = await getWindowNostrLikeSigner();
      expect(result).toBeNull();
    });
  });
});
