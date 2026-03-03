import { beforeEach, describe, expect, it } from "vitest";

import type { ActiveSignerConfig } from "~/lib/nostr-signer-manager.client";
import {
  addConnectionLog,
  createConnection,
  createSession,
  getActiveSession,
  getAllConnections,
  getAllSessions,
  getConnectionHistory,
  getCurrentSessionForConnection,
  getSessionByIdLegacy,
  getSessionsForConnection,
  getSessionHistory,
  matchOrCreateSession,
  removeSession,
  setActiveConnection,
  setActiveSession,
  setCurrentUserNpub,
  startNewSessionForConnection,
  updateSession,
} from "~/lib/remote-signer-sessions.client";

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

function makeNostrConnectConfig(
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

describe("remote-signer-sessions identity + storage consistency", () => {
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

  it("reuses logical session when signer pubkey matches", () => {
    const pubkey = "a".repeat(64);
    const first = createSession(
      makeNostrConnectConfig("nostrconnect://client1?secret=one", "11"),
      "Home signer"
    );
    updateSession(first.id, {
      metadata: {
        ...first.metadata,
        pubkey,
      },
    });

    const reused = matchOrCreateSession(
      makeNostrConnectConfig("nostrconnect://client2?secret=two", "22"),
      { signerPubkey: pubkey }
    );

    expect(reused.id).toBe(first.id);
    expect(getAllSessions()).toHaveLength(1);
    expect(getSessionByIdLegacy(first.id)?.config).toMatchObject({
      method: "nostrconnect_uri",
      uri: "nostrconnect://client2?secret=two",
      clientSecretKeyHex: "22",
    });
  });

  it("marks previous active session disconnected when switching active", () => {
    const first = createSession(
      makeNostrConnectConfig("nostrconnect://client1?secret=one", "11"),
      "First"
    );
    const second = createSession(
      makeNostrConnectConfig("nostrconnect://client2?secret=two", "22"),
      "Second"
    );
    updateSession(first.id, {
      metadata: {
        ...first.metadata,
        status: "active",
      },
    });

    setActiveSession(first.id);
    setActiveSession(second.id);

    expect(getSessionByIdLegacy(first.id)?.metadata.status).toBe(
      "disconnected"
    );
    expect(getActiveSession()?.id).toBe(second.id);
  });

  it("keeps active-session pointer consistent after removing active", () => {
    const first = createSession(
      makeNostrConnectConfig("nostrconnect://client1?secret=one", "11"),
      "First"
    );
    setActiveSession(first.id);
    removeSession(first.id);

    expect(getActiveSession()).toBeNull();
    expect(getAllSessions().every((s) => s.id !== first.id)).toBe(true);
  });
});

describe("remote-signer-sessions connection and session model", () => {
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

  it("createConnection creates a connection with no current session", () => {
    const conn = createConnection(
      makeNostrConnectConfig("nostrconnect://test?secret=1", "aa"),
      "My connection"
    );
    expect(conn.id).toBeDefined();
    expect(conn.label).toBe("My connection");
    expect(conn.currentSessionId).toBeNull();
    expect(getAllConnections().some((c) => c.id === conn.id)).toBe(true);
    expect(getSessionsForConnection(conn.id)).toHaveLength(0);
    expect(getCurrentSessionForConnection(conn.id)).toBeNull();
  });

  it("startNewSessionForConnection creates a session and getConnectionLog appends to it", () => {
    const conn = createConnection(
      makeNostrConnectConfig("nostrconnect://test?secret=1", "aa"),
      "Conn"
    );
    setActiveConnection(conn.id);
    const session = startNewSessionForConnection(conn.id);
    expect(session.connectionId).toBe(conn.id);
    expect(session.startedAt).toBeGreaterThan(0);
    expect(session.endedAt).toBeNull();
    expect(session.history).toHaveLength(0);

    addConnectionLog(conn.id, {
      type: "connect",
      status: "success",
      message: "Connected",
    });
    const current = getCurrentSessionForConnection(conn.id);
    expect(current?.history).toHaveLength(1);
    expect(current?.history[0]?.message).toBe("Connected");

    expect(getSessionHistory(session.id)).toHaveLength(1);
    expect(getConnectionHistory(conn.id)).toHaveLength(1);
  });

  it("getSessionsForConnection returns sessions ordered by startedAt desc", () => {
    const conn = createConnection(
      makeNostrConnectConfig("nostrconnect://test?secret=1", "aa"),
      "Conn"
    );
    setActiveConnection(conn.id);
    startNewSessionForConnection(conn.id);
    addConnectionLog(conn.id, {
      type: "connect",
      status: "success",
      message: "First",
    });
    startNewSessionForConnection(conn.id);
    addConnectionLog(conn.id, {
      type: "connect",
      status: "success",
      message: "Second",
    });
    const sessions = getSessionsForConnection(conn.id);
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    const [first, second] = sessions;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.startedAt).toBeGreaterThanOrEqual(second!.startedAt);
  });
});
