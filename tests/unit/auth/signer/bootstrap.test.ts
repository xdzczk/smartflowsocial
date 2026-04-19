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
});
