/**
 * Unit tests for `Nip46Signer`'s RPC contract.
 *
 * The wrapper exists for two reasons:
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
 * The wrapper does NOT touch the bunker's subscription. Earlier revisions
 * closed and reopened the REQ subscription before every RPC to "guarantee"
 * the REQ landed before the EVENT; that close/open dance raced the relay
 * and lost Primal's `get_public_key` reply ~50 % of the time on iOS Safari.
 * We now trust `BunkerSigner.setupSubscription` (called by `fromBunker` /
 * `fromURI`) and leave the sub alone for the lifetime of the signer, the
 * way Ditto's `@nostrify` `NConnectSigner` does.
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
  // RPC surface
  getPublicKey: ReturnType<typeof vi.fn>;
  signEvent: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
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
  const fake: FakeBunker = {
    subCloser,
    isOpen: true,
    bp: { pubkey: "bunker-pubkey", relays: ["wss://test"], secret: null },
    getPublicKey: vi.fn().mockResolvedValue("pubkey-hex"),
    signEvent: vi
      .fn()
      .mockImplementation((evt: Record<string, unknown>) =>
        Promise.resolve({ ...evt, id: "evt-id", sig: "sig-hex" })
      ),
    ping: vi.fn().mockResolvedValue(undefined),
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
    subscribe: vi.fn(),
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
    // We do NOT touch the relay subscription. BunkerSigner already opened
    // its persistent sub in fromBunker/fromURI before our wrapper was ever
    // constructed; meddling with it caused the iOS Safari sign-in race.
    expect(pool.subscribe).not.toHaveBeenCalled();
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
    expect(pool.subscribe).not.toHaveBeenCalled();
  });

  it("does not touch the bunker's subCloser between RPCs", async () => {
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

    // The sub the bunker installed at construction time must still be the
    // sub the bunker is using after our RPCs. Replacing it (the way the
    // old per-RPC pre-warm did) is exactly what raced the relay.
    expect(fake.subCloser).toBe(initialCloser);
    expect(initialCloser?.close).not.toHaveBeenCalled();
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

  it("rejects with `bunker:<method> timeout` when the inner RPC stalls", async () => {
    vi.useFakeTimers();
    try {
      const fake = makeFakeBunker();
      // Never resolves — simulates a wedged signer-app.
      fake.getPublicKey = vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            // intentionally never resolves
          })
      );

      const { signer } = makeSigner(fake);

      const pending = signer.getPublicKey();
      // Attach a catch handler so vitest doesn't flag the rejection as
      // unhandled while we advance fake timers.
      const settled = pending.catch((err: unknown) => err);
      // NIP46_RPC_TIMEOUTS.getPublicKey is 30 s; advance past it.
      await vi.advanceTimersByTimeAsync(30_000);
      const result = await settled;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe("bunker:get_public_key timeout");
    } finally {
      vi.useRealTimers();
    }
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
    void wrappedPool.publish(relays, { id: "evt", kind: 24133 });

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
