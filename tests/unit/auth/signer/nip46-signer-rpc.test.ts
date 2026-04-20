/**
 * @vitest-environment jsdom
 *
 * Unit tests for `Nip46Signer`'s RPC contract.
 *
 * The wrapper exists for three reasons:
 *
 *   1. Per-RPC timeout: every NIP-46 method races a timeout (`bunker:<m>
 *      timeout`) so a misbehaving signer app can't hang the UI forever.
 *
 *   2. RPC serialization: `BunkerSigner.sendRequest` uses a single shared
 *      `serial`/`listeners` map. Concurrent callers (e.g. two parallel
 *      `signEvent` calls) would interleave their request IDs and confuse
 *      dispatch. We serialize through a promise-chain lock so one RPC
 *      completes (or fails) before the next starts.
 *
 *   3. Per-RPC fresh subscription: every RPC opens a NEW `pool.subscribe`
 *      on the bunker's relays + filter SYNCHRONOUSLY before invoking the
 *      inner BunkerSigner fn (which publishes the EVENT). Together with
 *      WebSocket frame ordering this guarantees the relay registers our
 *      REQ before our EVENT, so Primal's reply has somewhere to land
 *      even if `BunkerSigner.setupSubscription`'s persistent sub has
 *      gone ghost on the relay (silent reconnect, server eviction, the
 *      fromURI close-then-reopen-in-same-tick race, etc.). Nostrify's
 *      `NConnectSigner.send` works the same way — see
 *      `Nip46Signer.openPerRpcSubscription` for the full rationale.
 *
 * The wrapper still does NOT touch the bunker's persistent `subCloser`.
 * That sub remains open for the lifetime of the signer; the per-RPC
 * fresh sub is layered on top.
 */

import { describe, expect, it, vi } from "vitest";

import { Nip46Signer } from "~/features/auth/nostr-signer.client";

interface FakeSubCloser {
  close: ReturnType<typeof vi.fn>;
}

interface FakeBunkerSignerInternals {
  subCloser?: FakeSubCloser;
  isOpen: boolean;
  bp: { pubkey: string; relays: string[]; secret: null | string };
  // Internals consumed by `openPerRpcSubscription`. Real `BunkerSigner`
  // sets these in fromBunker/fromURI before our wrapper sees `inner`.
  secretKey: Uint8Array;
  conversationKey: Uint8Array;
  listeners: Record<
    string,
    { resolve: (value: string) => void; reject: (reason?: unknown) => void }
  >;
  waitingForAuth: Record<string, boolean>;
  // RPC surface
  getPublicKey: ReturnType<typeof vi.fn>;
  signEvent: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  sendRequest: ReturnType<typeof vi.fn>;
}

type FakeBunker = FakeBunkerSignerInternals;

function makeFakeBunker(
  overrides: Partial<FakeBunkerSignerInternals> = {}
): FakeBunker {
  const subCloser: FakeSubCloser = {
    close: vi.fn(async () => {
      // no-op
    }),
  };
  // 32-byte values that satisfy `nostr-tools` `getPublicKey` (just needs
  // a Uint8Array of length 32). The fresh-sub onevent never fires in the
  // unit tests because the fake pool's `subscribe` mock doesn't emit, so
  // `nip44Decrypt` is never invoked against the fake conversationKey.
  const secretKey = new Uint8Array(32).fill(7);
  const conversationKey = new Uint8Array(32).fill(0xab);
  const fake: FakeBunker = {
    subCloser,
    isOpen: true,
    bp: { pubkey: "00".repeat(32), relays: ["wss://test"], secret: null },
    secretKey,
    conversationKey,
    listeners: {},
    waitingForAuth: {},
    getPublicKey: vi.fn().mockResolvedValue("pubkey-hex"),
    signEvent: vi
      .fn()
      .mockImplementation((evt: Record<string, unknown>) =>
        Promise.resolve({ ...evt, id: "evt-id", sig: "sig-hex" })
      ),
    ping: vi.fn().mockResolvedValue(undefined),
    sendRequest: vi.fn().mockResolvedValue("null"),
    ...overrides,
  };
  return fake;
}

