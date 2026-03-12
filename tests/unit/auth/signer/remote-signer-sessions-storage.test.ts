/**
 * Unit tests for remote-signer-sessions-storage (getStorageKey, generateId, getStorage V1→V2 migration, normalize helpers).
 * Tests app/features/auth/signer/remote-signer-sessions-storage.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/nostr-conversion", () => ({
  convertHexToNpub: vi.fn((hex: string) =>
    hex.length === 64 ? `npub${hex.slice(0, 8)}` : hex
  ),
  convertToHex: vi.fn((npub: string) =>
    npub.startsWith("npub") ? npub.slice(4, 4 + 64) : null
  ),
}));

import {
  setCurrentUserNpub,
  getStorageKey,
  getStorageKeyV2,
  getStorage,
  saveStorage,
  generateId,
  updateStorage,
  normalizeActiveConnectionId,
  normalizeCurrentSessionIds,
} from "~/features/auth/signer/remote-signer-sessions-storage.client";
import {
  STORAGE_KEY_PREFIX,
  STORAGE_KEY_V2_PREFIX,
} from "~/features/auth/signer/remote-signer-sessions-types";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("remote-signer-sessions-storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUserNpub(null);
    if (typeof globalThis !== "undefined") {
      const ls = new MemoryStorage();
      const win = {
        localStorage: ls,
        sessionStorage: new MemoryStorage(),
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };
      (globalThis as unknown as { window: unknown }).window = win;
      (globalThis as unknown as { localStorage: Storage }).localStorage = ls;
    }
  });

  describe("getStorageKey / getStorageKeyV2", () => {
    it("returns base prefix when currentUserNpub is null", () => {
      setCurrentUserNpub(null);
      expect(getStorageKey()).toBe(STORAGE_KEY_PREFIX);
      expect(getStorageKeyV2()).toBe(STORAGE_KEY_V2_PREFIX);
    });

    it("returns key with npub suffix when currentUserNpub is set", () => {
      setCurrentUserNpub("npub1abc");
      expect(getStorageKey()).toContain(STORAGE_KEY_PREFIX);
      expect(getStorageKey()).toContain("npub");
      expect(getStorageKeyV2()).toContain(STORAGE_KEY_V2_PREFIX);
    });
  });

  describe("generateId", () => {
    it("returns a string with timestamp and random part", () => {
      const id = generateId();
      expect(typeof id).toBe("string");
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe("getStorage", () => {
    it("returns empty V2 shape when no stored data", () => {
      const storage = getStorage();
      expect(storage.version).toBe(2);
      expect(storage.connections).toEqual([]);
      expect(storage.sessions).toEqual([]);
      expect(storage.activeConnectionId).toBeNull();
    });

    it("migrates V1 to V2 and persists when V1 data exists at storage key", () => {
      setCurrentUserNpub("npub1abc");
      const keyV1 = getStorageKey();
      const v1 = { version: 1 as const, sessions: [] as unknown[] };
      (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
        keyV1,
        JSON.stringify(v1)
      );
      const storage = getStorage();
      expect(storage.version).toBe(2);
      expect(storage.connections).toEqual([]);
      expect(storage.sessions).toEqual([]);
      const keyV2 = getStorageKeyV2();
      expect(
        (
          globalThis as unknown as { localStorage: Storage }
        ).localStorage.getItem(keyV2)
      ).toBeTruthy();
    });

    it("clears V1 keys after migrating to V2", () => {
      setCurrentUserNpub("npub1abc");
      const keyV1 = getStorageKey();
      const v1 = { version: 1 as const, sessions: [] as unknown[] };
      const ls = (globalThis as unknown as { localStorage: Storage })
        .localStorage as MemoryStorage;
      ls.setItem(keyV1, JSON.stringify(v1));
      getStorage();
      expect(ls.getItem(keyV1)).toBeNull();
      expect(ls.getItem(getStorageKeyV2())).toBeTruthy();
    });
  });

  describe("saveStorage", () => {
    it("returns early when window is undefined", () => {
      const win = globalThis.window;
      const ls = (globalThis as unknown as { localStorage: Storage })
        .localStorage as MemoryStorage;
      const setItemSpy = vi.spyOn(ls, "setItem");
      try {
        (globalThis as unknown as { window: undefined }).window = undefined;
        saveStorage({
          version: 2,
          connections: [],
          sessions: [],
          activeConnectionId: null,
        });
        expect(setItemSpy).not.toHaveBeenCalled();
      } finally {
        setItemSpy.mockRestore();
        (globalThis as unknown as { window: unknown }).window = win;
      }
    });

    it("calls console.warn when localStorage.setItem throws", () => {
      const ls = (globalThis as unknown as { localStorage: Storage })
        .localStorage as MemoryStorage;
      vi.spyOn(ls, "setItem").mockImplementationOnce(() => {
        throw new Error("setItem failed");
      });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      saveStorage({
        version: 2,
        connections: [],
        sessions: [],
        activeConnectionId: null,
      });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("updateStorage", () => {
    it("mutates storage and persists", () => {
      const id = updateStorage((s) => {
        s.connections.push({
          id: "c1",
          label: "L",
          config: {
            type: "nip46",
            method: "bunker_input",
            bunkerInput: "x",
            clientSecretKeyHex: "ab",
          },
          metadata: {
            status: "disconnected",
            signerAppName: null,
            pubkey: null,
            relays: [],
            connectedAt: null,
            lastActivityAt: null,
            lastError: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          currentSessionId: null,
        });
        return "ok";
      });
      expect(id).toBe("ok");
      const after = getStorage();
      expect(after.connections).toHaveLength(1);
      expect(after.connections[0]?.id).toBe("c1");
    });
  });

  describe("normalizeActiveConnectionId", () => {
    it("clears activeConnectionId when it does not exist in connections", () => {
      const storage = {
        version: 2 as const,
        connections: [],
        sessions: [],
        activeConnectionId: "orphan-id",
      };
      normalizeActiveConnectionId(storage);
      expect(storage.activeConnectionId).toBeNull();
    });
  });

  describe("normalizeCurrentSessionIds", () => {
    it("clears currentSessionId when session does not exist", () => {
      const conn = {
        id: "c1",
        label: "L",
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        config: {} as never,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        metadata: {} as never,
        currentSessionId: "missing-session-id",
      };
      const storage = {
        version: 2 as const,
        connections: [conn],
        sessions: [],
        activeConnectionId: null,
      };
      normalizeCurrentSessionIds(storage);
      expect(conn.currentSessionId).toBeNull();
    });
  });
});
