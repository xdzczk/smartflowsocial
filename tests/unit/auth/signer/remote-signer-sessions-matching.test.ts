/**
 * Unit tests for remote-signer-sessions-matching (isConfigEquivalent, findMatchingConnectionForConfig, matchOrCreateConnection).
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { ActiveSignerConfig } from "~/features/auth/signer/nostr-signer-storage.client";
import {
  findMatchingConnectionForConfig,
  isConfigEquivalent,
  matchOrCreateConnection,
  normalizePubkeyHex,
  normalizeUriForIdentity,
} from "~/features/auth/signer/remote-signer-sessions-matching.client";
import {
  createConnection,
  getAllConnections,
  getConnectionById,
  removeConnection,
  setCurrentUserNpub,
  updateConnection,
} from "~/features/auth/signer/remote-signer-sessions.client";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function nostrConnectConfig(
  uri: string,
  clientSecretKeyHex: string
): ActiveSignerConfig {
  return {
    type: "nip46",
    method: "nostrconnect_uri",
    uri,
    relays: ["wss://relay.primal.net"],
    clientSecretKeyHex,
  };
}

function bunkerConfig(
  bunkerInput: string,
  clientSecretKeyHex: string
): ActiveSignerConfig {
  return {
    type: "nip46",
    method: "bunker_input",
    bunkerInput,
    clientSecretKeyHex,
  };
}

describe("remote-signer-sessions-matching", () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorage,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: sessionStorage,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
      },
    });
    setCurrentUserNpub(null);
  });

  describe("normalizePubkeyHex", () => {
    it("returns lowercase hex for valid 64-char hex", () => {
      expect(normalizePubkeyHex("A".repeat(64))).toBe("a".repeat(64));
      expect(normalizePubkeyHex("  " + "b".repeat(64) + "  ")).toBe(
        "b".repeat(64)
      );
    });
    it("returns null for empty or invalid", () => {
      expect(normalizePubkeyHex(null)).toBeNull();
      expect(normalizePubkeyHex("")).toBeNull();
      expect(normalizePubkeyHex("short")).toBeNull();
    });
  });

  describe("normalizeUriForIdentity", () => {
    it("strips callback param and normalizes query order", () => {
      const uri = "https://app.primal.net/connect?callback=x&relay=wss://a";
      const out = normalizeUriForIdentity(uri);
      expect(out).not.toContain("callback");
      expect(out).toContain("relay");
    });
  });

  describe("isConfigEquivalent", () => {
    it("returns true for same nostrconnect_uri (normalized)", () => {
      const a = nostrConnectConfig(
        "nostrconnect://client?relay=wss://a&secret=s",
        "ab"
      );
      const b = nostrConnectConfig(
        "nostrconnect://client?secret=s&relay=wss://a",
        "ab"
      );
      expect(isConfigEquivalent(a, b)).toBe(true);
    });
    it("returns false for different nostrconnect_uri", () => {
      const a = nostrConnectConfig(
        "nostrconnect://client1?relay=wss://a",
        "ab"
      );
      const b = nostrConnectConfig(
        "nostrconnect://client2?relay=wss://a",
        "ab"
      );
      expect(isConfigEquivalent(a, b)).toBe(false);
    });
    it("returns true for same bunker_input and secret", () => {
      const a = bunkerConfig("https://bunker.primal.net/x", "ab");
      const b = bunkerConfig("https://bunker.primal.net/x", "ab");
      expect(isConfigEquivalent(a, b)).toBe(true);
    });
    it("returns false for different bunker_input", () => {
      const a = bunkerConfig("https://bunker.a.net/x", "ab");
      const b = bunkerConfig("https://bunker.b.net/x", "ab");
      expect(isConfigEquivalent(a, b)).toBe(false);
    });
  });

  describe("findMatchingConnectionForConfig", () => {
    it("returns connection matching by signerPubkey when provided", () => {
      const pubkey = "a".repeat(64);
      const conn = createConnection(
        nostrConnectConfig("nostrconnect://c1?relay=wss://a", "11"),
        "First"
      );
      updateConnection(conn.id, {
        metadata: {
          ...conn.metadata,
          pubkey,
          updatedAt: Date.now(),
        },
      });
      const found = findMatchingConnectionForConfig(
        nostrConnectConfig("nostrconnect://c2?relay=wss://b", "22"),
        pubkey
      );
      expect(found?.id).toBe(conn.id);
    });
    it("returns connection matching by config when no signerPubkey", () => {
      const config = nostrConnectConfig(
        "nostrconnect://same?relay=wss://a",
        "ab"
      );
      const conn = createConnection(config, "Label");
      const found = findMatchingConnectionForConfig(config);
      expect(found?.id).toBe(conn.id);
    });
  });

  describe("matchOrCreateConnection", () => {
    it("updates label/config when equivalent config exists", () => {
      // Clear any connections from previous tests so we have a single connection
      getAllConnections().forEach((c) => removeConnection(c.id));
      const config = nostrConnectConfig(
        "nostrconnect://same?relay=wss://a",
        "ab"
      );
      const existing = createConnection(config, "Old label");
      const result = matchOrCreateConnection(config, {
        label: "New label",
      });
      expect(result.id).toBe(existing.id);
      expect(result.label).toBe("New label");
      expect(getConnectionById(existing.id)?.label).toBe("New label");
    });
    it("creates new connection when no equivalent exists", () => {
      const before = getAllConnections().length;
      const config = nostrConnectConfig(
        "nostrconnect://unique?relay=wss://x",
        "cc"
      );
      const result = matchOrCreateConnection(config, {
        label: "New connection",
      });
      expect(result.id).toBeDefined();
      expect(getAllConnections().length).toBe(before + 1);
      expect(getConnectionById(result.id)?.label).toBe("New connection");
    });
  });
});
