/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  NostrSigner,
  SignerStatus,
} from "~/features/auth/nostr-signer.client";
import { resolveNip46SignerFromConfig } from "~/features/auth/signer/connection-resolve.client";
import type { RemoteSignerConnection } from "~/features/auth/signer/remote-signer-sessions-types";
import type { SignedEvent } from "~/features/nostr/types";

const mocks = vi.hoisted(() => ({
  createNip46SignerFromStoredConfig: vi.fn(),
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

vi.mock("~/features/nostr/shared-pool.client", () => ({
  getSharedPool: () => ({}),
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
  const createSignedEvent = (): SignedEvent => ({
    id: "id",
    pubkey: "pubkey",
    created_at: 1,
    kind: 1,
    tags: [],
    content: "",
    sig: "sig",
  });

  const setCachedSigner = vi.fn();
  const getCachedSigner = vi.fn<() => NostrSigner | null>(() => null);
  const updateSession = vi.fn();
  const recordConnectionEvent = vi.fn();
  const syncRelaysWithRemoteSigner = vi.fn(async () => {});
  const getActiveConnection = vi.fn<() => RemoteSignerConnection | null>(
    () => ({
      id: "conn-1",
      label: "Connection",
      config: {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://uri",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
      },
      metadata: {
        status: "active",
        signerAppName: null,
        pubkey: null,
        relays: ["wss://x"],
        connectedAt: null,
        lastActivityAt: null,
        lastError: null,
        createdAt: 0,
        updatedAt: 0,
      },
      currentSessionId: null,
    })
  );

  function baseOptions(
    overrides: Partial<{
      isRequestCurrent: () => boolean;
    }> = {}
  ) {
    return {
      isRequestCurrent: overrides.isRequestCurrent ?? (() => true),
      setCachedSigner,
      getCachedSigner,
      getActiveConnection,
      updateSession,
      recordConnectionEvent,
      syncRelaysWithRemoteSigner,
      persistActiveSignerConfigWithoutReset:
        mocks.persistActiveSignerConfigWithoutReset,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hexToBytes.mockReturnValue(new Uint8Array([1, 2, 3]));
    mocks.buildRelayUnion.mockReturnValue(["wss://union"]);
    mocks.relayListsEqual.mockReturnValue(false);
    getCachedSigner.mockReturnValue(null);
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
      baseOptions({ isRequestCurrent: () => false })
    );

    expect(result).toBeNull();
    expect(close).toHaveBeenCalled();
  });

  it("connects via bunker flow and returns the signer when request is current", async () => {
    const signer: NostrSigner = {
      type: "nip46",
      getPublicKey: vi.fn(async () => "a".repeat(64)),
      signEvent: vi.fn(async () => createSignedEvent()),
      nip04Encrypt: vi.fn(async () => "encrypted"),
      nip44Encrypt: vi.fn(async () => "encrypted"),
      getStatus: vi.fn<() => SignerStatus>(() => "ready"),
      close: vi.fn(async () => {}),
    };
    mocks.createNip46SignerFromStoredConfig.mockResolvedValue({ signer });
    getCachedSigner.mockReturnValue(signer);

    const result = await resolveNip46SignerFromConfig(
      {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "bunker://x",
        clientSecretKeyHex: "ab",
      },
      baseOptions()
    );

    expect(result).toBe(signer);
    expect(setCachedSigner).toHaveBeenCalledWith(signer);
    expect(recordConnectionEvent).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({ type: "connected" })
    );
  });

  it("connects nostrconnect_uri and persists updated relays/pubkey", async () => {
    mocks.bunkerFromURI.mockResolvedValue({
      close: vi.fn(async () => {}),
      getPublicKey: vi.fn(async () => "b".repeat(64)),
    });
    const signer: NostrSigner & {
      getBunkerPointer: () => {
        pubkey: string;
        relays: string[];
        secret: null;
      };
    } = {
      type: "nip46",
      getPublicKey: vi.fn(async () => "b".repeat(64)),
      signEvent: vi.fn(async () => createSignedEvent()),
      nip04Encrypt: vi.fn(async () => "encrypted"),
      nip44Encrypt: vi.fn(async () => "encrypted"),
      getStatus: vi.fn<() => SignerStatus>(() => "ready"),
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
      baseOptions()
    );

    expect(result).toBe(signer);
    expect(mocks.persistActiveSignerConfigWithoutReset).toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalled();
  });
});
