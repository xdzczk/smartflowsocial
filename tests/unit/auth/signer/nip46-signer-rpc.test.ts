/**
 * Unit tests for `Nip46Signer`'s per-RPC subscription pre-warm.
 *
 * Background: `nostr-tools`' `BunkerSigner` opens its REQ subscription and
 * publishes the EVENT in the same tick. We want to guarantee the REQ hits the
 * wire BEFORE the EVENT and is registered (EOSE) on the relay so the bunker's
 * reply is delivered to us in real time.
 *
 * `Nip46Signer` does this by:
 *
 *   1. Awaiting the close of whatever `subCloser` the bunker had.
 *   2. Calling `pool.subscribe` so the REQ goes out.
 *   3. Awaiting EOSE (with a short fallback timeout) so we know the relay
 *      has the sub registered before we publish the EVENT.
 *   4. Handing the new closer to the bunker via `inner.subCloser` so its own
 *      RPC dispatch and `setupSubscription()` short-circuit transparently.
 *
 * These tests exercise that contract with a fake bunker + fake pool so we
 * don't need a real relay.
 */

import { describe, expect, it, vi } from "vitest";

import { Nip46Signer } from "~/features/auth/nostr-signer.client";

interface FakeSubCloser {
  close: ReturnType<typeof vi.fn>;
}

interface SubscribeParams {
  oneose?: () => void;
  onevent?: (event: { content: string }) => void;
  onclose?: (reason?: string) => void;
}

interface FakeBunkerSignerInternals {
  subCloser?: FakeSubCloser;
  isOpen: boolean;
  // Real BunkerSigner fields the per-RPC pre-warm reads. We don't actually
  // exercise the bytes here; the fake pool stubs out `subscribe` and never
  // calls `nip44Decrypt`, so any 32-byte buffer works.
  secretKey: Uint8Array;
  conversationKey: Uint8Array;
  bp: { pubkey: string; relays: string[]; secret: null | string };
  listeners: Record<
    string,
    { resolve: (value: string) => void; reject: (err: unknown) => void }
  >;
  waitingForAuth: Record<string, boolean>;
  params: { onauth?: (url: string) => void };
  // RPC surface
  getPublicKey: ReturnType<typeof vi.fn>;
  signEvent: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
}

type FakeBunker = FakeBunkerSignerInternals & {
  __subCloseCalls: string[];
  __subscribeCalls: number;
};

function makeKey(filler: number): Uint8Array {
  const k = new Uint8Array(32);
  k.fill(filler);
  return k;
}

function makeFakeBunker(
  overrides: Partial<FakeBunkerSignerInternals> = {}
): FakeBunker {
  const subCloseCalls: string[] = [];
  const subCloser: FakeSubCloser = {
    close: vi.fn(async (reason?: string) => {
      subCloseCalls.push(reason ?? "");
    }),
  };
  const fake: FakeBunker = {
    subCloser,
    isOpen: true,
    secretKey: makeKey(0x11),
    conversationKey: makeKey(0x22),
    bp: { pubkey: "bunker-pubkey", relays: ["wss://test"], secret: null },
    listeners: {},
    waitingForAuth: {},
    params: {},
    getPublicKey: vi.fn().mockResolvedValue("pubkey-hex"),
    signEvent: vi
      .fn()
      .mockImplementation((evt: Record<string, unknown>) =>
        Promise.resolve({ ...evt, id: "evt-id", sig: "sig-hex" })
      ),
    ping: vi.fn().mockResolvedValue(undefined),
    ...overrides,
    __subCloseCalls: subCloseCalls,
    __subscribeCalls: 0,
  };
  return fake;
}

type SignerCtorInput = ConstructorParameters<typeof Nip46Signer>[0];

interface FakePool {
  subscribe: ReturnType<typeof vi.fn>;
}

function makeFakePool(fake: FakeBunker): FakePool {
  return {
    subscribe: vi.fn(
      (
        _relays: string[],
        _filter: Record<string, unknown>,
        params: SubscribeParams
      ) => {
        fake.__subscribeCalls++;
        // Real relays send EOSE asynchronously after the REQ is registered.
        // The pre-warm awaits it, so we have to fire it (otherwise tests
        // would block on the 5s fallback timeout).
        queueMicrotask(() => params.oneose?.());
        return {
          close: vi.fn(async (_reason?: string) => {
            params.onclose?.(_reason);
          }),
        };
      }
    ),
  };
}

