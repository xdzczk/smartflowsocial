/**
 * Unit tests for the durable pending-nostrconnect storage helper.
 * Tests app/features/auth/pending-nip46-storage.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth/signer", () => ({
  parseSecretKeyHex: vi.fn(
    (hex: string) => new Uint8Array([parseInt(hex.slice(0, 2), 16)])
  ),
  serializeSecretKey: vi.fn((bytes: Uint8Array) =>
    (bytes[0] ?? 0).toString(16).padStart(2, "0")
  ),
}));

import {
  clearPendingNip46Handoff,
  PENDING_NIP46_TTL_MS_FOR_TESTS,
  readPendingNip46Handoff,
  writePendingNip46Handoff,
} from "~/features/auth/pending-nip46-storage.client";

const KEY = "__test_pending";

describe("pending-nip46-storage", () => {
  const localStore: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};
  const makeStorageMock = (store: Record<string, string>) => ({
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  });

  beforeEach(() => {
    Object.keys(localStore).forEach((k) => delete localStore[k]);
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
    (globalThis as unknown as { localStorage: unknown }).localStorage =
      makeStorageMock(localStore);
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage =
      makeStorageMock(sessionStore);
  });

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    delete (globalThis as unknown as { sessionStorage?: unknown })
      .sessionStorage;
    vi.restoreAllMocks();
  });

  it("round-trips a handoff via the durable primary store", () => {
    writePendingNip46Handoff(KEY, {
      uri: "nostrconnect://x",
      clientSecretKey: new Uint8Array([0xab]),
      relays: ["wss://a", "wss://b"],
    });
    const got = readPendingNip46Handoff(KEY);
    expect(got).not.toBeNull();
    expect(got!.uri).toBe("nostrconnect://x");
    expect(got!.relays).toEqual(["wss://a", "wss://b"]);
    expect(Array.from(got!.clientSecretKey)).toEqual([0xab]);
  });

  it("writes through to sessionStorage as a fallback", () => {
    writePendingNip46Handoff(KEY, {
      uri: "nostrconnect://x",
      clientSecretKey: new Uint8Array([0xab]),
      relays: [],
    });
    expect(sessionStore[KEY]).toBeDefined();
    expect(localStore[KEY]).toBeDefined();
  });

  it("recovers from sessionStorage when localStorage was wiped", () => {
    writePendingNip46Handoff(KEY, {
      uri: "nostrconnect://restored",
      clientSecretKey: new Uint8Array([0xcd]),
      relays: ["wss://r"],
    });
    delete localStore[KEY];
    const got = readPendingNip46Handoff(KEY);
    expect(got).not.toBeNull();
    expect(got!.uri).toBe("nostrconnect://restored");
  });

  it("returns null and clears when the entry is past its TTL", () => {
    writePendingNip46Handoff(
      KEY,
      {
        uri: "nostrconnect://x",
        clientSecretKey: new Uint8Array([0x01]),
        relays: [],
      },
      0
    );
    const got = readPendingNip46Handoff(KEY, PENDING_NIP46_TTL_MS_FOR_TESTS);
    expect(got).toBeNull();
    expect(localStore[KEY]).toBeUndefined();
    expect(sessionStore[KEY]).toBeUndefined();
  });

  it("treats malformed JSON as missing and clears it", () => {
    localStore[KEY] = "not json";
    expect(readPendingNip46Handoff(KEY)).toBeNull();
    expect(localStore[KEY]).toBeUndefined();
  });

  it("treats records missing required fields as malformed", () => {
    localStore[KEY] = JSON.stringify({ uri: "x" });
    expect(readPendingNip46Handoff(KEY)).toBeNull();
    expect(localStore[KEY]).toBeUndefined();
  });

  it("clearPendingNip46Handoff removes from both stores", () => {
    localStore[KEY] = "{}";
    sessionStore[KEY] = "{}";
    clearPendingNip46Handoff(KEY);
    expect(localStore[KEY]).toBeUndefined();
    expect(sessionStore[KEY]).toBeUndefined();
  });

  it("survives when localStorage is missing entirely", () => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    writePendingNip46Handoff(KEY, {
      uri: "nostrconnect://session-only",
      clientSecretKey: new Uint8Array([0x02]),
      relays: [],
    });
    expect(sessionStore[KEY]).toBeDefined();
    const got = readPendingNip46Handoff(KEY);
    expect(got).not.toBeNull();
    expect(got!.uri).toBe("nostrconnect://session-only");
  });

  it("survives when both storages throw", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    (globalThis as unknown as { localStorage: unknown }).localStorage =
      throwingStorage;
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage =
      throwingStorage;
    expect(() =>
      writePendingNip46Handoff(KEY, {
        uri: "x",
        clientSecretKey: new Uint8Array([0]),
        relays: [],
      })
    ).not.toThrow();
    expect(readPendingNip46Handoff(KEY)).toBeNull();
    expect(() => clearPendingNip46Handoff(KEY)).not.toThrow();
  });
});
