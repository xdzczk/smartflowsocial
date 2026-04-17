/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  encryptNip04WithActiveSigner,
  encryptNip44WithActiveSigner,
} from "~/lib/nostr-signer-encrypt.client";

const mocks = vi.hoisted(() => ({
  getActiveSigner: vi.fn(),
  getActiveSignerConfig: vi.fn(),
}));

vi.mock("~/features/auth/signer", () => ({
  getActiveSigner: (...args: unknown[]) => mocks.getActiveSigner(...args),
  getActiveSignerConfig: (...args: unknown[]) =>
    mocks.getActiveSignerConfig(...args),
}));

describe("nostr-signer-encrypt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveSigner.mockResolvedValue(null);
    mocks.getActiveSignerConfig.mockReturnValue(null);
    (window as unknown as { nostr?: unknown }).nostr = undefined;
  });

  it("uses active signer nip04/nip44 encrypt when available", async () => {
    mocks.getActiveSigner.mockResolvedValue({
      nip04Encrypt: vi.fn(async () => "nip04-cipher"),
      nip44Encrypt: vi.fn(async () => "nip44-cipher"),
    });
    expect(await encryptNip04WithActiveSigner("pubkey", "hello")).toBe(
      "nip04-cipher"
    );
    expect(await encryptNip44WithActiveSigner("pubkey", "hello")).toBe(
      "nip44-cipher"
    );
  });

  it("throws reconnect hint when nip46 is configured but disconnected", async () => {
    mocks.getActiveSignerConfig.mockReturnValue({ type: "nip46" });
    await expect(
      encryptNip04WithActiveSigner("pubkey", "hello")
    ).rejects.toThrow("Remote signer is not connected");
    await expect(
      encryptNip44WithActiveSigner("pubkey", "hello")
    ).rejects.toThrow("Remote signer is not connected");
  });

  it("falls back to extension encryption when available", async () => {
    (window as unknown as { nostr?: unknown }).nostr = {
      nip04: { encrypt: vi.fn(async () => "ext-04") },
      nip44: { encrypt: vi.fn(async () => "ext-44") },
    };
    expect(await encryptNip04WithActiveSigner("pubkey", "hello")).toBe(
      "ext-04"
    );
    expect(await encryptNip44WithActiveSigner("pubkey", "hello")).toBe(
      "ext-44"
    );
  });

  it("throws explicit unsupported errors when no signer is available", async () => {
    await expect(
      encryptNip04WithActiveSigner("pubkey", "hello")
    ).rejects.toThrow("NIP-04 encryption is not available");
    await expect(
      encryptNip44WithActiveSigner("pubkey", "hello")
    ).rejects.toThrow("NIP-44 encryption is not available");
  });
});
