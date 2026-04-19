/**
 * @vitest-environment jsdom
 * Unit tests for the boot-time signer warm-up.
 * Tests app/features/auth/signer/bootstrap.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NostrSigner } from "~/features/auth/nostr-signer.client";

const mockGetSharedPool = vi.fn(() => ({ relays: new Map() }));
const mockGetActiveSigner =
  vi.fn<(opts?: { allowReconnect?: boolean }) => Promise<NostrSigner | null>>();
const mockGetActiveSignerConfig = vi.fn<() => unknown>();

vi.mock("~/features/nostr/shared-pool.client", () => ({
  getSharedPool: mockGetSharedPool,
}));

vi.mock("~/features/auth/signer/nostr-signer-connection.client", () => ({
  getActiveSigner: mockGetActiveSigner,
}));

vi.mock("~/features/auth/signer/nostr-signer-storage.client", () => ({
  getActiveSignerConfig: mockGetActiveSignerConfig,
}));

async function importBootstrap() {
  return await import("~/features/auth/signer/bootstrap.client");
}

function nip46Config() {
  return {
    type: "nip46" as const,
    method: "nostrconnect_uri" as const,
    uri: "nostrconnect://abc",
    clientSecretKeyHex: "00".repeat(32),
    relays: ["wss://relay.example"],
  };
}

function nip07Config() {
  return { type: "nip07" as const };
}

function fakeNip46Signer(overrides: Partial<NostrSigner> = {}): NostrSigner {
  const base: NostrSigner = {
    type: "nip46",
    getPublicKey: vi.fn(async () => "pubkey"),
    signEvent: vi.fn(),
    nip04Encrypt: vi.fn(),
    nip44Encrypt: vi.fn(),
    getStatus: vi.fn(() => "ready" as const),
    ping: vi.fn(async () => undefined),
  };
  return { ...base, ...overrides };
}

type DispatchSpy = ReturnType<typeof vi.fn<(event: Event) => boolean>>;

describe("bootstrapNostrSigner", () => {
  let dispatchSpy: DispatchSpy;
  let originalDispatchEvent: typeof window.dispatchEvent;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { __resetBootstrapForTests } = await importBootstrap();
    __resetBootstrapForTests();
    // Clear pending-handoff storage so tests that don't write one start
    // from a clean slate (the new bootstrap short-circuits when one
    // exists, which would mask the original tests' assertions).
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
    originalDispatchEvent = window.dispatchEvent.bind(window);
    dispatchSpy = vi.fn<(event: Event) => boolean>(() => true);
    window.dispatchEvent = dispatchSpy;
  });

  afterEach(() => {
    window.dispatchEvent = originalDispatchEvent;
  });

  it("opens the shared pool even when no signer is configured", async () => {
    mockGetActiveSignerConfig.mockReturnValue(null);
    const { bootstrapNostrSigner } = await importBootstrap();

    bootstrapNostrSigner();

    expect(mockGetSharedPool).toHaveBeenCalledTimes(1);
    expect(mockGetActiveSigner).not.toHaveBeenCalled();
  });

  it("does not resolve a signer for NIP-07 logins (window.nostr handles it)", async () => {
    mockGetActiveSignerConfig.mockReturnValue(nip07Config());
    const { bootstrapNostrSigner } = await importBootstrap();

    bootstrapNostrSigner();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockGetSharedPool).toHaveBeenCalledTimes(1);
    expect(mockGetActiveSigner).not.toHaveBeenCalled();
  });

  it("resolves the NIP-46 signer once without pinging the bunker", async () => {
    mockGetActiveSignerConfig.mockReturnValue(nip46Config());
    const signer = fakeNip46Signer();
    mockGetActiveSigner.mockResolvedValue(signer);

    const { bootstrapNostrSigner } = await importBootstrap();
    bootstrapNostrSigner();

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(mockGetActiveSigner).toHaveBeenCalledTimes(1);
    expect(mockGetActiveSigner).toHaveBeenCalledWith({ allowReconnect: true });
    expect(signer.ping).not.toHaveBeenCalled();
    const dispatchedTypes = dispatchSpy.mock.calls.map((c) => c[0].type);
    expect(dispatchedTypes).not.toContain("nostr-connection-healthy");
    expect(dispatchedTypes).not.toContain("nostr-connection-stale");
  });

  it("swallows errors from getActiveSigner without dispatching a banner event", async () => {
    mockGetActiveSignerConfig.mockReturnValue(nip46Config());
    mockGetActiveSigner.mockRejectedValue(new Error("connect failed"));

    const { bootstrapNostrSigner } = await importBootstrap();
    bootstrapNostrSigner();

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const dispatchedTypes = dispatchSpy.mock.calls.map((c) => c[0].type);
    expect(dispatchedTypes).not.toContain("nostr-connection-stale");
    expect(dispatchedTypes).not.toContain("nostr-connection-healthy");
  });

  it("is a no-op on subsequent calls within the same page load", async () => {
    mockGetActiveSignerConfig.mockReturnValue(nip46Config());
    mockGetActiveSigner.mockResolvedValue(fakeNip46Signer());

    const { bootstrapNostrSigner } = await importBootstrap();

    bootstrapNostrSigner();
    bootstrapNostrSigner();
    bootstrapNostrSigner();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockGetSharedPool).toHaveBeenCalledTimes(1);
    expect(mockGetActiveSigner).toHaveBeenCalledTimes(1);
  });

  it(
    "skips signer warm-up while a pending NIP-46 handoff is in flight " +
      "so the stale stored config does not race the fresh login flow",
    async () => {
      // Simulate the cold-reopen-after-Primal-callback state: localStorage
      // still holds the previous session's signer config (different
      // clientSecretKey from the one Primal just approved), and the login
      // panel has written a fresh handoff that resume() is about to consume.
      const { writePendingNip46Handoff, PENDING_NIP46_STORAGE_KEY } =
        await import("~/features/auth/pending-nip46-storage.client");
      writePendingNip46Handoff(PENDING_NIP46_STORAGE_KEY, {
        uri: "nostrconnect://fresh",
        clientSecretKey: new Uint8Array(32).fill(7),
        relays: ["wss://relay.primal.net"],
      });

      mockGetActiveSignerConfig.mockReturnValue(nip46Config());
      mockGetActiveSigner.mockResolvedValue(fakeNip46Signer());

      const { bootstrapNostrSigner } = await importBootstrap();
      bootstrapNostrSigner();
      await new Promise((r) => setTimeout(r, 0));

      // Pool still warmed (cheap, harmless) but no parallel signer is built.
      expect(mockGetSharedPool).toHaveBeenCalledTimes(1);
      expect(mockGetActiveSigner).not.toHaveBeenCalled();

      const { clearPendingNip46Handoff } =
        await import("~/features/auth/pending-nip46-storage.client");
      clearPendingNip46Handoff(PENDING_NIP46_STORAGE_KEY);
    }
  );

  it(
    "still warms the signer when an expired handoff is the only thing " +
      "in storage (TTL filter prevents a permanently disabled bootstrap)",
    async () => {
      // Write directly with an already-expired record to bypass the helper's
      // refusal to persist past the TTL.
      const expired = JSON.stringify({
        uri: "nostrconnect://stale",
        clientSecretKeyHex: "11".repeat(32),
        relays: ["wss://relay.primal.net"],
        expiresAt: Date.now() - 1000,
      });
      window.localStorage.setItem("__smartflow_pending_nip46_uri_v1", expired);

      mockGetActiveSignerConfig.mockReturnValue(nip46Config());
      mockGetActiveSigner.mockResolvedValue(fakeNip46Signer());

      const { bootstrapNostrSigner } = await importBootstrap();
      bootstrapNostrSigner();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));

      expect(mockGetActiveSigner).toHaveBeenCalledTimes(1);
      // readPendingNip46Handoff also clears expired entries on read.
      expect(
        window.localStorage.getItem("__smartflow_pending_nip46_uri_v1")
      ).toBeNull();
    }
  );
});
