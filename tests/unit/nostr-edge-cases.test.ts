/**
 * Unit tests for Nostr.ts edge cases
 * Tests signEventFn, signLongFormEvent, and EditorJS conversion edge cases
 * Tests app/lib/nostr.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { BRAND_NAME } from "~/lib/brand";

// Mock window.nostr for client-side functions
const mockWindowNostr = {
  signEvent: vi.fn(),
};

// Mock error handler
vi.mock("~/lib/error-handler.client", () => ({
  logClientError: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Setup window.nostr mock
beforeEach(() => {
  global.window = {
    nostr: mockWindowNostr,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    setTimeout,
    clearTimeout,
  } as unknown as Window & typeof globalThis;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // @ts-expect-error - Clean up
  delete global.window;
});

describe("Nostr Edge Cases", () => {
  describe("signEventFn - Retry Logic", () => {
    it("falls back to window.nostr when configured signer is absent", async () => {
      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const signEventFn = nostrAdapter.signEvent;

      const mockSignResult = {
        id: "event-123",
        pubkey: "pubkey-123",
        sig: "sig-123",
      };
      mockWindowNostr.signEvent.mockResolvedValue(mockSignResult);

      const eventData = {
        content: "Test content",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
      };

      const result = await signEventFn(eventData);

      expect(result.nostrEvent).toBeDefined();
      expect(result.signedEvent.id).toBe("event-123");
      expect(mockWindowNostr.signEvent).toHaveBeenCalled();
    });

    it("throws an extension-not-found error when neither configured signer nor window.nostr is present", async () => {
      global.window = {
        nostr: undefined,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        setTimeout,
        clearTimeout,
      } as unknown as Window & typeof globalThis;

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const signEventFn = nostrAdapter.signEvent;

      const eventData = {
        content: "Test content",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
      };

      await expect(signEventFn(eventData)).rejects.toThrow(
        /Nostr extension not found/
      );
    });

    it("should handle string return type from signEvent", async () => {
      mockWindowNostr.signEvent.mockResolvedValue("signature-string");

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const signEventFn = nostrAdapter.signEvent;

      const eventData = {
        content: "Test content",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
      };

      const result = await signEventFn(eventData);

      expect(result.signedEvent.sig).toBe("signature-string");
      expect(result.signedEvent.id).toBe("unknown");
      expect(result.signedEvent.pubkey).toBe("unknown");
    });

    it("should handle object return type with missing fields", async () => {
      mockWindowNostr.signEvent.mockResolvedValue({
        id: "event-123",
        // Missing pubkey and sig
      });

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const signEventFn = nostrAdapter.signEvent;

      const eventData = {
        content: "Test content",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
      };

      const result = await signEventFn(eventData);

      expect(result.signedEvent.id).toBe("event-123");
      expect(result.signedEvent.pubkey).toBe("unknown");
      expect(result.signedEvent.sig).toBe("unknown");
    });

    it("should use default kind if not provided", async () => {
      mockWindowNostr.signEvent.mockResolvedValue({
        id: "event-123",
        pubkey: "pubkey-123",
        sig: "sig-123",
      });

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const signEventFn = nostrAdapter.signEvent;

      const eventData = {
        content: "Test content",
        created_at: Math.floor(Date.now() / 1000),
        // kind not provided
        tags: [],
      };

      const result = await signEventFn(eventData);

      expect(result.nostrEvent.kind).toBe(1); // Default kind
    });

    it("should use empty tags array if not provided", async () => {
      mockWindowNostr.signEvent.mockResolvedValue({
        id: "event-123",
        pubkey: "pubkey-123",
        sig: "sig-123",
      });

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const signEventFn = nostrAdapter.signEvent;

      const eventData = {
        content: "Test content",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        // tags not provided
      };

      const result = await signEventFn(eventData);

      expect(result.nostrEvent.tags).toEqual([]);
    });

    it("recovers via primary signer failover when both initial and reconnect-retry attempts fail", async () => {
      vi.resetModules();
      // Both attempts against the configured signer fail with a connection-like
      // error; the third attempt (after primary-signer failover swaps in a new
      // signer) succeeds.
      const mockConfiguredSign = vi.fn().mockResolvedValueOnce({
        id: "event-remote",
        pubkey: "pubkey-remote",
        sig: "sig-remote",
      });
      const getActiveSigner = vi
        .fn()
        .mockRejectedValueOnce(new Error("websocket closed"))
        .mockRejectedValueOnce(new Error("subscription closed"))
        .mockResolvedValue({
          type: "nip46",
          signEvent: mockConfiguredSign,
        });

      const mockPrimaryFailover = vi.fn().mockResolvedValue({
        recovered: true,
      });

      vi.doMock("~/features/auth/signer", () => ({
        getActiveSignerConfig: () => ({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "bunker://example",
          clientSecretKeyHex: "aa",
        }),
        getActiveSigner,
        attemptPrimarySignerFailover: mockPrimaryFailover,
        tryBackgroundReconnect: vi.fn().mockResolvedValue(false),
        recordSuccessfulSign: vi.fn(),
        getActiveConnection: vi.fn().mockReturnValue(null),
        recordConnectionEvent: vi.fn(),
        emitRemoteSignerTimeoutEvent: vi.fn(),
        resetCachedSigner: vi.fn(),
        addConnectionLog: vi.fn(),
        updateSession: vi.fn(),
      }));

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const result = await nostrAdapter.signEvent({
        content: "test fallback",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
      });

      expect(mockPrimaryFailover).toHaveBeenCalledTimes(1);
      expect(result.signedEvent.id).toBe("event-remote");
      expect(mockConfiguredSign).toHaveBeenCalled();
    });

    it("does not invoke primary failover when no NIP-46 signer is configured", async () => {
      vi.resetModules();

      global.window = {
        nostr: undefined,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        setTimeout,
        clearTimeout,
      } as unknown as Window & typeof globalThis;

      const mockPrimaryFailover = vi.fn().mockResolvedValue({
        recovered: false,
      });

      vi.doMock("~/features/auth/signer", () => ({
        getActiveSignerConfig: () => null,
        getActiveSigner: vi.fn().mockResolvedValue(null),
        attemptPrimarySignerFailover: mockPrimaryFailover,
        tryBackgroundReconnect: vi.fn().mockResolvedValue(false),
        recordSuccessfulSign: vi.fn(),
        getActiveConnection: vi.fn().mockReturnValue(null),
        recordConnectionEvent: vi.fn(),
        emitRemoteSignerTimeoutEvent: vi.fn(),
        resetCachedSigner: vi.fn(),
        addConnectionLog: vi.fn(),
        updateSession: vi.fn(),
      }));

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      await expect(
        nostrAdapter.signEvent({
          content: "test no fallback",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
        })
      ).rejects.toThrow(/Nostr extension not found/);
      expect(mockPrimaryFailover).not.toHaveBeenCalled();

      // Ensure the promise chain fully settles before the test exits.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("signLongFormEvent - Tag Building", () => {
    it("should build tags with all optional fields", async () => {
      mockWindowNostr.signEvent.mockResolvedValue({
        id: "event-123",
        pubkey: "pubkey-123",
        sig: "sig-123",
      });

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");

      const eventData = {
        content: "Test content",
        title: "Test Title",
        summary: "Test Summary",
        image: "https://example.com/image.jpg",
        identifier: "test-identifier",
        publishedAt: Math.floor(Date.now() / 1000),
        tags: ["tag1", "tag2"],
      };

      const result = await nostrAdapter.signLongFormEvent(eventData);

      expect(result.nostrEvent.kind).toBe(30023);
      expect(result.nostrEvent.tags).toContainEqual(["title", "Test Title"]);
      expect(result.nostrEvent.tags).toContainEqual([
        "summary",
        "Test Summary",
      ]);
      expect(result.nostrEvent.tags).toContainEqual([
        "image",
        "https://example.com/image.jpg",
      ]);
      expect(result.nostrEvent.tags).toContainEqual(["d", "test-identifier"]);
      expect(result.nostrEvent.tags).toContainEqual([
        "published_at",
        String(eventData.publishedAt),
      ]);
      expect(result.nostrEvent.tags).toContainEqual(["t", "tag1"]);
      expect(result.nostrEvent.tags).toContainEqual(["t", "tag2"]);
    });

    it("should build tags without optional fields", async () => {
      mockWindowNostr.signEvent.mockResolvedValue({
        id: "event-123",
        pubkey: "pubkey-123",
        sig: "sig-123",
      });

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");

      const eventData = {
        content: "Test content",
        title: "", // Empty title - required by type but should not result in title tag
        // No optional fields (no summary, image, etc.)
      };

      const result = await nostrAdapter.signLongFormEvent(eventData);

      expect(result.nostrEvent.tags).toContainEqual([
        "r",
        "wss://relay.primal.net/",
      ]);
      expect(result.nostrEvent.tags).toContainEqual(["client", BRAND_NAME]);
      expect(result.nostrEvent.tags).not.toContainEqual(
        expect.arrayContaining(["title"])
      );
      expect(result.nostrEvent.tags).not.toContainEqual(
        expect.arrayContaining(["summary"])
      );
    });

    it("should trim and lowercase topic tags", async () => {
      mockWindowNostr.signEvent.mockResolvedValue({
        id: "event-123",
        pubkey: "pubkey-123",
        sig: "sig-123",
      });

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");

      const eventData = {
        title: "Test Title",
        content: "Test content",
        tags: ["  TAG1  ", "Tag2", "tag3"],
      };

      const result = await nostrAdapter.signLongFormEvent(eventData);

      expect(result.nostrEvent.tags).toContainEqual(["t", "tag1"]);
      expect(result.nostrEvent.tags).toContainEqual(["t", "tag2"]);
      expect(result.nostrEvent.tags).toContainEqual(["t", "tag3"]);
    });

    it("should skip empty topic tags", async () => {
      mockWindowNostr.signEvent.mockResolvedValue({
        id: "event-123",
        pubkey: "pubkey-123",
        sig: "sig-123",
      });

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");

      const eventData = {
        title: "Test Title",
        content: "Test content",
        tags: ["tag1", "", "   ", "tag2"],
      };

      const result = await nostrAdapter.signLongFormEvent(eventData);

      const topicTags = result.nostrEvent.tags.filter((tag) => tag[0] === "t");
      expect(topicTags).toHaveLength(2);
      expect(topicTags).toContainEqual(["t", "tag1"]);
      expect(topicTags).toContainEqual(["t", "tag2"]);
    });
  });

  describe("NIP-46 ping and switch_relays", () => {
    it("should delegate ping to bunker signer", async () => {
      const mockInner = {
        ping: vi.fn().mockResolvedValue(undefined),
        sendRequest: vi.fn(),
        close: vi.fn(),
        bp: { relays: ["wss://relay.primal.net"] },
      };
      const mockPool = {
        close: vi.fn(),
      };

      const { Nip46Signer } =
        await import("~/features/auth/nostr-signer.client");
      const signer = new Nip46Signer({
        pool: mockPool as never,
        inner: mockInner as never,
      });

      await signer.ping();

      expect(mockInner.ping).toHaveBeenCalledTimes(1);
    });

    it("should parse switch_relays response and normalize relay list", async () => {
      const mockInner = {
        ping: vi.fn(),
        sendRequest: vi
          .fn()
          .mockResolvedValue(
            JSON.stringify([
              "wss://relay.primal.net",
              " wss://relay.damus.io ",
              "ws://not-secure",
              "wss://relay.primal.net",
            ])
          ),
        close: vi.fn(),
        bp: { relays: ["wss://relay.primal.net"] },
      };
      const mockPool = {
        close: vi.fn(),
      };

      const { Nip46Signer } =
        await import("~/features/auth/nostr-signer.client");
      const signer = new Nip46Signer({
        pool: mockPool as never,
        inner: mockInner as never,
      });

      const relays = await signer.switchRelays();

      expect(relays).toEqual([
        "wss://relay.primal.net",
        "wss://relay.damus.io",
      ]);
    });

    it("should return null for malformed switch_relays payload", async () => {
      const mockInner = {
        ping: vi.fn(),
        sendRequest: vi.fn().mockResolvedValue("not-json"),
        close: vi.fn(),
        bp: { relays: ["wss://relay.primal.net"] },
      };
      const mockPool = {
        close: vi.fn(),
      };

      const { Nip46Signer } =
        await import("~/features/auth/nostr-signer.client");
      const signer = new Nip46Signer({
        pool: mockPool as never,
        inner: mockInner as never,
      });

      const relays = await signer.switchRelays();

      expect(relays).toBeNull();
    });

    it("should use ping in testConnection when available", async () => {
      vi.resetModules();
      const ping = vi.fn().mockResolvedValue(undefined);
      const getPublicKey = vi.fn().mockResolvedValue("pubkey-fallback");
      vi.doMock("~/features/auth/signer/nostr-signer-manager.client", () => ({
        getActiveSigner: vi.fn().mockResolvedValue({
          type: "nip46",
          ping,
          getPublicKey,
        }),
        getActiveSignerConfig: vi.fn().mockReturnValue({ type: "nip46" }),
      }));

      const { testConnection } =
        await import("~/features/auth/signer/remote-signer-health.client");
      const result = await testConnection(200);

      expect(result.healthy).toBe(true);
      expect(result.method).toBe("ping");
      expect(ping).toHaveBeenCalledTimes(1);
      expect(getPublicKey).not.toHaveBeenCalled();
    });
  });
});
