/**
 * @vitest-environment jsdom
 * Unit tests for nostr signer storage (localStorage and in-memory cache).
 * Tests app/features/auth/signer/nostr-signer-storage.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  clearActiveSignerConfig,
  getActiveSignerConfig,
  getCachedConfigJson,
  migrateLegacyActiveSignerConfig,
  persistActiveSignerConfigWithoutReset,
  setActiveSignerConfig,
  setCachedConfigJson,
  type ActiveSignerConfig,
} from "~/features/auth/signer/nostr-signer-storage.client";

describe("nostr-signer-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearActiveSignerConfig();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getActiveSignerConfig / setActiveSignerConfig", () => {
    it("returns null when storage is empty", () => {
      expect(getActiveSignerConfig()).toBeNull();
    });

    it("round-trips nip07 config", () => {
      const config: ActiveSignerConfig = { type: "nip07" };
      setActiveSignerConfig(config);
      expect(getActiveSignerConfig()).toEqual(config);
    });

    it("round-trips nip46 bunker_input config", () => {
      const config: ActiveSignerConfig = {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "bunker+relay",
        clientSecretKeyHex: "ab",
      };
      setActiveSignerConfig(config);
      expect(getActiveSignerConfig()).toEqual(config);
    });

    it("round-trips nip46 nostrconnect_uri config", () => {
      const config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://...",
        clientSecretKeyHex: "ab",
        relays: ["wss://a"],
      };
      setActiveSignerConfig(config);
      expect(getActiveSignerConfig()).toEqual(config);
    });

    it("returns null when stored JSON is invalid", () => {
      localStorage.setItem(STORAGE_KEY, "not json");
      expect(getActiveSignerConfig()).toBeNull();
    });

    it("returns null when getItem throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(getActiveSignerConfig()).toBeNull();
    });
  });

  describe("setActiveSignerConfig catch", () => {
    it("ignores when setItem throws", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage full");
      });
      setActiveSignerConfig({ type: "nip07" });
      expect(getActiveSignerConfig()).toBeNull();
    });
  });

  describe("clearActiveSignerConfig", () => {
    it("removes config from storage and clears in-memory cache", () => {
      setActiveSignerConfig({ type: "nip07" });
      expect(getActiveSignerConfig()).not.toBeNull();
      expect(getCachedConfigJson()).not.toBeNull();

      clearActiveSignerConfig();
      expect(getActiveSignerConfig()).toBeNull();
      expect(getCachedConfigJson()).toBeNull();
    });

    it("ignores when removeItem throws (in-memory cache still cleared)", () => {
      setActiveSignerConfig({ type: "nip07" });
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(() => clearActiveSignerConfig()).not.toThrow();
      expect(getActiveSignerConfig()).not.toBeNull();
    });
  });

  describe("getCachedConfigJson", () => {
    it("returns in-memory cache when set", () => {
      const config: ActiveSignerConfig = { type: "nip07" };
      setActiveSignerConfig(config);
      expect(getCachedConfigJson()).toBe(JSON.stringify(config));
    });

    it("falls back to localStorage when cache is null", () => {
      clearActiveSignerConfig();
      const config: ActiveSignerConfig = { type: "nip07" };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      expect(getCachedConfigJson()).toBe(JSON.stringify(config));
    });

    it("returns null when localStorage getItem throws and cache is null", () => {
      clearActiveSignerConfig();
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(getCachedConfigJson()).toBeNull();
    });
  });

  describe("setCachedConfigJson", () => {
    it("sets in-memory cache without writing to storage", () => {
      const json = '{"type":"nip07"}';
      setCachedConfigJson(json);
      expect(getCachedConfigJson()).toBe(json);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("persistActiveSignerConfigWithoutReset", () => {
    it("writes config to storage via setActiveSignerConfig", () => {
      const config: ActiveSignerConfig = { type: "nip07" };
      persistActiveSignerConfigWithoutReset(config);
      expect(getActiveSignerConfig()).toEqual(config);
    });
  });

  describe("migrateLegacyActiveSignerConfig", () => {
    it("copies legacy v1 sessionStorage value into v2 localStorage when v2 missing", () => {
      const legacy = JSON.stringify({ type: "nip07" });
      sessionStorage.setItem(LEGACY_STORAGE_KEY, legacy);

      migrateLegacyActiveSignerConfig();

      expect(localStorage.getItem(STORAGE_KEY)).toBe(legacy);
      expect(sessionStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    });

    it("does not overwrite an existing v2 value", () => {
      const v2 = JSON.stringify({ type: "nip07" });
      const legacy = JSON.stringify({ type: "nip46" });
      localStorage.setItem(STORAGE_KEY, v2);
      sessionStorage.setItem(LEGACY_STORAGE_KEY, legacy);

      migrateLegacyActiveSignerConfig();

      expect(localStorage.getItem(STORAGE_KEY)).toBe(v2);
      expect(sessionStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    });

    it("is a noop when no legacy value exists", () => {
      expect(() => migrateLegacyActiveSignerConfig()).not.toThrow();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
