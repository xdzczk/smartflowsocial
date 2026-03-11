/**
 * Unit tests for connection-connect (createNip46SignerFromStoredConfig).
 * Tests app/features/auth/signer/connection-connect.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConnectBunker = vi.fn();
const mockConnectReconnect = vi.fn();
vi.mock("~/features/auth/nostr-signer.client", () => ({
  connectNip46WithBunkerInput: (...args: unknown[]) =>
    mockConnectBunker(...args),
  connectNip46ReconnectWithStoredNostrConnect: (...args: unknown[]) =>
    mockConnectReconnect(...args),
}));

vi.mock("~/features/auth/signer/nostr-signer-keys.client", () => ({
  hexToBytes: vi.fn(
    (hex: string) => new Uint8Array([parseInt(hex.slice(0, 2), 16)])
  ),
}));

vi.mock("nostr-tools", () => ({
  SimplePool: class SimplePool {},
}));

import { createNip46SignerFromStoredConfig } from "~/features/auth/signer/connection-connect.client";
import { hexToBytes } from "~/features/auth/signer/nostr-signer-keys.client";

describe("connection-connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectBunker.mockResolvedValue({ signer: {}, pubkey: "pk-bunker" });
    mockConnectReconnect.mockResolvedValue({
      signer: {},
      pubkey: "pk-reconnect",
    });
  });

  it("calls connectNip46WithBunkerInput when method is bunker_input", async () => {
    const config = {
      type: "nip46" as const,
      method: "bunker_input" as const,
      bunkerInput: "bunker://...",
      clientSecretKeyHex: "ab",
    };
    const result = await createNip46SignerFromStoredConfig(config);
    expect(mockConnectBunker).toHaveBeenCalledWith(
      expect.objectContaining({
        bunkerInput: "bunker://...",
        skipConnect: true,
      })
    );
    expect(hexToBytes).toHaveBeenCalledWith("ab");
    expect(result.pubkey).toBe("pk-bunker");
  });

  it("calls connectNip46ReconnectWithStoredNostrConnect when bunkerPointer is set", async () => {
    const config = {
      type: "nip46" as const,
      method: "nostrconnect_uri" as const,
      uri: "nostrconnect://signer?relay=wss://r.com",
      relays: ["wss://r.com"],
      bunkerPointer: { pubkey: "bp-pk", relays: ["wss://r.com"], secret: null },
      clientSecretKeyHex: "cd",
    };
    const result = await createNip46SignerFromStoredConfig(config);
    expect(mockConnectReconnect).toHaveBeenCalledWith(
      expect.objectContaining({
        bunkerPointer: {
          pubkey: "bp-pk",
          relays: ["wss://r.com"],
          secret: null,
        },
        relays: ["wss://r.com"],
      })
    );
    expect(result.pubkey).toBe("pk-reconnect");
  });

  it("calls connectNip46ReconnectWithStoredNostrConnect when signerPubkey and relays", async () => {
    const config = {
      type: "nip46" as const,
      method: "nostrconnect_uri" as const,
      uri: "nostrconnect://signer?relay=wss://a.com",
      signerPubkey: "sp",
      relays: ["wss://a.com"],
      clientSecretKeyHex: "ef",
    };
    const result = await createNip46SignerFromStoredConfig(config);
    expect(mockConnectReconnect).toHaveBeenCalledWith(
      expect.objectContaining({
        signerPubkey: "sp",
        relays: ["wss://a.com"],
      })
    );
    expect(result.pubkey).toBe("pk-reconnect");
  });

  it("throws when no bunkerPointer and no signerPubkey/relays", async () => {
    const config = {
      type: "nip46" as const,
      method: "nostrconnect_uri" as const,
      uri: "nostrconnect://signer",
      relays: [],
      clientSecretKeyHex: "00",
    };
    await expect(createNip46SignerFromStoredConfig(config)).rejects.toThrow(
      "createNip46SignerFromStoredConfig: nostrconnect config needs bunkerPointer or signerPubkey+relays for reconnect"
    );
    expect(mockConnectBunker).not.toHaveBeenCalled();
    expect(mockConnectReconnect).not.toHaveBeenCalled();
  });
});
