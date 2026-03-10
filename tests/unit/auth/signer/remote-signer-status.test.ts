/**
 * Unit tests for remote-signer-status (getConnectionStatus, updateConnectionStatus, recordConnectionEvent).
 * Tests app/features/auth/signer/remote-signer-status.client.ts
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { ActiveSignerConfig } from "~/features/auth/signer/nostr-signer-storage.client";
import {
  createConnection,
  getSessionByIdLegacy,
  setActiveConnection,
  setCurrentUserNpub,
  updateSession,
} from "~/features/auth/signer/remote-signer-sessions.client";
import {
  getConnectionStatus,
  updateConnectionStatus,
  recordConnectionEvent,
  getSessionStatus,
  updateSessionStatus,
} from "~/features/auth/signer/remote-signer-status.client";

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

function makeConfig(): ActiveSignerConfig {
  return {
    type: "nip46",
    method: "bunker_input",
    bunkerInput: "bunker://x",
    clientSecretKeyHex: "ab",
  };
}

describe("remote-signer-status", () => {
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

  describe("getConnectionStatus", () => {
    it("returns inactive when connection does not exist", () => {
      expect(getConnectionStatus("nonexistent")).toBe("inactive");
    });

    it("returns connection metadata status when connection exists", () => {
      const conn = createConnection(makeConfig(), "Test");
      updateSession(conn.id, {
        metadata: { ...conn.metadata, status: "active" },
      });
      expect(getConnectionStatus(conn.id)).toBe("active");
    });
  });

  describe("updateConnectionStatus", () => {
    it("updates session metadata status", () => {
      const conn = createConnection(makeConfig(), "Test");
      expect(getConnectionStatus(conn.id)).toBe("disconnected");
      updateConnectionStatus(conn.id, "active");
      expect(getConnectionStatus(conn.id)).toBe("active");
    });

    it("does nothing when connection does not exist", () => {
      updateConnectionStatus("nonexistent", "active");
      expect(getConnectionStatus("nonexistent")).toBe("inactive");
    });
  });

  describe("getSessionStatus / updateSessionStatus (deprecated)", () => {
    it("getSessionStatus returns same as getConnectionStatus", () => {
      const conn = createConnection(makeConfig(), "Test");
      expect(getSessionStatus(conn.id)).toBe(getConnectionStatus(conn.id));
    });

    it("updateSessionStatus updates status", () => {
      const conn = createConnection(makeConfig(), "Test");
      updateSessionStatus(conn.id, "stale");
      expect(getConnectionStatus(conn.id)).toBe("stale");
    });
  });

  describe("recordConnectionEvent", () => {
    it("does nothing when connection does not exist", () => {
      recordConnectionEvent("nonexistent", {
        type: "connected",
        pubkey: "a".repeat(64),
      });
      // No throw
    });

    it("records connected event and updates metadata", () => {
      const conn = createConnection(makeConfig(), "Test");
      setActiveConnection(conn.id);
      recordConnectionEvent(conn.id, {
        type: "connected",
        pubkey: "a".repeat(64),
      });
      const view = getSessionByIdLegacy(conn.id);
      expect(view?.metadata.status).toBe("active");
      expect(view?.metadata.pubkey).toBe("a".repeat(64));
    });

    it("records disconnected event", () => {
      const conn = createConnection(makeConfig(), "Test");
      setActiveConnection(conn.id);
      updateSession(conn.id, {
        metadata: { ...conn.metadata, status: "active" },
      });
      recordConnectionEvent(conn.id, { type: "disconnected", reason: "Test" });
      const view = getSessionByIdLegacy(conn.id);
      expect(view?.metadata.status).toBe("disconnected");
    });

    it("records health_check event", () => {
      const conn = createConnection(makeConfig(), "Test");
      setActiveConnection(conn.id);
      recordConnectionEvent(conn.id, {
        type: "health_check",
        healthy: true,
      });
      const view = getSessionByIdLegacy(conn.id);
      expect(view?.metadata.status).toBe("active");
    });

    it("records error event", () => {
      const conn = createConnection(makeConfig(), "Test");
      setActiveConnection(conn.id);
      recordConnectionEvent(conn.id, {
        type: "error",
        error: "Something failed",
      });
      const view = getSessionByIdLegacy(conn.id);
      expect(view?.metadata.status).toBe("disconnected");
      expect(view?.metadata.lastError).toBe("Something failed");
    });

    it("records signed event", () => {
      const conn = createConnection(makeConfig(), "Test");
      setActiveConnection(conn.id);
      recordConnectionEvent(conn.id, { type: "signed", kind: 1 });
      const view = getSessionByIdLegacy(conn.id);
      expect(view?.metadata.lastActivityAt).toBeDefined();
    });
  });
});
