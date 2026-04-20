/**
 * @vitest-environment jsdom
 * Unit tests for connection health (verifySignerConnection, isTransportLikelyHealthy).
 * Tests app/features/auth/signer/connection-health.client.ts
 *
 * `syncRelaysWithRemoteSigner` used to live alongside these helpers and had a
 * matching describe block here; both were removed when we deleted the
 * `switch_relays` path entirely (Primal Signer never replied to it and it
 * broke the next NIP-46 RPC — see the file-level comment in
 * `connection-health.client.ts` for the full rationale).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth/signer/nostr-signer-storage.client", () => ({
  getActiveSignerConfig: vi.fn(),
}));

const sharedPoolRelays = new Map<string, { connected: boolean }>();
vi.mock("~/features/nostr/shared-pool.client", () => ({
  getSharedPool: () => ({ relays: sharedPoolRelays }),
}));

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import {
  isTransportLikelyHealthy,
  verifySignerConnection,
} from "~/features/auth/signer/connection-health.client";
import { getActiveSignerConfig } from "~/features/auth/signer/nostr-signer-storage.client";

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

    it("returns true when ping resolves", async () => {
      const signer = {
        type: "nip46",
        ping: vi.fn().mockResolvedValue(undefined),
      } as unknown as NostrSigner;
      expect(await verifySignerConnection(signer)).toBe(true);
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
});
