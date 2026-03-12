/**
 * @vitest-environment jsdom
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
  getConnectionEstablishedAt,
  getLastActivityTime,
  getLastRelaySyncAt,
  getLastVerificationTime,
  setLastActivityTime,
  setLastVerificationTime,
} from "~/features/auth/signer/connection-cache.client";
import {
  verifySignerConnection,
  startHealthCheckMonitoring,
  stopHealthCheckMonitoring,
  syncRelaysWithRemoteSigner,
} from "~/features/auth/signer/connection-health.client";
import {
  normalizeRelayList,
  relayListsEqual,
} from "~/features/auth/signer/connection-relay-utils.client";
import {
  getActiveSignerConfig,
  persistActiveSignerConfigWithoutReset,
} from "~/features/auth/signer/nostr-signer-storage.client";
import {
  addConnectionLog,
  getActiveConnection,
  updateSession,
} from "~/features/auth/signer/remote-signer-sessions.client";

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
    it("dispatches NOSTR_CONNECTION_STALE_EVENT when verification fails and cache still has same signer", async () => {
      vi.useFakeTimers();
      const nip46Config = {
        type: "nip46" as const,
        method: "nostrconnect_uri" as const,
        uri: "nostrconnect://x?relay=wss://x&secret=s",
        clientSecretKeyHex: "ab",
        relays: ["wss://x"],
      };
      const staleSigner = {
        type: "nip46" as const,
        ping: vi.fn().mockRejectedValue(new Error("Ping failed")),
      };
      vi.mocked(getActiveSignerConfig).mockReturnValue(nip46Config);
      vi.mocked(getCachedSigner).mockReturnValue(
        staleSigner as unknown as NostrSigner
      );
      vi.mocked(getConnectionEstablishedAt).mockReturnValue(
        Date.now() - 30 * 60 * 1000
      );
      vi.mocked(getLastVerificationTime).mockReturnValue(
        Date.now() - 10 * 60 * 1000
      );
      vi.mocked(getLastActivityTime).mockReturnValue(
        Date.now() - 10 * 60 * 1000
      );
      vi.mocked(getLastRelaySyncAt).mockReturnValue(null);

      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      startHealthCheckMonitoring();
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 100);

      const staleCalls = dispatchSpy.mock.calls.filter(
        (c) => (c[0] as CustomEvent).type === "nostr-connection-stale"
      );
      expect(staleCalls.length).toBeGreaterThanOrEqual(1);
      vi.useRealTimers();
      dispatchSpy.mockRestore();
    });

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

    it("returns changed false with reason not_nostrconnect_uri when config is not nostrconnect_uri", async () => {
      const signer = {
        type: "nip46",
        switchRelays: vi.fn().mockResolvedValue(["wss://new"]),
      } as unknown as NostrSigner;
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      });
      const result = await syncRelaysWithRemoteSigner(signer);
      expect(result).toEqual({
        changed: false,
        reason: "not_nostrconnect_uri",
      });
      expect(signer.switchRelays).not.toHaveBeenCalled();
    });

    it("returns changed false with reason no_change when switchRelays returns falsy", async () => {
      const signer = {
        type: "nip46",
        switchRelays: vi.fn().mockResolvedValue(null),
      } as unknown as NostrSigner;
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x",
        clientSecretKeyHex: "ab",
        relays: ["wss://old"],
      });
      const result = await syncRelaysWithRemoteSigner(signer);
      expect(result).toEqual({ changed: false, reason: "no_change" });
    });

    it("returns changed false with reason unchanged when normalized equals config.relays", async () => {
      const signer = {
        type: "nip46",
        switchRelays: vi.fn().mockResolvedValue(["wss://same"]),
      } as unknown as NostrSigner;
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x",
        clientSecretKeyHex: "ab",
        relays: ["wss://same"],
      });
      vi.mocked(normalizeRelayList).mockReturnValue(["wss://same"]);
      vi.mocked(relayListsEqual).mockReturnValue(true);
      const result = await syncRelaysWithRemoteSigner(signer);
      expect(result).toEqual({ changed: false, reason: "unchanged" });
    });

    it("returns changed true and updates session and log when relay sync succeeds", async () => {
      const newRelays = ["wss://new1", "wss://new2"];
      const signer = {
        type: "nip46",
        switchRelays: vi.fn().mockResolvedValue(newRelays),
      } as unknown as NostrSigner;
      const config = {
        type: "nip46" as const,
        method: "nostrconnect_uri" as const,
        uri: "nostrconnect://x",
        clientSecretKeyHex: "ab",
        relays: ["wss://old"],
      };
      vi.mocked(getActiveSignerConfig).mockReturnValue(config);
      vi.mocked(normalizeRelayList).mockReturnValue(newRelays);
      vi.mocked(relayListsEqual).mockReturnValue(false);
      const activeConnection = {
        id: "conn-1",
        config: {
          type: "nip46" as const,
          method: "nostrconnect_uri" as const,
          uri: "nostrconnect://x",
          clientSecretKeyHex: "ab",
          relays: ["wss://old"],
        },
        metadata: { lastActivityAt: 0 },
      };
      vi.mocked(getActiveConnection).mockReturnValue(
        activeConnection as unknown as ReturnType<typeof getActiveConnection>
      );
      const result = await syncRelaysWithRemoteSigner(signer);
      expect(result).toEqual({ changed: true, relays: newRelays });
      expect(persistActiveSignerConfigWithoutReset).toHaveBeenCalledWith({
        ...config,
        relays: newRelays,
      });
      expect(updateSession).toHaveBeenCalledWith(
        "conn-1",
        /* eslint-disable @typescript-eslint/no-unsafe-assignment -- vitest matchers */
        expect.objectContaining({
          config: expect.objectContaining({ relays: newRelays }),
          metadata: expect.objectContaining({
            relays: newRelays,
            lastActivityAt: expect.any(Number),
          }),
        })
        /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      );
      expect(addConnectionLog).toHaveBeenCalledWith("conn-1", {
        type: "health_check",
        status: "success",
        message: "Relays updated via switch_relays",
        details: { relayCount: 2 },
      });
    });

    it("does not call updateSession when getActiveConnection returns null", async () => {
      const newRelays = ["wss://new"];
      const signer = {
        type: "nip46",
        switchRelays: vi.fn().mockResolvedValue(newRelays),
      } as unknown as NostrSigner;
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x",
        clientSecretKeyHex: "ab",
        relays: [],
      });
      vi.mocked(normalizeRelayList).mockReturnValue(newRelays);
      vi.mocked(relayListsEqual).mockReturnValue(false);
      vi.mocked(getActiveConnection).mockReturnValue(null);
      const result = await syncRelaysWithRemoteSigner(signer);
      expect(result).toEqual({ changed: true, relays: newRelays });
      expect(persistActiveSignerConfigWithoutReset).toHaveBeenCalled();
      expect(updateSession).not.toHaveBeenCalled();
      expect(addConnectionLog).not.toHaveBeenCalled();
    });

    it("uses existing config when activeConnection.config.method is not nostrconnect_uri", async () => {
      const newRelays = ["wss://new"];
      const signer = {
        type: "nip46",
        switchRelays: vi.fn().mockResolvedValue(newRelays),
      } as unknown as NostrSigner;
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x",
        clientSecretKeyHex: "ab",
        relays: [],
      });
      vi.mocked(normalizeRelayList).mockReturnValue(newRelays);
      vi.mocked(relayListsEqual).mockReturnValue(false);
      const activeConnection = {
        id: "conn-1",
        config: {
          type: "nip46" as const,
          method: "bunker_input" as const,
          bunkerInput: "x",
          clientSecretKeyHex: "ab",
          relays: [],
        },
        metadata: {},
      };
      vi.mocked(getActiveConnection).mockReturnValue(
        activeConnection as unknown as ReturnType<typeof getActiveConnection>
      );
      await syncRelaysWithRemoteSigner(signer);
      expect(updateSession).toHaveBeenCalledWith(
        "conn-1",
        expect.objectContaining({
          config: activeConnection.config,
        })
      );
    });
  });
});
