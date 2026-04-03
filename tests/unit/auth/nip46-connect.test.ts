/**
 * Unit tests for NIP-46 connect (login) flows.
 * Tests connectNip46WithBunkerInputForLogin, connectNip46WithNostrConnectUriForLogin.
 * These modules are excluded from coverage (*.client.ts); tests run in CI to guard behavior.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  connectNip46WithBunkerInputForLogin,
  connectNip46WithNostrConnectUriForLogin,
  connectNip46WithPendingUriForLogin,
} from "~/features/auth/nip46/nip46-connect.client";

vi.mock("nostr-tools", () => ({
  generateSecretKey: vi.fn().mockReturnValue(new Uint8Array(32).fill(1)),
  SimplePool: class MockSimplePool {
    close = vi.fn();
  },
}));

vi.mock("~/features/auth/signer", () => ({
  serializeSecretKey: vi.fn().mockReturnValue("secret-hex-abc"),
}));

vi.mock("~/lib/nostr-conversion", () => ({
  convertToHex: vi.fn((x: string) => x || "pubkey-hex-123"),
}));

vi.mock("~/features/auth/nostr-signer.client", () => ({
  connectNip46WithBunkerInput: vi.fn().mockResolvedValue({
    signer: {
      close: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue(undefined),
    },
    pubkey: "pubkey-hex-123",
  }),
  connectNip46WithNostrConnectUri: vi.fn().mockResolvedValue({
    signer: {
      close: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue(undefined),
    },
    pubkey: "pubkey-hex-123",
  }),
  createNip46NostrConnectUri: vi.fn().mockReturnValue({
    uri: "nostrconnect://relay.example.com#payload",
    pool: {},
    relays: ["wss://relay.example.com"],
    clientSecretKey: new Uint8Array(32).fill(2),
  }),
  getNostrConnectAppMetadata: vi.fn().mockReturnValue({
    name: "TestApp",
    url: "https://example.com",
  }),
}));

describe("NIP-46 connect (login)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("connectNip46WithBunkerInputForLogin", () => {
    it("returns config with method bunker_input and trimmed bunkerInput", async () => {
      const result = await connectNip46WithBunkerInputForLogin({
        bunkerInput: "  bunker+nostr://...  ",
        timeoutMs: 5000,
      });

      expect(result.config.type).toBe("nip46");
      expect(result.config.method).toBe("bunker_input");
      expect(result.config.bunkerInput).toBe("bunker+nostr://...");
      expect(result.config.clientSecretKeyHex).toBe("secret-hex-abc");
      expect(result.pubkey).toBe("pubkey-hex-123");
    });

    it("passes retryCount to connectNip46WithBunkerInput when provided", async () => {
      const { connectNip46WithBunkerInput } =
        await import("~/features/auth/nostr-signer.client");

      await connectNip46WithBunkerInputForLogin({
        bunkerInput: "bunker+nostr://...",
        timeoutMs: 5000,
        retryCount: 3,
      });

      expect(connectNip46WithBunkerInput).toHaveBeenCalledWith(
        expect.objectContaining({
          bunkerInput: "bunker+nostr://...",
          timeoutMs: 5000,
          retryCount: 3,
        })
      );
    });
  });

  describe("connectNip46WithNostrConnectUriForLogin", () => {
    it("returns config with method nostrconnect_uri, uri, and relays", async () => {
      const result = await connectNip46WithNostrConnectUriForLogin({
        relays: ["wss://relay.example.com"],
        timeoutMs: 5000,
      });

      expect(result.config.type).toBe("nip46");
      expect(result.config.method).toBe("nostrconnect_uri");
      expect(result.config.uri).toBe(
        "nostrconnect://relay.example.com#payload"
      );
      expect(result.config.relays).toEqual(["wss://relay.example.com"]);
      expect(result.config.clientSecretKeyHex).toBe("secret-hex-abc");
      expect(result.uri).toBe("nostrconnect://relay.example.com#payload");
      expect(result.relays).toEqual(["wss://relay.example.com"]);
    });

    it("calls onUriCreated with uri, pool, relays, clientSecretKey when provided", async () => {
      const onUriCreated = vi.fn();

      await connectNip46WithNostrConnectUriForLogin({
        relays: ["wss://relay.example.com"],
        timeoutMs: 5000,
        onUriCreated,
      });

      expect(onUriCreated).toHaveBeenCalledTimes(1);
      expect(onUriCreated).toHaveBeenCalledWith(
        "nostrconnect://relay.example.com#payload",
        expect.anything(),
        ["wss://relay.example.com"],
        expect.any(Uint8Array)
      );
    });
  });

  describe("connectNip46WithPendingUriForLogin", () => {
    it("calls connectNip46WithNostrConnectUri and returns signer, pubkey, config with optional bunkerPointer", async () => {
      const { connectNip46WithNostrConnectUri } =
        await import("~/features/auth/nostr-signer.client");
      const clientSecretKey = new Uint8Array(32).fill(3);
      const result = await connectNip46WithPendingUriForLogin({
        uri: "nostrconnect://relay.example.com#payload",
        clientSecretKey,
        relays: ["wss://relay.example.com"],
        timeoutMs: 5000,
      });

      expect(connectNip46WithNostrConnectUri).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: "nostrconnect://relay.example.com#payload",
          timeoutMs: 5000,
          relaysToCloseOnCancel: ["wss://relay.example.com"],
        })
      );
      expect(result.pubkey).toBe("pubkey-hex-123");
      expect(result.config.type).toBe("nip46");
      expect(result.config.method).toBe("nostrconnect_uri");
      expect(result.config.uri).toBe(
        "nostrconnect://relay.example.com#payload"
      );
      expect(result.config.relays).toEqual(["wss://relay.example.com"]);
      expect(result.config.clientSecretKeyHex).toBe("secret-hex-abc");
      expect(result.config.signerPubkey).toBeDefined();
    });

    it("calls onPoolCreated when provided", async () => {
      const onPoolCreated = vi.fn();
      await connectNip46WithPendingUriForLogin({
        uri: "nostrconnect://x",
        clientSecretKey: new Uint8Array(32).fill(1),
        relays: ["wss://r.com"],
        timeoutMs: 1000,
        onPoolCreated,
      });
      expect(onPoolCreated).toHaveBeenCalledTimes(1);
      expect(onPoolCreated).toHaveBeenCalledWith(expect.anything(), [
        "wss://r.com",
      ]);
    });
  });
});
