import { beforeEach, describe, expect, it, vi } from "vitest";

// Avoid pulling in real Redis / ioredis in tests.
vi.mock("~/lib/redis-cache.server", () => ({
  buildCacheKey: vi.fn(() => "key"),
  getOrSetJson: vi.fn(async (input: { compute: () => Promise<unknown> }) => {
    return await input.compute();
  }),
}));

// Mock nostr-tools so the test doesn't do crypto or network.
vi.mock("nostr-tools", () => {
  class MockPool {
    static nextGetResult: unknown = null;
    get = vi.fn(async () => MockPool.nextGetResult);
    list = vi.fn(async () => []);
    close = vi.fn();
  }
  return {
    nip04: { encrypt: vi.fn(() => "enc") },
    finalizeEvent: vi.fn(() => ({ id: "evt-1", pubkey: "pk", kind: 4 })),
    nip19: {
      decode: vi.fn((v: string) => {
        if (v.startsWith("nsec")) {
          return { type: "nsec", data: new Uint8Array(32) };
        }
        return { type: "npub", data: "f".repeat(64) };
      }),
    },
    SimplePool: MockPool,
  };
});

import { DEFAULT_USER_WRITE_RELAYS } from "~/features/relays/relay-constants";
import { sendNostrDirectMessage } from "~/lib/nostr.messenger.server";

async function setNextPoolGetResult(value: unknown) {
  const mod = await import("nostr-tools");
  (mod.SimplePool as unknown as { nextGetResult: unknown }).nextGetResult =
    value;
}

describe("sendNostrDirectMessage relay targeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["NOSTR_PUBLISHER_URL"] = "https://publisher.example/publish";
    process.env["NOSTR_NSEC"] = "nsec1test";
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  });

  it("falls back to DEFAULT_USER_WRITE_RELAYS when no NIP-65 relay list found", async () => {
    await setNextPoolGetResult(null);

    await sendNostrDirectMessage("f".repeat(64), "hello");

    const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    if (!fetchCall) throw new Error("fetch was not called");
    const bodyRaw = (fetchCall[1] as { body?: unknown } | undefined)?.body;
    if (typeof bodyRaw !== "string") throw new Error("fetch body missing");
    const body = JSON.parse(bodyRaw) as { relays: string[] };
    expect(body.relays).toEqual(DEFAULT_USER_WRITE_RELAYS);
  });

  it("uses recipient read/unmarked relays + fallback", async () => {
    await setNextPoolGetResult({
      tags: [
        ["r", "wss://relay.read.example", "read"],
        ["r", "wss://relay.unmarked.example"],
        ["r", "wss://relay.write.example", "write"],
      ],
    });

    await sendNostrDirectMessage("f".repeat(64), "hello");

    const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    if (!fetchCall) throw new Error("fetch was not called");
    const bodyRaw = (fetchCall[1] as { body?: unknown } | undefined)?.body;
    if (typeof bodyRaw !== "string") throw new Error("fetch body missing");
    const body = JSON.parse(bodyRaw) as { relays: string[] };

    expect(body.relays).toContain("wss://relay.read.example");
    expect(body.relays).toContain("wss://relay.unmarked.example");
    expect(body.relays).not.toContain("wss://relay.write.example");
    // Always includes fallback
    for (const r of DEFAULT_USER_WRITE_RELAYS) {
      expect(body.relays).toContain(r);
    }
  });
});
