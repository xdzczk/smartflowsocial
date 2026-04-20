/**
 * Integration tests for NIP-46 remote signer against a mock Nostr relay.
 * Uses the real createNip46SignerFromStoredConfig, getActiveSigner, cancelSignerInFlight
 * with a WebSocket mock relay that implements NIP-46 (no mocks in the connection path).
 *
 * @vitest-environment node
 */

import { generateSecretKey, getPublicKey } from "nostr-tools";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startMockNip46Relay,
  getLastDecryptedRequest,
} from "../../infra/mock-nip46-relay";

import { createNip46SignerFromStoredConfig } from "~/features/auth/signer/connection-connect.client";
import type { ActiveSignerConfig } from "~/features/auth/signer/nostr-signer-storage.client";

const CLIENT_SECRET_KEY = generateSecretKey();
const CLIENT_SECRET_KEY_HEX = Array.from(CLIENT_SECRET_KEY)
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

let mockRelayUrl: string;
let getMockSignerPubkey: () => string;
let stopRelay: () => Promise<void>;

function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

beforeAll(async () => {
  if (typeof globalThis.sessionStorage === "undefined") {
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage =
      makeStorage();
  }
  if (typeof globalThis.localStorage === "undefined") {
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      makeStorage();
  }
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as { window: Window }).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    } as unknown as Window;
  }
  if (typeof globalThis.CustomEvent === "undefined") {
    const BaseEvent = globalThis.Event;
    (
      globalThis as unknown as { CustomEvent: typeof globalThis.CustomEvent }
    ).CustomEvent = class CustomEventPolyfill extends BaseEvent {
      detail: unknown;
      constructor(type: string, options?: { detail?: unknown }) {
        super(type);
        this.detail = options?.detail;
      }
    } as typeof globalThis.CustomEvent;
  }
  const handle = await startMockNip46Relay({ port: 0 });
  mockRelayUrl = handle.url;
  getMockSignerPubkey = handle.getMockSignerPubkey;
  stopRelay = handle.stop;
});

afterAll(async () => {
  await stopRelay();
}, 15_000);

beforeEach(async () => {
  globalThis.sessionStorage.clear();
  globalThis.localStorage.clear();
  const { resetCachedSigner } =
    await import("~/features/auth/signer/nostr-signer-connection.client");
  resetCachedSigner();
  const { __resetSharedPoolForTests } =
    await import("~/features/nostr/shared-pool.client");
  __resetSharedPoolForTests();
});

function buildMockConfig(): Extract<ActiveSignerConfig, { type: "nip46" }> {
  return {
    type: "nip46",
    method: "nostrconnect_uri",
    uri: `nostrconnect://${getPublicKey(CLIENT_SECRET_KEY)}?relay=${encodeURIComponent(mockRelayUrl)}&secret=test`,
    clientSecretKeyHex: CLIENT_SECRET_KEY_HEX,
    relays: [mockRelayUrl],
    bunkerPointer: {
      pubkey: getMockSignerPubkey(),
      relays: [mockRelayUrl],
      secret: null,
    },
  };
}

