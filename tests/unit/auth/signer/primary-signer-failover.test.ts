/**
 * Unit tests for primary-signer-failover (attemptPrimarySignerFailover, clearPrimarySignerProfileCache).
 * Tests app/features/auth/signer/primary-signer-failover.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const _mockFetchProfile = vi.fn();
const mockConnectBunker = vi.fn();
const mockSetActiveSignerConfig = vi.fn();
const mockMatchOrCreateSession = vi.fn();
const mockSetActiveSession = vi.fn();
const mockDetectSignerAppName = vi.fn();
const mockUpdateSession = vi.fn();
const mockRecordConnectionEvent = vi.fn();
const mockEmitTimeout = vi.fn();
const mockEmitReconnectDialog = vi.fn();

vi.mock("nostr-tools", () => ({
  generateSecretKey: () => new Uint8Array(32).fill(1),
  nip19: { decode: vi.fn() },
  SimplePool: vi.fn(),
}));

vi.mock("~/features/auth/nostr-signer.client", () => ({
  connectNip46WithBunkerInput: (...args: unknown[]) =>
    mockConnectBunker(...args),
  connectNip46WithNostrConnectUri: vi.fn(),
}));

vi.mock("~/features/auth/signer/nostr-signer-manager.client", () => ({
  serializeSecretKey: vi.fn((b: Uint8Array) =>
    Array.from(b)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  ),
  setActiveSignerConfig: (...args: unknown[]) =>
    mockSetActiveSignerConfig(...args),
}));

vi.mock("~/features/auth/signer/remote-signer-sessions.client", () => ({
  matchOrCreateSession: (...args: unknown[]) =>
    mockMatchOrCreateSession(...args),
  setActiveSession: (...args: unknown[]) => mockSetActiveSession(...args),
  detectSignerAppName: (...args: unknown[]) => mockDetectSignerAppName(...args),
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

vi.mock("~/features/auth/signer/remote-signer-status.client", () => ({
  recordConnectionEvent: (...args: unknown[]) =>
    mockRecordConnectionEvent(...args),
}));

vi.mock("~/features/auth/signer/remote-signer-reconnect.client", () => ({
  emitRemoteSignerTimeoutEvent: (...args: unknown[]) =>
    mockEmitTimeout(...args),
  emitOpenRemoteSignerReconnectDialogEvent: (...args: unknown[]) =>
    mockEmitReconnectDialog(...args),
}));

import {
  attemptPrimarySignerFailover,
  clearPrimarySignerProfileCache,
} from "~/features/auth/signer/primary-signer-failover.client";

describe("primary-signer-failover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchOrCreateSession.mockReturnValue({
      id: "conn-1",
      metadata: { pubkey: null, status: "active" },
    });
    mockDetectSignerAppName.mockReturnValue("Primal");
  });

  describe("attemptPrimarySignerFailover", () => {
    it("returns recovered false with reason no_primary_profile when no profile available", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
      const result = await attemptPrimarySignerFailover();
      expect(result).toEqual({
        recovered: false,
        reason: "no_primary_profile",
      });
      vi.unstubAllGlobals();
    });

    it("returns recovered false when connectProfile throws", async () => {
      mockConnectBunker.mockRejectedValue(new Error("Connection failed"));
      const profile = {
        type: "nip46" as const,
        method: "bunker_input" as const,
        bunkerInput: "bunker://x",
        expectedPubkey: null,
        label: "Test",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const result = await attemptPrimarySignerFailover({ profile });
      expect(result.recovered).toBe(false);
      expect(result.reason).toContain("Connection failed");
      expect(mockEmitReconnectDialog).toHaveBeenCalled();
    });

    it("returns recovered true and calls session/config updates when connect succeeds", async () => {
      mockConnectBunker.mockResolvedValue({
        signer: { close: vi.fn().mockResolvedValue(undefined) },
        pubkey: "a".repeat(64),
      });
      const profile = {
        type: "nip46" as const,
        method: "bunker_input" as const,
        bunkerInput: "bunker://x",
        expectedPubkey: null,
        label: "Test",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const result = await attemptPrimarySignerFailover({ profile });
      expect(result).toEqual({ recovered: true });
      expect(mockSetActiveSignerConfig).toHaveBeenCalled();
      expect(mockMatchOrCreateSession).toHaveBeenCalled();
      expect(mockSetActiveSession).toHaveBeenCalledWith("conn-1");
      expect(mockRecordConnectionEvent).toHaveBeenCalledWith("conn-1", {
        type: "connected",
        pubkey: "a".repeat(64),
      });
    });

    it("returns recovered false with reason pubkey_mismatch when expected pubkey does not match", async () => {
      mockConnectBunker.mockResolvedValue({
        signer: { close: vi.fn().mockResolvedValue(undefined) },
        pubkey: "b".repeat(64),
      });
      const profile = {
        type: "nip46" as const,
        method: "bunker_input" as const,
        bunkerInput: "bunker://x",
        expectedPubkey: "a".repeat(64),
        label: "Test",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const result = await attemptPrimarySignerFailover({ profile });
      expect(result).toEqual({ recovered: false, reason: "pubkey_mismatch" });
    });
  });

  describe("clearPrimarySignerProfileCache", () => {
    it("clears cache so fetchPrimarySignerProfile can be re-tested", () => {
      clearPrimarySignerProfileCache();
      expect(() => clearPrimarySignerProfileCache()).not.toThrow();
    });
  });
});
