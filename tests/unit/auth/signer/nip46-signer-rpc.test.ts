/**
 * Unit tests for `Nip46Signer`'s per-RPC subscription refresh behavior.
 *
 * The bug we are guarding against: `nostr-tools`' `BunkerSigner` keeps a
 * single long-lived REQ subscription that drifts in real use (relay
 * reconnects, signer-app idle, etc.). When that happens, replies from the
 * remote signer hit the relay but never reach `BunkerSigner.listeners`, and
 * `signEvent` hangs forever. `@nostrify/nostrify`'s `NConnectSigner.send`
 * (used by Ditto) avoids this by opening a new REQ per RPC. `Nip46Signer`
 * mirrors that here by clearing `subCloser` before each RPC so the next
 * `sendRequest` runs `setupSubscription()` again.
 */

import { describe, expect, it, vi } from "vitest";

import { Nip46Signer } from "~/features/auth/nostr-signer.client";

interface FakeSubCloser {
  close: ReturnType<typeof vi.fn>;
}

interface FakeBunkerSignerInternals {
  subCloser?: FakeSubCloser;
  isOpen: boolean;
  getPublicKey: ReturnType<typeof vi.fn>;
  signEvent: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
}

type FakeBunker = FakeBunkerSignerInternals & { __subCloseCalls: string[] };

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
    getPublicKey: vi.fn().mockResolvedValue("pubkey-hex"),
    signEvent: vi
      .fn()
      .mockImplementation((evt: Record<string, unknown>) =>
        Promise.resolve({ ...evt, id: "evt-id", sig: "sig-hex" })
      ),
    ping: vi.fn().mockResolvedValue(undefined),
    ...overrides,
    __subCloseCalls: subCloseCalls,
  };
  return fake;
}

type SignerCtorInput = ConstructorParameters<typeof Nip46Signer>[0];

function makeSigner(fake: FakeBunkerSignerInternals): Nip46Signer {
  // The real `Nip46Signer` only touches the bunker through the narrow
  // `BunkerSignerInternals` interface plus the public `BunkerSigner` RPC
  // methods. The fake covers both, so a double-cast through `unknown` is
  // safe here.
  const inner = fake as unknown as SignerCtorInput["inner"];
  const pool: SignerCtorInput["pool"] = Object.create(
    null
  ) as SignerCtorInput["pool"];
  return new Nip46Signer({ pool, inner });
}

describe("Nip46Signer per-RPC subscription refresh", () => {
  it("closes the existing BunkerSigner subscription before each RPC", async () => {
    const fake = makeFakeBunker();
    // Capture the closer up front: `Nip46Signer.refreshBunkerSubscription`
    // sets `inner.subCloser = undefined` to force the next `sendRequest` to
    // call `setupSubscription()` again, so the fake's field will be cleared
    // by the time the RPC resolves.
    const initialCloser = fake.subCloser;
    const signer = makeSigner(fake);

    await signer.getPublicKey();

    expect(initialCloser?.close).toHaveBeenCalledTimes(1);
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
    expect(fake.subCloser).toBeUndefined();
    // Order: close happens before the inner RPC fires so the bunker rebuilds
    // a fresh REQ for the reply.
    const closeOrder = initialCloser?.close.mock.invocationCallOrder[0] ?? 0;
    const rpcOrder = fake.getPublicKey.mock.invocationCallOrder[0] ?? 0;
    expect(closeOrder).toBeLessThan(rpcOrder);
  });

  it("refreshes the subscription on every RPC, not just the first", async () => {
    const fake = makeFakeBunker();
    const firstCloser = fake.subCloser;
    const signer = makeSigner(fake);

    await signer.getPublicKey();
    // After the first refresh, BunkerSigner would normally re-set subCloser
    // inside its own setupSubscription. Simulate that by re-arming it.
    const secondCloser: FakeSubCloser = {
      close: vi.fn(async (reason?: string) => {
        fake.__subCloseCalls.push(reason ?? "");
      }),
    };
    fake.subCloser = secondCloser;

    await signer.signEvent({
      kind: 1,
      content: "hi",
      created_at: 0,
      tags: [],
    });

    expect(firstCloser?.close).toHaveBeenCalledTimes(1);
    expect(secondCloser.close).toHaveBeenCalledTimes(1);
    expect(fake.signEvent).toHaveBeenCalledTimes(1);
    expect(fake.__subCloseCalls).toEqual([
      "nip46:per-rpc-refresh",
      "nip46:per-rpc-refresh",
    ]);
  });

  it("skips the refresh when the BunkerSigner is closed (isOpen=false)", async () => {
    const fake = makeFakeBunker({ isOpen: false });
    const signer = makeSigner(fake);

    await signer.getPublicKey();

    expect(fake.subCloser?.close).not.toHaveBeenCalled();
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it("skips the refresh when there is no subCloser yet", async () => {
    const fake = makeFakeBunker({ subCloser: undefined });
    const signer = makeSigner(fake);

    await expect(signer.getPublicKey()).resolves.toBe("pubkey-hex");
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it("still proceeds with the RPC if the subscription close throws", async () => {
    const fake = makeFakeBunker();
    const throwingCloser: FakeSubCloser = {
      close: vi.fn().mockRejectedValue(new Error("relay closed")),
    };
    fake.subCloser = throwingCloser;

    const signer = makeSigner(fake);

    await expect(signer.getPublicKey()).resolves.toBe("pubkey-hex");
    expect(throwingCloser.close).toHaveBeenCalledTimes(1);
    expect(fake.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent RPCs so a refresh cannot drop another's reply", async () => {
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

    const signer = makeSigner(fake);

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

    const signer = makeSigner(fake);

    await expect(signer.getPublicKey()).rejects.toThrow("boom");
    await expect(signer.getPublicKey()).resolves.toBe("pubkey-hex");
    expect(fake.getPublicKey).toHaveBeenCalledTimes(2);
  });
});