describe("remote-signer-mock-relay integration", () => {
  it("(1) connect via createNip46SignerFromStoredConfig returns signer and mock signer pubkey", async () => {
    const config = buildMockConfig();
    const result = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 10_000,
    });
    expect(result.pubkey).toBe(getMockSignerPubkey());
    expect(result.signer).toBeDefined();
    await result.signer.close();
  });

  it("(2) getPublicKey returns mock signer pubkey", async () => {
    const config = buildMockConfig();
    const { signer } = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 10_000,
    });
    try {
      const pubkey = await signer.getPublicKey();
      expect(pubkey).toBe(getMockSignerPubkey());
    } finally {
      await signer.close();
    }
  });

  it("(3) sign_event returns signed event with sig", async () => {
    const config = buildMockConfig();
    const { signer } = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 10_000,
    });
    try {
      const event = await signer.signEvent({
        kind: 1,
        content: "test",
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      });
      expect(event).toHaveProperty("sig");
      expect(typeof (event as { sig: string }).sig).toBe("string");
      expect((event as { sig: string }).sig.length).toBeGreaterThan(0);
    } finally {
      await signer.close();
    }
  });

  // Regression: after a successful first sign, the next sign should also
  // complete. Per-RPC subscription refresh + ensuring REQ is opened before
  // EVENT is published is exactly what makes this work; without those, the
  // second `sign_event` hangs waiting for a reply on a subscription whose
  // REQ was never delivered before the relay broadcast our EVENT.
  it("(3b) signs two events in a row on the same signer instance", async () => {
    const config = buildMockConfig();
    const { signer } = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 10_000,
    });
    try {
      const first = await signer.signEvent({
        kind: 1,
        content: "first",
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      });
      expect((first as { sig: string }).sig.length).toBeGreaterThan(0);

      const second = await signer.signEvent({
        kind: 1,
        content: "second",
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      });
      expect((second as { sig: string }).sig.length).toBeGreaterThan(0);
      expect((second as { content: string }).content).toBe("second");
    } finally {
      await signer.close();
    }
  }, 30_000);

  it("(4) ping succeeds", async () => {
    const config = buildMockConfig();
    const { signer } = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 10_000,
    });
    try {
      await signer.ping();
    } finally {
      await signer.close();
    }
  });

  it("(5) reconnect (fromBunker) succeeds when relay is up", async () => {
    const config = buildMockConfig();
    const result1 = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 10_000,
    });
    await result1.signer.close();
    const result2 = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 10_000,
    });
    expect(result2.pubkey).toBe(getMockSignerPubkey());
    expect(result2.signer).toBeDefined();
    await result2.signer.close();
  });

  it("(6) lazy cold rebuild defers transport errors until the first RPC", async () => {
    // Cold rebuild now mirrors `@nostrify`'s `NConnectSigner` and skips the
    // probe `getPublicKey()` round-trip on construction. So an unreachable
    // relay no longer throws here — the failure surfaces on the first real
    // RPC the user makes (which times out via the per-RPC timeout in
    // `Nip46Signer.rpc`). This keeps boot/cold-reopen cheap and prevents the
    // bootstrap call from racing the user's first sign for the bunker reply.
    const badUrl = "ws://127.0.0.1:19999";
    const config: Extract<ActiveSignerConfig, { type: "nip46" }> = {
      type: "nip46",
      method: "nostrconnect_uri",
      uri: `nostrconnect://${getPublicKey(CLIENT_SECRET_KEY)}?relay=${encodeURIComponent(badUrl)}&secret=test`,
      clientSecretKeyHex: CLIENT_SECRET_KEY_HEX,
      relays: [badUrl],
      bunkerPointer: {
        pubkey: getMockSignerPubkey(),
        relays: [badUrl],
        secret: null,
      },
    };
    const result = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 2_000,
    });
    expect(result.pubkey).toBe(getMockSignerPubkey());
    expect(result.signer).toBeDefined();

    await expect(result.signer.getPublicKey()).rejects.toThrow(
      /timeout|SIGNER_TIMEOUT|signer is not open|All promises were rejected/i
    );
    await result.signer.close();
  });

  it("(7) cancelSignerInFlight closes a cached NIP-46 signer and clears the cache", async () => {
    const { cancelSignerInFlight, getActiveSigner, resetCachedSigner } =
      await import("~/features/auth/signer/nostr-signer-connection.client");
    const { setActiveSignerConfig } =
      await import("~/features/auth/signer/nostr-signer-storage.client");
    const { setActiveConnection, createConnection } =
      await import("~/features/auth/signer/remote-signer-sessions.client");

    const config = buildMockConfig();
    setActiveSignerConfig(config);
    const conn = createConnection(config, "Test connection");
    setActiveConnection(conn.id);
    resetCachedSigner();

    const signerBefore = await getActiveSigner({ allowReconnect: true });
    expect(signerBefore).not.toBeNull();

    cancelSignerInFlight();

    // After cancel, the next getActiveSigner call must build a brand-new
    // signer rather than reuse the (now-closed) one.
    const signerAfter = await getActiveSigner({ allowReconnect: true });
    expect(signerAfter).not.toBeNull();
    expect(signerAfter).not.toBe(signerBefore);

    setActiveSignerConfig(null as unknown as ActiveSignerConfig);
    setActiveConnection(null);
    await signerAfter!.close!();
  });

  it("(8) getActiveSigner returns signer when config points to mock relay and allowReconnect true", async () => {
    const { getActiveSigner } =
      await import("~/features/auth/signer/nostr-signer-connection.client");
    const { setActiveSignerConfig } =
      await import("~/features/auth/signer/nostr-signer-storage.client");
    const { setActiveConnection, createConnection } =
      await import("~/features/auth/signer/remote-signer-sessions.client");

    const config = buildMockConfig();
    setActiveSignerConfig(config);
    const conn = createConnection(config, "Test");
    setActiveConnection(conn.id);

    const signer = await getActiveSigner({ allowReconnect: true });
    expect(signer).not.toBeNull();
    const pubkey = await signer!.getPublicKey();
    expect(pubkey).toBe(getMockSignerPubkey());

    setActiveSignerConfig(null as unknown as ActiveSignerConfig);
    setActiveConnection(null);
    await signer!.close!();
  });

  it("(9) getActiveSigner returns null when config is null", async () => {
    const { getActiveSigner } =
      await import("~/features/auth/signer/nostr-signer-connection.client");
    const { setActiveSignerConfig, clearActiveSignerConfig } =
      await import("~/features/auth/signer/nostr-signer-storage.client");
    const { setActiveConnection } =
      await import("~/features/auth/signer/remote-signer-sessions.client");

    clearActiveSignerConfig();
    setActiveSignerConfig(null as unknown as ActiveSignerConfig);
    setActiveConnection(null);

    const signer = await getActiveSigner();
    expect(signer).toBeNull();
  });

  it("(9b) long break + return: after clearing cache, getActiveSigner(allowReconnect: true) reconnects and returns signer", async () => {
    const { getActiveSigner, resetCachedSigner } =
      await import("~/features/auth/signer/nostr-signer-connection.client");
    const { setActiveSignerConfig } =
      await import("~/features/auth/signer/nostr-signer-storage.client");
    const { setActiveConnection, createConnection } =
      await import("~/features/auth/signer/remote-signer-sessions.client");

    const config = buildMockConfig();
    setActiveSignerConfig(config);
    const conn = createConnection(config, "Existing connection");
    setActiveConnection(conn.id);

    const signerFirst = await getActiveSigner({ allowReconnect: true });
    expect(signerFirst).not.toBeNull();
    await signerFirst!.close!();

    resetCachedSigner();

    const signerAfterBreak = await getActiveSigner({ allowReconnect: true });
    expect(signerAfterBreak).not.toBeNull();
    const pubkey = await signerAfterBreak!.getPublicKey();
    expect(pubkey).toBe(getMockSignerPubkey());

    setActiveSignerConfig(null as unknown as ActiveSignerConfig);
    setActiveConnection(null);
    await signerAfterBreak!.close!();
  });

  it("(9c) Settings reconnect then sign: after runExistingNostrConnectReconnect, getActiveSigner returns signer for composer", async () => {
    const { getActiveSigner, resetCachedSigner } =
      await import("~/features/auth/signer/nostr-signer-connection.client");
    const { setActiveSignerConfig } =
      await import("~/features/auth/signer/nostr-signer-storage.client");
    const { setActiveConnection, createConnection, getActiveSession } =
      await import("~/features/auth/signer/remote-signer-sessions.client");
    const { runExistingNostrConnectReconnect } =
      await import("~/features/auth/reconnect/reconnect-existing-nostrconnect.client");

    const config = buildMockConfig();
    setActiveSignerConfig(config);
    const conn = createConnection(config, "Settings connection");
    setActiveConnection(conn.id);
    resetCachedSigner();

    const connectionView = getActiveSession();
    expect(connectionView).not.toBeNull();
    expect(
      connectionView!.connection.config.type === "nip46" &&
        connectionView!.connection.config.method === "nostrconnect_uri"
    ).toBe(true);

    let successConnectionId: string | null = null;
    await runExistingNostrConnectReconnect({
      connectionView: connectionView!,
      expectedPubkeyHex: null,
      trigger: "initial",
      runId: 1,
      getIsRunStale: () => false,
      setCancel: () => {},
      setState: () => {},
      setError: () => {},
      setExistingReconnectAttempt: () => {},
      onSuccess: (id) => {
        successConnectionId = id;
      },
    });

    expect(successConnectionId).toBe(conn.id);
    const signer = await getActiveSigner({ allowReconnect: false });
    expect(signer).not.toBeNull();
    const pubkey = await signer!.getPublicKey();
    expect(pubkey).toBe(getMockSignerPubkey());

    setActiveSignerConfig(null as unknown as ActiveSignerConfig);
    setActiveConnection(null);
    await signer!.close!();
  });

  it("(11) contract: first request is get_public_key", async () => {
    const config = buildMockConfig();
    const { signer } = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: 10_000,
    });
    try {
      await signer.getPublicKey();
      const lastReq = getLastDecryptedRequest();
      expect(lastReq).not.toBeNull();
      expect(lastReq!.method).toBe("get_public_key");
      expect(lastReq!.params).toEqual([]);
    } finally {
      await signer.close();
    }
  });
});
