/**
 * Unit tests for Nostr.ts edge cases
 * Tests signEventFn, signLongFormEvent, and EditorJS conversion edge cases
 * Tests app/lib/nostr.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
    it("should retry when window.nostr is not available initially", async () => {
      // Dynamically import to get fresh function
      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const signEventFn = nostrAdapter.signEvent;

      // Initially window.nostr is undefined, then becomes available
      let callCount = 0;

      global.window = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        setTimeout,
        clearTimeout,
        get nostr() {
          callCount++;
          if (callCount < 3) {
            return undefined;
          }
          return mockWindowNostr;
        },
      } as unknown as Window & typeof globalThis;

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

    it("should throw error after max retries", async () => {
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

      // Use fake timers to speed up retry logic
      vi.useFakeTimers();
      const promise = signEventFn(eventData);

      // Fast-forward through retries
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(500);
      }

      await expect(promise).rejects.toThrow(
        "Nostr extension not found after retries"
      );
      vi.useRealTimers();
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

    it("should recover via primary signer fallback on remote connection failure", async () => {
      vi.resetModules();
      const mockConfiguredSign = vi.fn().mockResolvedValue({
        id: "event-remote",
        pubkey: "pubkey-remote",
        sig: "sig-remote",
      });
      const getActiveSigner = vi
        .fn()
        .mockRejectedValueOnce(new Error("websocket closed"))
        .mockResolvedValue({
          type: "nip46",
          signEvent: mockConfiguredSign,
        });

      const mockPrimaryFailover = vi.fn().mockResolvedValue({
        recovered: true,
      });

      vi.doMock("~/lib/nostr-signer-manager.client", () => ({
        getActiveSignerConfig: () => ({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "bunker://example",
          clientSecretKeyHex: "aa",
        }),
        getActiveSigner,
      }));
      vi.doMock("~/lib/primary-signer-failover.client", () => ({
        attemptPrimarySignerFailover: mockPrimaryFailover,
      }));

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      const result = await nostrAdapter.signEvent({
        content: "test fallback",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
      });

      expect(mockPrimaryFailover).toHaveBeenCalled();
      expect(result.signedEvent.id).toBe("event-remote");
      expect(mockConfiguredSign).toHaveBeenCalled();
    });

    it("should still throw extension error when fallback is unavailable", async () => {
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

      vi.doMock("~/lib/nostr-signer-manager.client", () => ({
        getActiveSignerConfig: () => null,
        getActiveSigner: vi.fn().mockResolvedValue(null),
      }));
      vi.doMock("~/lib/primary-signer-failover.client", () => ({
        attemptPrimarySignerFailover: mockPrimaryFailover,
      }));

      const { nostrAdapter } = await import("~/lib/nostr-adapter.client");
      await expect(
        nostrAdapter.signEvent({
          content: "test no fallback",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
        })
      ).rejects.toThrow("Nostr extension not found after retries");
      expect(mockPrimaryFailover).toHaveBeenCalledTimes(1);

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
      expect(result.nostrEvent.tags).toContainEqual(["client", "SmartFlow"]);
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
});
