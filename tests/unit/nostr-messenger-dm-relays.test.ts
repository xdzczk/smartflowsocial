import { beforeEach, describe, expect, it, vi } from "vitest";

// Provide env so sendNostrDirectMessage can reach the fetch path
vi.mock("~/lib/env.server", () => ({
  env: {
    NOSTR_PUBLISHER_URL: "https://publisher.example/publish",
    NOSTR_NSEC: "nsec1test",
    NODE_ENV: "test",
  },
}));

// Avoid pulling in real Redis / ioredis in tests.
vi.mock("~/lib/redis-cache.server", () => ({
  buildCacheKey: vi.fn(() => "key"),
  getOrSetJson: vi.fn(async (input: { compute: () => Promise<unknown> }) => {
    return await input.compute();
  }),
}));

vi.mock("nostr-tools/nip17", () => ({
  wrapManyEvents: vi.fn(() => [
    {
      kind: 1059,
      tags: [["p", "e".repeat(64)]],
      id: "gw-sender",
      content: "c1",
    },
    {
      kind: 1059,
      tags: [["p", "f".repeat(64)]],
      id: "gw-recipient",
      content: "c2",
    },
  ]),
}));

vi.mock("nostr-tools/pure", () => ({
  getPublicKey: vi.fn(() => "e".repeat(64)),
}));

// Mock nostr-tools so the test doesn't do crypto or network.
vi.mock("nostr-tools", () => {
  class MockPool {
    /** When non-empty, `get` returns `shift()` each call; else `nextGetResult`. */
    static sequence: unknown[] = [];
    static nextGetResult: unknown = null;
    get = vi.fn(async () => {
      if (MockPool.sequence.length > 0) {
        const v = MockPool.sequence.shift();
        return v === undefined ? null : v;
      }
      return MockPool.nextGetResult;
    });
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
  const Pool = mod.SimplePool as unknown as {
    nextGetResult: unknown;
    sequence: unknown[];
  };
  Pool.sequence = [];
  Pool.nextGetResult = value;
}

async function setPoolGetSequence(values: unknown[]) {
  const mod = await import("nostr-tools");
  const Pool = mod.SimplePool as unknown as {
    nextGetResult: unknown;
    sequence: unknown[];
  };
  Pool.nextGetResult = null;
  Pool.sequence = [...values];
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

  it("when kind 10050 inbox exists, publishes two gift wraps then NIP-04", async () => {
    await setPoolGetSequence([
      { tags: [["relay", "wss://dm.inbox.example"]] },
      null,
      null,
    ]);

    const result = await sendNostrDirectMessage("f".repeat(64), "hello");

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.length).toBe(3);

    expect(result).not.toEqual(false);
    expect(result).toMatchObject({
      nip17: { attempted: true, recipientPublished: true },
      nip04: { success: true },
    });

    const bodies = fetchMock.mock.calls.map(
      (c) =>
        JSON.parse((c[1] as { body: string }).body) as {
          event: { kind: number };
        }
    );
    expect(bodies).toHaveLength(3);
    expect(bodies[0]!.event.kind).toBe(1059);
    expect(bodies[1]!.event.kind).toBe(1059);
    expect(bodies[2]!.event.kind).toBe(4);
  });

  it("still publishes NIP-04 when NIP-17 gift wrap publish fails", async () => {
    await setPoolGetSequence([
      { tags: [["relay", "wss://dm.inbox.example"]] },
      null,
      null,
    ]);

    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "relay error",
      })
      .mockResolvedValueOnce({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendNostrDirectMessage("f".repeat(64), "hello");

    expect(fetchMock.mock.calls.length).toBe(3);
    expect(result).not.toEqual(false);
    expect(result).toMatchObject({
      success: true,
      nip04: { success: true },
    });
    expect(
      (result as { nip17?: { errors?: string[] } }).nip17?.errors?.length
    ).toBeGreaterThan(0);
  });
});
