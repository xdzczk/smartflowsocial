/**
 * Unit tests for remote signer health (testConnection).
 * Tests app/features/auth/signer/remote-signer-health.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActiveSigner = vi.fn();
const mockGetActiveSignerConfig = vi.fn();
vi.mock("~/features/auth/signer/nostr-signer-manager.client", () => ({
  getActiveSigner: (...args: unknown[]) => mockGetActiveSigner(...args),
  getActiveSignerConfig: () => mockGetActiveSignerConfig(),
}));

import { testConnection } from "~/features/auth/signer/remote-signer-health.client";

describe("remote-signer-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("returns healthy false when no signer and tryReconnect false", async () => {
    mockGetActiveSigner.mockResolvedValue(null);
    mockGetActiveSignerConfig.mockReturnValue({ type: "nip46" });
    const result = await testConnection(1000, {
      tryReconnectIfDisconnected: false,
    });
    expect(result.healthy).toBe(false);
    expect(result.error).toBe(
      "Remote signer is not currently connected. Reconnect required."
    );
  });

  it("returns healthy false with generic message when no signer and no nip46 config", async () => {
    mockGetActiveSigner.mockResolvedValue(null);
    mockGetActiveSignerConfig.mockReturnValue(null);
    const result = await testConnection(1000, {
      tryReconnectIfDisconnected: false,
    });
    expect(result.healthy).toBe(false);
    expect(result.error).toBe("No active signer found");
  });

  it("returns healthy true via get_public_key when signer has no ping", async () => {
    mockGetActiveSigner.mockResolvedValue({
      type: "nip07",
      getPublicKey: vi.fn().mockResolvedValue("npub1abc"),
    });
    const result = await testConnection(2000);
    expect(result.healthy).toBe(true);
    expect(result.method).toBe("get_public_key");
    expect(result.pubkey).toBe("npub1abc");
  });

  it("returns healthy true via ping when signer has ping", async () => {
    mockGetActiveSigner.mockResolvedValue({
      type: "nip46",
      ping: vi.fn().mockResolvedValue(undefined),
      getPublicKey: vi.fn().mockResolvedValue("pk"),
    });
    const result = await testConnection(2000);
    expect(result.healthy).toBe(true);
    expect(result.method).toBe("ping");
  });

  it("returns healthy false when getPublicKey throws", async () => {
    mockGetActiveSigner.mockResolvedValue({
      type: "nip07",
      getPublicKey: vi.fn().mockRejectedValue(new Error("Key error")),
    });
    const result = await testConnection(2000);
    expect(result.healthy).toBe(false);
    expect(result.error).toBe("Key error");
  });

  it("returns healthy false when ping throws", async () => {
    mockGetActiveSigner.mockResolvedValue({
      type: "nip46",
      ping: vi.fn().mockRejectedValue(new Error("Ping failed")),
      getPublicKey: vi.fn().mockResolvedValue("pk"),
    });
    const result = await testConnection(2000);
    expect(result.healthy).toBe(false);
    expect(result.error).toBe("Ping failed");
  });

  it("returns healthy false on timeout", async () => {
    vi.useFakeTimers();
    mockGetActiveSigner.mockResolvedValue({
      type: "nip46",
      ping: () => new Promise(() => {}),
      getPublicKey: vi.fn().mockResolvedValue("pk"),
    });
    const p = testConnection(100);
    await vi.advanceTimersByTimeAsync(200);
    const result = await p;
    expect(result.healthy).toBe(false);
    expect(result.error).toBe("Connection check timeout");
    vi.useRealTimers();
  });
});
