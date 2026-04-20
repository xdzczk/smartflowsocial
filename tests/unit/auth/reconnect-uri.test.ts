/**
 * Unit tests for reconnect URI helpers.
 * Tests app/features/auth/reconnect-uri.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/is-standalone-pwa", () => ({
  isStandalonePWA: vi.fn(),
}));

// Mock both the barrel re-export and the underlying leaf module so the
// truncating fakes apply no matter which import path consumers use. The
// pending-NIP-46 storage helper imports directly from the leaf to avoid
// pulling in the whole signer barrel (which would risk a cycle with
// bootstrap), so without this second mock the real (full-length) hex
// codec runs and the round-trip assertion below sees both bytes back.
//
// Factories are inlined (not hoisted-out variables) because `vi.mock`
// is hoisted to the top of the file and any module-scope const refs
// would not yet be initialised when the factory runs.
vi.mock("~/features/auth/signer", () => ({
  parseSecretKeyHex: vi.fn(
    (hex: string) => new Uint8Array([parseInt(hex.slice(0, 2), 16)])
  ),
  serializeSecretKey: vi.fn((bytes: Uint8Array) =>
    (bytes[0] ?? 0).toString(16).padStart(2, "0")
  ),
}));

vi.mock("~/features/auth/signer/nostr-signer-manager.client", () => ({
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
  SIGNER_CALLBACK_PATH,
} from "~/features/auth/reconnect-uri.client";
import { isStandalonePWA } from "~/lib/is-standalone-pwa";

describe("reconnect-uri", () => {
  const sessionStore: Record<string, string> = {};
  const localStore: Record<string, string> = {};
  const makeStorageMock = (store: Record<string, string>) => ({
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  });
  const sessionStorageMock = makeStorageMock(sessionStore);
  const localStorageMock = makeStorageMock(localStore);

  beforeEach(() => {
    vi.mocked(isStandalonePWA).mockReturnValue(false);
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
    Object.keys(localStore).forEach((k) => delete localStore[k]);
    if (typeof globalThis !== "undefined") {
      (
        globalThis as unknown as { sessionStorage?: typeof sessionStorageMock }
      ).sessionStorage = sessionStorageMock;
      (
        globalThis as unknown as { localStorage?: typeof localStorageMock }
      ).localStorage = localStorageMock;
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (typeof globalThis !== "undefined") {
      delete (globalThis as unknown as { sessionStorage?: unknown })
        .sessionStorage;
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
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

    it("appends callback pinned to the dedicated signer-callback route — never the current page URL — so iOS Safari opens a new tab instead of refocusing the sign-in tab", () => {
      // The current page URL deliberately includes pathname + search to
      // catch any regression that interpolates `window.location.{pathname,
      // search}` back into the callback. The callback URL must NOT match
      // the originating tab's URL — see SIGNER_CALLBACK_PATH for the
      // WebKit / NIP-46 reply-frame race rationale.
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
      const expectedCallback = `https://app.com${SIGNER_CALLBACK_PATH}`;
      expect(out).toBe(
        `nostrconnect://relay?callback=${encodeURIComponent(expectedCallback)}`
      );
      // Defense-in-depth: the originating URL must not appear in the
      // callback at all, even URI-encoded.
      expect(out).not.toContain(encodeURIComponent("/login"));
      expect(out).not.toContain(encodeURIComponent("?foo=1"));
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
      expect(out).toContain(
        encodeURIComponent(`https://a.com${SIGNER_CALLBACK_PATH}`)
      );
    });
  });

  describe("getPendingReconnect / setPendingReconnect", () => {
    it("returns null when neither storage has the key", () => {
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

    it("writes to localStorage as the durable primary store", () => {
      const uri = "nostrconnect://primal";
      const key = new Uint8Array([0x42]);
      const relays = ["wss://relay.example"];
      setPendingReconnect(uri, key, relays);
      const raw = localStorageMock.getItem(
        "__smartflow_pending_reconnect_nip46_v1"
      );
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as { uri: string; expiresAt: number };
      expect(parsed.uri).toBe(uri);
      expect(parsed.expiresAt).toBeGreaterThan(Date.now());
    });

    it("recovers from sessionStorage when localStorage is wiped (iOS Safari deep-link case)", () => {
      const uri = "nostrconnect://x";
      const key = new Uint8Array([0xab]);
      setPendingReconnect(uri, key, ["wss://r.com"]);
      Object.keys(localStore).forEach((k) => delete localStore[k]);
      const got = getPendingReconnect();
      expect(got).not.toBeNull();
      expect(got!.uri).toBe(uri);
    });

    it("returns null and clears the entry once past its TTL", () => {
      setPendingReconnect("nostrconnect://x", new Uint8Array([1]), ["wss://r"]);
      const stored = JSON.parse(
        localStorageMock.getItem("__smartflow_pending_reconnect_nip46_v1") ?? ""
      ) as { expiresAt: number };
      const expired = JSON.stringify({ ...stored, expiresAt: Date.now() - 1 });
      localStorageMock.setItem(
        "__smartflow_pending_reconnect_nip46_v1",
        expired
      );
      sessionStorageMock.setItem(
        "__smartflow_pending_reconnect_nip46_v1",
        expired
      );
      expect(getPendingReconnect()).toBeNull();
      expect(
        localStorageMock.getItem("__smartflow_pending_reconnect_nip46_v1")
      ).toBeNull();
      expect(
        sessionStorageMock.getItem("__smartflow_pending_reconnect_nip46_v1")
      ).toBeNull();
    });
  });

  describe("clearPendingReconnectStorage", () => {
    it("removes key from both storages", () => {
      sessionStorageMock.setItem(
        "__smartflow_pending_reconnect_nip46_v1",
        "{}"
      );
      localStorageMock.setItem("__smartflow_pending_reconnect_nip46_v1", "{}");
      clearPendingReconnectStorage();
      expect(
        sessionStorageMock.getItem("__smartflow_pending_reconnect_nip46_v1")
      ).toBeNull();
      expect(
        localStorageMock.getItem("__smartflow_pending_reconnect_nip46_v1")
      ).toBeNull();
    });
  });
});
