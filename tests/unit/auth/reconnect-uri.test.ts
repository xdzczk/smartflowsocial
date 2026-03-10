/**
 * Unit tests for reconnect URI helpers.
 * Tests app/features/auth/reconnect-uri.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/is-standalone-pwa", () => ({
  isStandalonePWA: vi.fn(),
}));

vi.mock("~/features/auth/signer", () => ({
  parseSecretKeyHex: vi.fn(
    (hex: string) => new Uint8Array([parseInt(hex.slice(0, 2), 16)])
  ),
  serializeSecretKey: vi.fn((bytes: Uint8Array) =>
    (bytes[0] ?? 0).toString(16).padStart(2, "0")
  ),
}));

vi.mock("~/features/auth/nostr-signer.client", () => ({
  createNip46NostrConnectUri: vi.fn(),
  getNostrConnectAppMetadata: vi.fn().mockReturnValue({}),
}));

import {
  bunkerCanonicalKey,
  parseRelayList,
  appendPrimalCallback,
  getPendingReconnect,
  setPendingReconnect,
  clearPendingReconnectStorage,
} from "~/features/auth/reconnect-uri.client";
import { isStandalonePWA } from "~/lib/is-standalone-pwa";

describe("reconnect-uri", () => {
  const sessionStore: Record<string, string> = {};
  const sessionStorageMock = {
    getItem: (key: string) => sessionStore[key] ?? null,
    setItem: (key: string, value: string) => {
      sessionStore[key] = value;
    },
    removeItem: (key: string) => {
      delete sessionStore[key];
    },
  };

  beforeEach(() => {
    vi.mocked(isStandalonePWA).mockReturnValue(false);
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
    if (typeof globalThis !== "undefined") {
      (
        globalThis as unknown as { sessionStorage?: typeof sessionStorageMock }
      ).sessionStorage = sessionStorageMock;
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (typeof globalThis !== "undefined") {
      delete (globalThis as unknown as { sessionStorage?: unknown })
        .sessionStorage;
    }
  });

  describe("bunkerCanonicalKey", () => {
    it("normalizes relays to lowercase, trims, wss-only, sorted, deduped", () => {
      const key = bunkerCanonicalKey({
        pubkey: "abc",
        relays: [
          "  WSS://A.com  ",
          "wss://b.com",
          "https://skip.com",
          "wss://a.com",
        ],
        secret: "s1",
      });
      expect(key).toBe("abc\nwss://a.com,wss://b.com\ns1");
    });

    it("uses empty string for null secret", () => {
      const key = bunkerCanonicalKey({
        pubkey: "pk",
        relays: ["wss://r.com"],
        secret: null,
      });
      expect(key).toBe("pk\nwss://r.com\n");
    });
  });

  describe("parseRelayList", () => {
    it("splits by newlines and trims empty", () => {
      expect(parseRelayList("wss://a.com\n  wss://b.com  \n")).toEqual([
        "wss://a.com",
        "wss://b.com",
      ]);
    });

    it("handles CRLF", () => {
      expect(parseRelayList("wss://a.com\r\nwss://b.com")).toEqual([
        "wss://a.com",
        "wss://b.com",
      ]);
    });

    it("filters empty lines", () => {
      expect(parseRelayList("wss://a.com\n\n\nwss://b.com")).toEqual([
        "wss://a.com",
        "wss://b.com",
      ]);
    });

    it("returns empty array for empty string", () => {
      expect(parseRelayList("")).toEqual([]);
    });
  });

  describe("appendPrimalCallback", () => {
    it("returns uri unchanged when isStandalonePWA is true", () => {
      vi.mocked(isStandalonePWA).mockReturnValue(true);
      expect(appendPrimalCallback("nostrconnect://x?relay=wss://a.com")).toBe(
        "nostrconnect://x?relay=wss://a.com"
      );
    });

    it("returns uri unchanged when window is undefined", () => {
      const origWindow = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window?: unknown }).window = undefined;
      vi.mocked(isStandalonePWA).mockReturnValue(false);
      expect(appendPrimalCallback("nostrconnect://x")).toBe("nostrconnect://x");
      (globalThis as unknown as { window?: unknown }).window = origWindow;
    });

    it("returns uri unchanged when uri already has callback=", () => {
      (
        globalThis as unknown as {
          window?: {
            location: { origin: string; pathname: string; search: string };
          };
        }
      ).window = {
        location: { origin: "https://app.com", pathname: "/", search: "" },
      };
      const uri = "nostrconnect://x?callback=already";
      expect(appendPrimalCallback(uri)).toBe(uri);
    });

    it("appends callback with encoded origin+pathname+search when no callback and window exists", () => {
      (
        globalThis as unknown as {
          window?: {
            location: { origin: string; pathname: string; search: string };
          };
        }
      ).window = {
        location: {
          origin: "https://app.com",
          pathname: "/login",
          search: "?foo=1",
        },
      };
      const uri = "nostrconnect://relay";
      const out = appendPrimalCallback(uri);
      expect(out).toBe(
        "nostrconnect://relay?callback=" +
          encodeURIComponent("https://app.com/login?foo=1")
      );
    });

    it("uses & when uri already has ?", () => {
      (
        globalThis as unknown as {
          window?: {
            location: { origin: string; pathname: string; search: string };
          };
        }
      ).window = {
        location: { origin: "https://a.com", pathname: "/", search: "" },
      };
      const uri = "nostrconnect://x?relay=wss://r.com";
      const out = appendPrimalCallback(uri);
      expect(out).toContain("&callback=");
      expect(out).toContain(encodeURIComponent("https://a.com/"));
    });
  });

  describe("getPendingReconnect / setPendingReconnect", () => {
    it("returns null when sessionStorage has no key", () => {
      expect(getPendingReconnect()).toBeNull();
    });

    it("returns null when stored value is invalid JSON", () => {
      sessionStorageMock.setItem(
        "__smartflow_pending_reconnect_nip46_v1",
        "not json"
      );
      expect(getPendingReconnect()).toBeNull();
    });

    it("round-trips: set then get returns same shape", () => {
      const uri = "nostrconnect://x";
      const key = new Uint8Array([0xab, 0xcd]);
      const relays = ["wss://r.com"];
      setPendingReconnect(uri, key, relays);
      const got = getPendingReconnect();
      expect(got).not.toBeNull();
      expect(got!.uri).toBe(uri);
      expect(got!.relays).toEqual(relays);
      expect(got!.clientSecretKey).toBeInstanceOf(Uint8Array);
      expect(Array.from(got!.clientSecretKey)).toEqual([0xab]);
    });
  });

  describe("clearPendingReconnectStorage", () => {
    it("removes key from sessionStorage", () => {
      sessionStorageMock.setItem(
        "__smartflow_pending_reconnect_nip46_v1",
        "{}"
      );
      clearPendingReconnectStorage();
      expect(
        sessionStorageMock.getItem("__smartflow_pending_reconnect_nip46_v1")
      ).toBeNull();
    });
  });
});
