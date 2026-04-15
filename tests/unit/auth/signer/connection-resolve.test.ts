/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveNip46SignerFromConfig } from "~/features/auth/signer/connection-resolve.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";

const mocks = vi.hoisted(() => ({
  createNip46SignerFromStoredConfig: vi.fn(),
  verifySignerConnection: vi.fn(),
  buildRelayUnion: vi.fn(),
  relayListsEqual: vi.fn(),
  hexToBytes: vi.fn(),
  persistActiveSignerConfigWithoutReset: vi.fn(),
  nip46SignerCtor: vi.fn(),
  bunkerFromURI: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-connect.client", () => ({
  createNip46SignerFromStoredConfig: (...args: unknown[]) =>
    mocks.createNip46SignerFromStoredConfig(...args),
}));

vi.mock("~/features/auth/signer/connection-relay-utils.client", () => ({
  buildRelayUnion: (...args: unknown[]) => mocks.buildRelayUnion(...args),
  relayListsEqual: (...args: unknown[]) => mocks.relayListsEqual(...args),
}));

vi.mock("~/features/auth/signer/nostr-signer-keys.client", () => ({
  hexToBytes: (...args: unknown[]) => mocks.hexToBytes(...args),
}));

vi.mock("~/features/auth/nostr-signer.client", () => ({
  Nip46Signer: function Nip46Signer(this: { inner: unknown }) {
    mocks.nip46SignerCtor();
    return {
      type: "nip46",
      getPublicKey: vi.fn(async () => "b".repeat(64)),
      getBunkerPointer: vi.fn(() => ({
        pubkey: "b".repeat(64),
        relays: ["wss://union"],
        secret: null,
      })),
      close: vi.fn(async () => {}),
      inner: this.inner,
    };
  },
}));

vi.mock("nostr-tools", () => ({
  SimplePool: class {
    close = vi.fn();
  },
}));

vi.mock("nostr-tools/nip46", () => ({
  BunkerSigner: {
    fromURI: (...args: unknown[]) => mocks.bunkerFromURI(...args),
  },
  parseNostrConnectURI: vi.fn(() => ({
    clientPubkey: "c".repeat(64),
    params: { secret: "secret", perms: ["sign_event"] },
  })),
  createNostrConnectURI: vi.fn(() => "nostrconnect://rewritten"),
}));

