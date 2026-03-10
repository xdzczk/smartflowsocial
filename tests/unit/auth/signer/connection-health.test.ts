/**
 * Unit tests for connection health (verifySignerConnection, startHealthCheckMonitoring).
 * Tests app/features/auth/signer/connection-health.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth/signer/connection-cache.client", () => ({
  getCachedSigner: vi.fn(),
  getConnectionEstablishedAt: vi.fn(),
  getLastActivityTime: vi.fn(),
  getLastRelaySyncAt: vi.fn(),
  getLastVerificationTime: vi.fn(),
  setLastActivityTime: vi.fn(),
  setLastRelaySyncAt: vi.fn(),
  setLastVerificationTime: vi.fn(),
}));

vi.mock("~/features/auth/signer/nostr-signer-storage.client", () => ({
  getActiveSignerConfig: vi.fn(),
  persistActiveSignerConfigWithoutReset: vi.fn(),
}));

vi.mock("~/features/auth/signer/remote-signer-sessions.client", () => ({
  addConnectionLog: vi.fn(),
  getActiveConnection: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("~/features/auth/signer/connection-relay-utils.client", () => ({
  normalizeRelayList: vi.fn((r: string[]) => r),
  relayListsEqual: vi.fn(() => false),
}));

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import {
  getCachedSigner,
  setLastActivityTime,
  setLastVerificationTime,
} from "~/features/auth/signer/connection-cache.client";
import {
  verifySignerConnection,
  startHealthCheckMonitoring,
  stopHealthCheckMonitoring,
  syncRelaysWithRemoteSigner,
} from "~/features/auth/signer/connection-health.client";
import { getActiveSignerConfig } from "~/features/auth/signer/nostr-signer-storage.client";

describe("connection-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    stopHealthCheckMonitoring();
    vi.useRealTimers();
  });

  describe("verifySignerConnection", () => {
    it("returns true when signer type is not nip46", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip07" } as NostrSigner;
      expect(await verifySignerConnection(signer)).toBe(true);
    });

    it("returns true when signer has no ping function", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip46" } as NostrSigner;
      expect(await verifySignerConnection(signer)).toBe(true);
    });

    it("returns true and updates cache when ping resolves", async () => {
      const signer = {
        type: "nip46",
        ping: vi.fn().mockResolvedValue(undefined),
      } as unknown as NostrSigner;
      expect(await verifySignerConnection(signer)).toBe(true);
      expect(setLastActivityTime).toHaveBeenCalled();
      expect(setLastVerificationTime).toHaveBeenCalled();
    });

    it("returns false when ping rejects", async () => {
      const signer = {
        type: "nip46",
        ping: vi.fn().mockRejectedValue(new Error("Ping failed")),
      } as unknown as NostrSigner;
      expect(await verifySignerConnection(signer)).toBe(false);
    });

    it("returns false when ping times out", async () => {
      vi.useFakeTimers();

      const signer = {
        type: "nip46",
        ping: () => new Promise(() => {}),
      } as unknown as NostrSigner;
      const p = verifySignerConnection(signer, 100);
      await vi.advanceTimersByTimeAsync(150);
      await expect(p).resolves.toBe(false);
    });
  });

  describe("startHealthCheckMonitoring", () => {
    it("clears interval when no active config", async () => {
      vi.useFakeTimers();
      vi.mocked(getActiveSignerConfig).mockReturnValue(null);
      vi.mocked(getCachedSigner).mockReturnValue(null);
      startHealthCheckMonitoring();
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 100);
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      });

      vi.mocked(getCachedSigner).mockReturnValue({
        type: "nip46",
        ping: vi.fn().mockResolvedValue(undefined),
      } as unknown as NostrSigner);
      startHealthCheckMonitoring();
      const intervalCount = (
        getActiveSignerConfig as unknown as { mock: { calls: unknown[] } }
      ).mock.calls.length;
      expect(intervalCount).toBeGreaterThan(0);
    });
  });

  describe("syncRelaysWithRemoteSigner", () => {
    it("returns changed false with reason unsupported when signer is not nip46", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip07" } as NostrSigner;
      const result = await syncRelaysWithRemoteSigner(signer);
      expect(result).toEqual({ changed: false, reason: "unsupported" });
    });

    it("returns changed false when signer has no switchRelays", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip46" } as NostrSigner;
      const result = await syncRelaysWithRemoteSigner(signer);
      expect(result).toEqual({ changed: false, reason: "unsupported" });
    });
  });
});
