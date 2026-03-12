/**
 * Unit tests for remote-signer-sessions-migration (migrateExistingConfig).
 * Tests app/features/auth/signer/remote-signer-sessions-migration.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MIGRATION_FLAG_KEY = "__smartflow_remote_signer_migrated_v1";

const mockGetActiveSignerConfig = vi.fn();
const mockGetAllSessions = vi.fn();
const mockCreateSession = vi.fn();
const mockSetActiveSession = vi.fn();

vi.mock("~/features/auth/signer/nostr-signer-storage.client", () => ({
  getActiveSignerConfig: (...args: unknown[]) =>
    mockGetActiveSignerConfig(...args),
}));

vi.mock("~/features/auth/signer/remote-signer-sessions.client", () => ({
  getAllSessions: (...args: unknown[]) => mockGetAllSessions(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  setActiveSession: (...args: unknown[]) => mockSetActiveSession(...args),
}));

import { migrateExistingConfig } from "~/features/auth/signer/remote-signer-sessions-migration.client";

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

describe("remote-signer-sessions-migration", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllSessions.mockReturnValue([]);
  });

  afterEach(() => {
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
  });

  it("returns early when window is undefined", () => {
    (globalThis as unknown as { window: unknown }).window = undefined;
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    migrateExistingConfig();
    expect(mockGetActiveSignerConfig).not.toHaveBeenCalled();
    expect(mockGetAllSessions).not.toHaveBeenCalled();
  });

  it("returns early when localStorage is undefined", () => {
    (globalThis as unknown as { window: unknown }).window = {};
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    migrateExistingConfig();
    expect(mockGetActiveSignerConfig).not.toHaveBeenCalled();
    expect(mockGetAllSessions).not.toHaveBeenCalled();
  });

  describe("when window and localStorage are defined", () => {
    let localStorage: MemoryStorage;

    beforeEach(() => {
      localStorage = new MemoryStorage();
      (globalThis as unknown as { window: unknown }).window = {
        localStorage,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      (globalThis as unknown as { localStorage: Storage }).localStorage =
        localStorage;
    });

    it("returns early when already migrated (flag set)", () => {
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
      migrateExistingConfig();
      expect(mockGetAllSessions).not.toHaveBeenCalled();
      expect(mockGetActiveSignerConfig).not.toHaveBeenCalled();
    });

    it("sets flag and returns when getItem throws (continue with migration)", () => {
      vi.spyOn(localStorage, "getItem").mockImplementationOnce(() => {
        throw new Error("getItem failed");
      });
      mockGetAllSessions.mockReturnValue([]);
      mockGetActiveSignerConfig.mockReturnValue(null);
      migrateExistingConfig();
      expect(mockGetAllSessions).toHaveBeenCalled();
      expect(mockGetActiveSignerConfig).toHaveBeenCalled();
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe("true");
    });

    it("sets flag and returns when existingSessions.length > 0", () => {
      mockGetAllSessions.mockReturnValue([
        {
          id: "s1",
          connectionId: "c1",
          startedAt: 1,
          endedAt: null,
          history: [],
        },
      ]);
      migrateExistingConfig();
      expect(mockGetActiveSignerConfig).not.toHaveBeenCalled();
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe("true");
    });

    it("returns without throwing when setItem throws after existingSessions > 0", () => {
      mockGetAllSessions.mockReturnValue([{ id: "s1" }]);
      vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
        throw new Error("setItem failed");
      });
      expect(() => migrateExistingConfig()).not.toThrow();
      expect(mockGetActiveSignerConfig).not.toHaveBeenCalled();
    });

    it("sets flag and returns when getActiveSignerConfig returns null", () => {
      mockGetActiveSignerConfig.mockReturnValue(null);
      migrateExistingConfig();
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe("true");
    });

    it("sets flag and returns when existingConfig.type is nip07", () => {
      mockGetActiveSignerConfig.mockReturnValue({
        type: "nip07",
        method: "nip07",
      });
      migrateExistingConfig();
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe("true");
    });

    it("creates session, sets active, and sets flag on happy path (NIP-46 config)", () => {
      const nip46Config = {
        type: "nip46" as const,
        method: "nostrconnect_uri" as const,
        relays: ["wss://relay.example.com"],
        bunkerSecret: "secret",
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      mockCreateSession.mockReturnValue({
        connection: { id: "conn-1" },
        currentSession: null,
      });
      migrateExistingConfig();
      expect(mockCreateSession).toHaveBeenCalledWith(
        nip46Config,
        "Migrated Session"
      );
      expect(mockSetActiveSession).toHaveBeenCalledWith("conn-1");
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe("true");
    });

    it("sets flag and does not rethrow when createSession throws", () => {
      const nip46Config = {
        type: "nip46" as const,
        method: "nostrconnect_uri" as const,
        relays: [],
        bunkerSecret: "s",
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      mockCreateSession.mockImplementation(() => {
        throw new Error("createSession failed");
      });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      migrateExistingConfig();
      expect(mockSetActiveSession).not.toHaveBeenCalled();
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe("true");
      warnSpy.mockRestore();
    });

    it("does not throw when createSession throws and setItem in catch throws (inner catch)", () => {
      const nip46Config = {
        type: "nip46" as const,
        method: "nostrconnect_uri" as const,
        relays: [],
        bunkerSecret: "s",
      };
      mockGetActiveSignerConfig.mockReturnValue(nip46Config);
      mockCreateSession.mockImplementation(() => {
        throw new Error("createSession failed");
      });
      vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new Error("setItem failed");
      });
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(() => migrateExistingConfig()).not.toThrow();
    });
  });
});