function makeSigner(fake: FakeBunker): {
  signer: Nip46Signer;
  pool: FakePool;
} {
  const inner = fake as unknown as SignerCtorInput["inner"];
  const pool = makeFakePool(fake);
  return {
    signer: new Nip46Signer({
      pool: pool as unknown as SignerCtorInput["pool"],
      inner,
    }),
    pool,
  };
}

describe("Nip46Signer per-RPC subscription pre-warm", () => {
  it("closes the existing BunkerSigner subscription and opens a fresh one before each RPC", async () => {
    const fake = makeFakeBunker();
    const initialCloser = fake.subCloser;
    const { signer, pool } = makeSigner(fake);

    await signer.getPublicKey();

    expect(initialCloser?.close).toHaveBeenCalledWith("nip46:per-rpc-refresh");
    expect(initialCloser?.close).toHaveBeenCalledTimes(1);
    expect(pool.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
    // After pre-warm, subCloser is the closer we just opened (not undefined),
    // which is exactly what makes BunkerSigner.sendRequest skip its own
    // setupSubscription and go straight to publishing the EVENT.
    expect(fake.subCloser).toBeDefined();
    expect(fake.subCloser).not.toBe(initialCloser);

    // Order: old close + new subscribe must complete before the inner RPC
    // fires, otherwise the EVENT could race the REQ on the relay.
    const closeOrder = initialCloser?.close.mock.invocationCallOrder[0] ?? 0;
    const subscribeOrder = pool.subscribe.mock.invocationCallOrder[0] ?? 0;
    const rpcOrder = fake.getPublicKey.mock.invocationCallOrder[0] ?? 0;
    expect(closeOrder).toBeLessThan(subscribeOrder);
    expect(subscribeOrder).toBeLessThan(rpcOrder);
  });

  it("refreshes the subscription on every RPC, not just the first", async () => {
    const fake = makeFakeBunker();
    const firstCloser = fake.subCloser;
    const { signer, pool } = makeSigner(fake);

    await signer.getPublicKey();
    const secondCloser = fake.subCloser;

    await signer.signEvent({
      kind: 1,
      content: "hi",
      created_at: 0,
      tags: [],
    });
    const thirdCloser = fake.subCloser;

    expect(firstCloser?.close).toHaveBeenCalledTimes(1);
    expect(secondCloser?.close).toHaveBeenCalledTimes(1);
    expect(secondCloser).not.toBe(firstCloser);
    expect(thirdCloser).not.toBe(secondCloser);
    expect(pool.subscribe).toHaveBeenCalledTimes(2);
    expect(fake.signEvent).toHaveBeenCalledTimes(1);
  });

  it("skips the refresh when the BunkerSigner is closed (isOpen=false)", async () => {
    const fake = makeFakeBunker({ isOpen: false });
    const initialCloser = fake.subCloser;
    const { signer, pool } = makeSigner(fake);

    await signer.getPublicKey();

    expect(initialCloser?.close).not.toHaveBeenCalled();
    expect(pool.subscribe).not.toHaveBeenCalled();
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it("opens a fresh subscription even when there is no prior subCloser", async () => {
    const fake = makeFakeBunker({ subCloser: undefined });
    const { signer, pool } = makeSigner(fake);

    await expect(signer.getPublicKey()).resolves.toBe("pubkey-hex");
    expect(pool.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.subCloser).toBeDefined();
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it("still proceeds with the RPC if the previous subscription's close throws", async () => {
    const fake = makeFakeBunker();
    const throwingCloser: FakeSubCloser = {
      close: vi.fn().mockRejectedValue(new Error("relay closed")),
    };
    fake.subCloser = throwingCloser;

    const { signer, pool } = makeSigner(fake);

    await expect(signer.getPublicKey()).resolves.toBe("pubkey-hex");
    expect(throwingCloser.close).toHaveBeenCalledTimes(1);
    expect(pool.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent RPCs so a pre-warm cannot drop another's reply", async () => {
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

    // The lock must keep one call fully done before the next starts.
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
      pool: makeFakePool(fake) as unknown as SignerCtorInput["pool"],
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
      pool: makeFakePool(fake) as unknown as SignerCtorInput["pool"],
      inner: fake as unknown as SignerCtorInput["inner"],
    });

    const wrappedPool = (fake as unknown as InnerWithPool).pool;
    wrappedPool.subscribe(relays, { kinds: [24133] }, {});

    expect(innerPoolSubscribe).toHaveBeenCalledTimes(1);
    expect(innerPoolSubscribe.mock.calls[0]?.[0]).toEqual(relays);
  });
});
