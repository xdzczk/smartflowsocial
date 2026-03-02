import { beforeEach, describe, expect, it } from "vitest";

import type { ActiveSignerConfig } from "~/lib/nostr-signer-manager.client";
import {
  createSession,
  getActiveSession,
  getAllSessions,
  getSessionById,
  matchOrCreateSession,
  removeSession,
  setActiveSession,
  setCurrentUserNpub,
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
    expect(getSessionById(first.id)?.config).toMatchObject({
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

    expect(getSessionById(first.id)?.metadata.status).toBe("disconnected");
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
    expect(getAllSessions()).toHaveLength(0);
  });
});
