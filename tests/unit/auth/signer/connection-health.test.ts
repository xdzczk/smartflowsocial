/**
 * @vitest-environment jsdom
 * Unit tests for connection health (verifySignerConnection, isTransportLikelyHealthy, syncRelaysWithRemoteSigner).
 * Tests app/features/auth/signer/connection-health.client.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth/signer/connection-cache.client", () => ({
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

const sharedPoolRelays = new Map<string, { connected: boolean }>();
vi.mock("~/features/nostr/shared-pool.client", () => ({
  getSharedPool: () => ({ relays: sharedPoolRelays }),
}));

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import {
  setLastActivityTime,
  setLastVerificationTime,
} from "~/features/auth/signer/connection-cache.client";
import {
  isTransportLikelyHealthy,
  syncRelaysWithRemoteSigner,
  verifySignerConnection,
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
    sharedPoolRelays.clear();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
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

  describe("isTransportLikelyHealthy", () => {
    it("returns false when no active config", () => {
      vi.mocked(getActiveSignerConfig).mockReturnValue(null);
      expect(isTransportLikelyHealthy()).toBe(false);
    });

    it("returns false for nip07 config", () => {
      vi.mocked(getActiveSignerConfig).mockReturnValue({ type: "nip07" });
      expect(isTransportLikelyHealthy()).toBe(false);
    });

    it("returns false when bunker_input config has no relays", () => {
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      });
      expect(isTransportLikelyHealthy()).toBe(false);
    });

    it("returns true when any bunker_input relay is connected in the shared pool", () => {
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
        relays: ["wss://relay.example/"],
      });
      sharedPoolRelays.set("wss://relay.example/", { connected: true });
      expect(isTransportLikelyHealthy()).toBe(true);
    });

    it("returns false when bunker_input relay exists but socket is closed", () => {
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
        relays: ["wss://relay.example/"],
      });
      sharedPoolRelays.set("wss://relay.example/", { connected: false });
      expect(isTransportLikelyHealthy()).toBe(false);
    });

    it("uses bunkerPointer.relays when present for nostrconnect_uri configs", () => {
      vi.mocked(getActiveSignerConfig).mockReturnValue({
        type: "nip46",
        method: "nostrconnect_uri",
        uri: "nostrconnect://x",
        clientSecretKeyHex: "ab",
        relays: ["wss://stale.example/"],
        bunkerPointer: {
          pubkey: "p",
          relays: ["wss://current.example/"],
          secret: null,
        },
      });
      sharedPoolRelays.set("wss://current.example/", { connected: true });
      expect(isTransportLikelyHealthy()).toBe(true);
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