type SignerCtorInput = ConstructorParameters<typeof Nip46Signer>[0];

interface FakePool {
  subscribe: ReturnType<typeof vi.fn>;
}

function makeFakePool(): FakePool {
  return {
    // Return a fresh closer per call so each RPC's per-sub close() can be
    // asserted independently.
    subscribe: vi.fn(() => ({
      close: vi.fn(async () => {
        // no-op
      }),
    })),
  };
}

function makeSigner(fake: FakeBunker): {
  signer: Nip46Signer;
  pool: FakePool;
} {
  const inner = fake as unknown as SignerCtorInput["inner"];
  const pool = makeFakePool();
  return {
    signer: new Nip46Signer({
      pool: pool as unknown as SignerCtorInput["pool"],
      inner,
    }),
    pool,
  };
}

describe("Nip46Signer RPC dispatch", () => {
  it("forwards getPublicKey to the inner BunkerSigner", async () => {
    const fake = makeFakeBunker();
    const { signer, pool } = makeSigner(fake);

    await expect(signer.getPublicKey()).resolves.toBe("pubkey-hex");
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
    // We open a fresh per-RPC subscription on the bunker relays before
    // every RPC so the relay sees our REQ before the EVENT publish (see
    // `openPerRpcSubscription`). One RPC => exactly one subscribe call.
    expect(pool.subscribe).toHaveBeenCalledTimes(1);
  });

  it("opens the per-RPC fresh subscription BEFORE invoking the inner fn", async () => {
    const fake = makeFakeBunker();
    const { signer, pool } = makeSigner(fake);

    await signer.signEvent({ kind: 1, content: "hi", created_at: 0, tags: [] });

    const subOrder = pool.subscribe.mock.invocationCallOrder[0];
    const innerOrder = fake.signEvent.mock.invocationCallOrder[0];
    expect(subOrder).toBeDefined();
    expect(innerOrder).toBeDefined();
    expect(subOrder).toBeLessThan(innerOrder!);
  });

  it("opens the per-RPC sub on the bunker's relays with the correct NIP-46 filter", async () => {
    const relays = ["wss://relay.primal.net", "wss://nos.lol/"];
    const fake = makeFakeBunker({
      bp: { pubkey: "11".repeat(32), relays, secret: null },
    });
    const { signer, pool } = makeSigner(fake);

    await signer.getPublicKey();

    const call = pool.subscribe.mock.calls[0] as
      | [string[], Record<string, unknown>, Record<string, unknown>]
      | undefined;
    expect(call).toBeDefined();
    const callRelays = call![0];
    const callFilter = call![1];
    expect(callRelays).toEqual(relays);
    expect(callFilter).toMatchObject({
      kinds: [24133],
      authors: ["11".repeat(32)],
    });
    // The "#p" tag value is `getPublicKey(secretKey)`; we don't pin its
    // exact hex here (it depends on the deterministic fake key), only
    // that the filter scopes incoming events to us.
    expect(Array.isArray(callFilter["#p"])).toBe(true);
  });

  it("closes the per-RPC fresh sub after the RPC settles", async () => {
    const fake = makeFakeBunker();
    const { signer, pool } = makeSigner(fake);

    await signer.getPublicKey();

    const closer = pool.subscribe.mock.results[0]?.value as
      | { close: ReturnType<typeof vi.fn> }
      | undefined;
    expect(closer?.close).toHaveBeenCalledTimes(1);
  });

  it("closes the per-RPC fresh sub even when the inner RPC throws", async () => {
    const fake = makeFakeBunker();
    fake.getPublicKey = vi.fn().mockRejectedValue(new Error("boom"));
    const { signer, pool } = makeSigner(fake);

    await expect(signer.getPublicKey()).rejects.toThrow("boom");

    const closer = pool.subscribe.mock.results[0]?.value as
      | { close: ReturnType<typeof vi.fn> }
      | undefined;
    expect(closer?.close).toHaveBeenCalledTimes(1);
  });

  it("forwards signEvent to the inner BunkerSigner", async () => {
    const fake = makeFakeBunker();
    const { signer, pool } = makeSigner(fake);

    const result = await signer.signEvent({
      kind: 1,
      content: "hi",
      created_at: 0,
      tags: [],
    });
    expect(fake.signEvent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: "evt-id", sig: "sig-hex" });
    expect(pool.subscribe).toHaveBeenCalledTimes(1);
  });

  it("does not touch the bunker's persistent subCloser between RPCs", async () => {
    const fake = makeFakeBunker();
    const initialCloser = fake.subCloser;
    const { signer } = makeSigner(fake);

    await signer.getPublicKey();
    await signer.signEvent({
      kind: 1,
      content: "hi",
      created_at: 0,
      tags: [],
    });

    // Per-RPC fresh subs live on `pool.subscribe()` returns and are closed
    // by `Nip46Signer.rpc`'s finally; bunker's own setupSubscription
    // closer must remain untouched for the lifetime of the signer.
    expect(fake.subCloser).toBe(initialCloser);
    expect(initialCloser?.close).not.toHaveBeenCalled();
  });

  it("opens one fresh sub per RPC (no reuse across calls)", async () => {
    const fake = makeFakeBunker();
    const { signer, pool } = makeSigner(fake);

    await signer.getPublicKey();
    await signer.signEvent({
      kind: 1,
      content: "hi",
      created_at: 0,
      tags: [],
    });

    expect(pool.subscribe).toHaveBeenCalledTimes(2);
    const closer1 = pool.subscribe.mock.results[0]?.value as
      | { close: ReturnType<typeof vi.fn> }
      | undefined;
    const closer2 = pool.subscribe.mock.results[1]?.value as
      | { close: ReturnType<typeof vi.fn> }
      | undefined;
    expect(closer1?.close).toHaveBeenCalledTimes(1);
    expect(closer2?.close).toHaveBeenCalledTimes(1);
    expect(closer1).not.toBe(closer2);
  });

  it("serializes concurrent RPCs so two callers can't interleave", async () => {
    const fake = makeFakeBunker();
    const order: string[] = [];

    fake.getPublicKey = vi.fn().mockImplementation(async () => {
      order.push("rpc:get_public_key:start");
      await new Promise((r) => setTimeout(r, 10));
      order.push("rpc:get_public_key:end");
      return "pubkey-hex";
    });
    fake.signEvent = vi
      .fn()
      .mockImplementation(async (evt: Record<string, unknown>) => {
        order.push("rpc:sign_event:start");
        await new Promise((r) => setTimeout(r, 10));
        order.push("rpc:sign_event:end");
        return { ...evt, id: "evt-id", sig: "sig-hex" };
      });

    const { signer } = makeSigner(fake);

    await Promise.all([
      signer.getPublicKey(),
      signer.signEvent({
        kind: 1,
        content: "hi",
        created_at: 0,
        tags: [],
      }),
    ]);

    expect(order).toEqual([
      "rpc:get_public_key:start",
      "rpc:get_public_key:end",
      "rpc:sign_event:start",
      "rpc:sign_event:end",
    ]);
  });

  it("releases the lock when an RPC throws so the next call can proceed", async () => {
    const fake = makeFakeBunker();
    fake.getPublicKey = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("pubkey-hex");

    const { signer } = makeSigner(fake);

    await expect(signer.getPublicKey()).rejects.toThrow("boom");
    await expect(signer.getPublicKey()).resolves.toBe("pubkey-hex");
    expect(fake.getPublicKey).toHaveBeenCalledTimes(2);
  });

  it("rejects with `bunker:<method> timeout` when every retry attempt stalls", async () => {
    vi.useFakeTimers();
    try {
      const fake = makeFakeBunker();
      // Never resolves on any attempt — simulates a wedged signer app.
      fake.getPublicKey = vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            // intentionally never resolves
          })
      );

      const { signer, pool } = makeSigner(fake);

      const pending = signer.getPublicKey();
      // Attach a catch handler so vitest doesn't flag the rejection as
      // unhandled while we advance fake timers.
      const settled = pending.catch((err: unknown) => err);
      // NIP46_RPC_TIMEOUTS.getPublicKey is 30 s; advance past it. The
      // retry loop will fire ~4 attempts inside that budget.
      await vi.advanceTimersByTimeAsync(30_000);
      const result = await settled;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe("bunker:get_public_key timeout");
      // Per-attempt is 7 s; in a 30 s budget we expect at least 4 attempts.
      expect(fake.getPublicKey.mock.calls.length).toBeGreaterThanOrEqual(4);
      // Each retry opens a fresh per-RPC sub.
      expect(pool.subscribe.mock.calls.length).toBeGreaterThanOrEqual(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries on per-attempt timeout and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    try {
      const fake = makeFakeBunker();
      // First attempt hangs (silent Primal drop), second attempt resolves.
      fake.getPublicKey = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise(() => {
              // intentionally never resolves — the per-attempt timer fires
              // and the wrapper publishes a fresh EVENT id for attempt #2.
            })
        )
        .mockResolvedValueOnce("pubkey-hex");

      const { signer, pool } = makeSigner(fake);

      const pending = signer.getPublicKey();
      const settled = pending.then(
        (v) => v,
        (err: unknown) => err
      );
      // Advance past the per-attempt budget (7 s) so attempt #1 times out
      // and attempt #2 fires.
      await vi.advanceTimersByTimeAsync(7_500);
      const result = await settled;
      expect(result).toBe("pubkey-hex");
      expect(fake.getPublicKey).toHaveBeenCalledTimes(2);
      // One fresh sub per attempt — both opened, both closed.
      expect(pool.subscribe).toHaveBeenCalledTimes(2);
      const closer1 = pool.subscribe.mock.results[0]?.value as
        | { close: ReturnType<typeof vi.fn> }
        | undefined;
      const closer2 = pool.subscribe.mock.results[1]?.value as
        | { close: ReturnType<typeof vi.fn> }
        | undefined;
      expect(closer1?.close).toHaveBeenCalledTimes(1);
      expect(closer2?.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry switch_relays on per-attempt timeout (single publish, opportunistic)", async () => {
    vi.useFakeTimers();
    try {
      const fake = makeFakeBunker();
      // Primal Signer never replies to switch_relays — simulate that.
      fake.sendRequest = vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            // intentionally never resolves
          })
      );

      const { signer, pool } = makeSigner(fake);

      const pending = signer.switchRelays();
      const settled = pending.then(
        (v) => v,
        (err: unknown) => err
      );
      // NIP46_RPC_TIMEOUTS.switchRelays is 8 s. With retry disabled the
      // wrapper should fire exactly one publish and one fresh sub, then
      // surface `bunker:switch_relays timeout` at the 8 s mark — not
      // re-publish a second event into Primal's session (which is what
      // the retry path would do, contributing to damus.io's per-client
      // rate limit).
      await vi.advanceTimersByTimeAsync(8_500);
      const result = await settled;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe("bunker:switch_relays timeout");
      expect(fake.sendRequest).toHaveBeenCalledTimes(1);
      expect(pool.subscribe).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry on non-timeout errors", async () => {
    const fake = makeFakeBunker();
    fake.getPublicKey = vi
      .fn()
      .mockRejectedValueOnce(new Error("permission_denied"));
    const { signer, pool } = makeSigner(fake);

    await expect(signer.getPublicKey()).rejects.toThrow("permission_denied");
    // No retry on application errors — surfaces immediately.
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
    expect(pool.subscribe).toHaveBeenCalledTimes(1);
  });
});

