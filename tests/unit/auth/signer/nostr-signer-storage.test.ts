/**
 * @vitest-environment jsdom
 * Unit tests for nostr signer storage (sessionStorage and in-memory cache).
 * Tests app/features/auth/signer/nostr-signer-storage.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORAGE_KEY,
  clearActiveSignerConfig,
  getActiveSignerConfig,
  getCachedConfigJson,
  persistActiveSignerConfigWithoutReset,
  setActiveSignerConfig,
  setCachedConfigJson,
  type ActiveSignerConfig,
} from "~/features/auth/signer/nostr-signer-storage.client";

describe("nostr-signer-storage", () => {
  beforeEach(() => {
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
      sessionStorage.setItem(STORAGE_KEY, "not json");
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

    it("falls back to sessionStorage when cache is null", () => {
      clearActiveSignerConfig();
      const config: ActiveSignerConfig = { type: "nip07" };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      expect(getCachedConfigJson()).toBe(JSON.stringify(config));
    });

    it("returns null when sessionStorage getItem throws and cache is null", () => {
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
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("persistActiveSignerConfigWithoutReset", () => {
    it("writes config to storage via setActiveSignerConfig", () => {
      const config: ActiveSignerConfig = { type: "nip07" };
      persistActiveSignerConfigWithoutReset(config);
      expect(getActiveSignerConfig()).toEqual(config);
    });
  });
});