describe("connection-resolve", () => {
  const setCachedSigner = vi.fn();
  const getCachedSigner = vi.fn(() => null);
  const setConnectionEstablishedAt = vi.fn();
  const setLastActivityTime = vi.fn();
  const setLastVerificationTime = vi.fn();
  const startHealthCheckMonitoring = vi.fn();
  const stopHealthCheckMonitoring = vi.fn();
  const setNeedsReprobe = vi.fn();
  const resetCachedSigner = vi.fn();
  const updateSession = vi.fn();
  const recordConnectionEvent = vi.fn();
  const syncRelaysWithRemoteSigner = vi.fn(async () => {});
  const getActiveConnection = vi.fn(() => ({
    id: "conn-1",
    config: { type: "nip46", method: "nostrconnect_uri", relays: ["wss://x"] },
    metadata: {},
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hexToBytes.mockReturnValue(new Uint8Array([1, 2, 3]));
    mocks.verifySignerConnection.mockResolvedValue(true);
    mocks.buildRelayUnion.mockReturnValue(["wss://union"]);
    mocks.relayListsEqual.mockReturnValue(false);
    getCachedSigner.mockReturnValue({
      type: "nip46",
      getPublicKey: vi.fn(async () => "a".repeat(64)),
      close: vi.fn(async () => {}),
    });
  });

  it("returns null when request becomes stale in bunker flow", async () => {
    const close = vi.fn(async () => {});
    mocks.createNip46SignerFromStoredConfig.mockResolvedValue({
      signer: { type: "nip46", close },
    });

    const result = await resolveNip46SignerFromConfig(
      {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "bunker://x",
        clientSecretKeyHex: "ab",
      },
      {
        getConnectionCooldownUntil: () => null,
        isRequestCurrent: () => false,
        getSignerGeneration: () => 1,
        setCachedSigner,
        getCachedSigner,
        setConnectionEstablishedAt,
        setLastActivityTime,
        setLastVerificationTime,
        startHealthCheckMonitoring,
        stopHealthCheckMonitoring,
        getNeedsReprobe: () => false,
        setNeedsReprobe,
        verifySignerConnection: (...args: unknown[]) =>
          mocks.verifySignerConnection(...args),
        resetCachedSigner,
        getActiveConnection,
        updateSession,
        recordConnectionEvent,
        syncRelaysWithRemoteSigner,
        persistActiveSignerConfigWithoutReset:
          mocks.persistActiveSignerConfigWithoutReset,
      }
    );

    expect(result).toBeNull();
    expect(close).toHaveBeenCalled();
  });

  it("throws timeout error when reprobe fails in bunker flow", async () => {
    mocks.createNip46SignerFromStoredConfig.mockResolvedValue({
      signer: {
        type: "nip46",
        close: vi.fn(async () => {}),
        getPublicKey: vi.fn(async () => "a".repeat(64)),
      },
    });
    mocks.verifySignerConnection.mockResolvedValue(false);

    await expect(
      resolveNip46SignerFromConfig(
        {
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "bunker://x",
          clientSecretKeyHex: "ab",
        },
        {
          getConnectionCooldownUntil: () => null,
          isRequestCurrent: () => true,
          getSignerGeneration: () => 1,
          setCachedSigner,
          getCachedSigner,
          setConnectionEstablishedAt,
          setLastActivityTime,
          setLastVerificationTime,
          startHealthCheckMonitoring,
          stopHealthCheckMonitoring,
          getNeedsReprobe: () => true,
          setNeedsReprobe,
          verifySignerConnection: (...args: unknown[]) =>
            mocks.verifySignerConnection(...args),
          resetCachedSigner,
          getActiveConnection,
          updateSession,
          recordConnectionEvent,
          syncRelaysWithRemoteSigner,
          persistActiveSignerConfigWithoutReset:
            mocks.persistActiveSignerConfigWithoutReset,
        }
      )
    ).rejects.toThrow(RemoteSignerTimeoutError);

    expect(resetCachedSigner).toHaveBeenCalled();
    expect(recordConnectionEvent).toHaveBeenCalled();
  });

  it("connects nostrconnect_uri and persists updated relays/pubkey", async () => {
    mocks.bunkerFromURI.mockResolvedValue({
      close: vi.fn(async () => {}),
      getPublicKey: vi.fn(async () => "b".repeat(64)),
    });
    const signer = {
      type: "nip46",
      getPublicKey: vi.fn(async () => "b".repeat(64)),
      getBunkerPointer: vi.fn(() => ({
        pubkey: "b".repeat(64),
        relays: ["wss://union"],
        secret: null,
      })),
      close: vi.fn(async () => {}),
    };
    getCachedSigner.mockReturnValue(signer);

    const result = await resolveNip46SignerFromConfig(
      {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://origin",
        relays: ["wss://x"],
        clientSecretKeyHex: "ab",
      },
      {
        getConnectionCooldownUntil: () => null,
        isRequestCurrent: () => true,
        getSignerGeneration: () => 1,
        setCachedSigner,
        getCachedSigner,
        setConnectionEstablishedAt,
        setLastActivityTime,
        setLastVerificationTime,
        startHealthCheckMonitoring,
        stopHealthCheckMonitoring,
        getNeedsReprobe: () => false,
        setNeedsReprobe,
        verifySignerConnection: (...args: unknown[]) =>
          mocks.verifySignerConnection(...args),
        resetCachedSigner,
        getActiveConnection,
        updateSession,
        recordConnectionEvent,
        syncRelaysWithRemoteSigner,
        persistActiveSignerConfigWithoutReset:
          mocks.persistActiveSignerConfigWithoutReset,
      }
    );

    expect(result).toBe(signer);
    expect(mocks.persistActiveSignerConfigWithoutReset).toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalled();
  });
});