/**
 * Tests for the (intentional) ABSENCE of any publish-relay restriction on
 * `inner.pool`. The contract:
 *
 *   - `Nip46Signer` must NOT collapse multi-relay publish targets down to a
 *     single relay. Both `publish` and `subscribe` calls must reach the
 *     underlying pool with the EVENT/REQ fanned out to every relay the
 *     caller (i.e. `nostr-tools`' `BunkerSigner.sendRequest`) asked for.
 *
 *   - This mirrors `@nostrify/nostrify`'s `NConnectSigner` — used by Ditto
 *     via `pool.group(login.data.relays)` — which fans NIP-46 EVENTs across
 *     every advertised bunker relay. Our previous single-relay restriction
 *     broke Primal cold-reopen sign because Primal's iOS bunker can wake up
 *     subscribed to whichever of its 3 advertised relays its push pipeline
 *     chooses; restricting to one relay can land the EVENT in the void.
 *
 *   - The diagnostic logging wrapper IS allowed to wrap the pool, but it
 *     must not change the relay list passed through to the underlying pool.
 */
describe("Nip46Signer bunker pool wrapping", () => {
  type PublishFn = (relays: string[], event: unknown) => Array<Promise<string>>;
  type SubscribeFn = (
    relays: string[],
    filter: Record<string, unknown>,
    params: Record<string, unknown>
  ) => { close: () => Promise<void> };

  interface InnerWithPool {
    pool: { publish: PublishFn; subscribe: SubscribeFn };
    bp: { pubkey: string; relays: string[]; secret: null | string };
  }

  function makeBunkerWithPool(relays: string[]): {
    fake: FakeBunker;
    innerPoolPublish: ReturnType<typeof vi.fn<PublishFn>>;
    innerPoolSubscribe: ReturnType<typeof vi.fn<SubscribeFn>>;
  } {
    const fake = makeFakeBunker({
      bp: { pubkey: "bunker-pubkey", relays, secret: null },
    });
    const innerPoolPublish = vi.fn<PublishFn>(() =>
      relays.map(() => Promise.resolve(""))
    );
    const innerPoolSubscribe = vi.fn<SubscribeFn>(() => ({
      close: vi.fn(async () => {
        // no-op
      }),
    }));
    (fake as unknown as InnerWithPool).pool = {
      publish: innerPoolPublish,
      subscribe: innerPoolSubscribe,
    };
    return { fake, innerPoolPublish, innerPoolSubscribe };
  }

  it("publish fans out to every relay in bp.relays — no single-relay restriction", () => {
    const relays = [
      "wss://relay.primal.net",
      "wss://relay.damus.io",
      "wss://nos.lol/",
    ];
    const { fake, innerPoolPublish } = makeBunkerWithPool(relays);
    new Nip46Signer({
      pool: makeFakePool() as unknown as SignerCtorInput["pool"],
      inner: fake as unknown as SignerCtorInput["inner"],
    });

    const wrappedPool = (fake as unknown as InnerWithPool).pool;
    void wrappedPool.publish(relays, {
      id: "evt",
      kind: 24133,
      pubkey: "00".repeat(32),
      created_at: 0,
      tags: [],
      content: "",
    });

    expect(innerPoolPublish).toHaveBeenCalledTimes(1);
    expect(innerPoolPublish.mock.calls[0]?.[0]).toEqual(relays);
  });

  it("subscribe is forwarded with the full relay list intact", () => {
    const relays = [
      "wss://relay.primal.net",
      "wss://relay.damus.io",
      "wss://nos.lol/",
    ];
    const { fake, innerPoolSubscribe } = makeBunkerWithPool(relays);
    new Nip46Signer({
      pool: makeFakePool() as unknown as SignerCtorInput["pool"],
      inner: fake as unknown as SignerCtorInput["inner"],
    });

    const wrappedPool = (fake as unknown as InnerWithPool).pool;
    wrappedPool.subscribe(relays, { kinds: [24133] }, {});

    expect(innerPoolSubscribe).toHaveBeenCalledTimes(1);
    expect(innerPoolSubscribe.mock.calls[0]?.[0]).toEqual(relays);
  });
});
