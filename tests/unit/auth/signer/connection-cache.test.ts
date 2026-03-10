/**
 * Unit tests for connection-cache (get/set, resetCachedSigner, recordSuccessfulSign, cacheNip46SignerFromLogin).
 * Tests app/features/auth/signer/connection-cache.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth/signer/nostr-signer-storage.client", () => ({
  getActiveSignerConfig: vi.fn(),
  setCachedConfigJson: vi.fn(),
}));

import {
  getCachedSigner,
  setCachedSigner,
  getConnectionEstablishedAt,
  setConnectionEstablishedAt,
  getLastActivityTime,
  setLastActivityTime,
  getLastVerificationTime,
  setLastVerificationTime,
  getLastRelaySyncAt,
  setLastRelaySyncAt,
  getNeedsReprobe,
  setNeedsReprobe,
  getInFlightSignerPromise,
  setInFlightSignerPromise,
  getInFlightSignerConfigJson,
  setInFlightSignerConfigJson,
  getSignerResolutionRequestId,
  incrementSignerResolutionRequestId,
  getSignerGeneration,
  incrementSignerGeneration,
  getConnectionCooldownUntil,
  setConnectionCooldownUntil,
  getTeardownInProgress,
  setTeardownInProgress,
  getWasHidden,
  setWasHidden,
  getLastVisibilityReconnectAt,
  setLastVisibilityReconnectAt,
  resetCachedSigner,
  recordSuccessfulSign,
  cacheNip46SignerFromLogin,
} from "~/features/auth/signer/connection-cache.client";
import {
  getActiveSignerConfig,
  setCachedConfigJson,
} from "~/features/auth/signer/nostr-signer-storage.client";

describe("connection-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCachedSigner();
  });

  describe("get/set cached signer and timestamps", () => {
    it("getCachedSigner returns null initially", () => {
      expect(getCachedSigner()).toBeNull();
    });

    it("setCachedSigner and getCachedSigner round-trip", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip46" } as never;
      setCachedSigner(signer);
      expect(getCachedSigner()).toBe(signer);
    });

    it("get/set ConnectionEstablishedAt, LastActivityTime, LastVerificationTime, LastRelaySyncAt", () => {
      expect(getConnectionEstablishedAt()).toBeNull();
      setConnectionEstablishedAt(1000);
      expect(getConnectionEstablishedAt()).toBe(1000);

      expect(getLastActivityTime()).toBeNull();
      setLastActivityTime(2000);
      expect(getLastActivityTime()).toBe(2000);

      expect(getLastVerificationTime()).toBeNull();
      setLastVerificationTime(3000);
      expect(getLastVerificationTime()).toBe(3000);

      expect(getLastRelaySyncAt()).toBeNull();
      setLastRelaySyncAt(4000);
      expect(getLastRelaySyncAt()).toBe(4000);
    });

    it("get/set NeedsReprobe", () => {
      expect(getNeedsReprobe()).toBe(false);
      setNeedsReprobe(true);
      expect(getNeedsReprobe()).toBe(true);
    });

    it("get/set in-flight promise and config json", () => {
      expect(getInFlightSignerPromise()).toBeNull();
      expect(getInFlightSignerConfigJson()).toBeNull();

      const p = Promise.resolve(null as never);
      setInFlightSignerPromise(p);
      setInFlightSignerConfigJson('{"type":"nip46"}');
      expect(getInFlightSignerPromise()).toBe(p);
      expect(getInFlightSignerConfigJson()).toBe('{"type":"nip46"}');
      resetCachedSigner();
      expect(getInFlightSignerPromise()).toBeNull();
      expect(getInFlightSignerConfigJson()).toBeNull();
    });

    it("getSignerResolutionRequestId and incrementSignerResolutionRequestId", () => {
      const id0 = getSignerResolutionRequestId();
      expect(incrementSignerResolutionRequestId()).toBe(id0 + 1);
      expect(getSignerResolutionRequestId()).toBe(id0 + 1);
    });

    it("getSignerGeneration and incrementSignerGeneration", () => {
      const g0 = getSignerGeneration();
      expect(incrementSignerGeneration()).toBe(g0 + 1);
      expect(getSignerGeneration()).toBe(g0 + 1);
    });

    it("get/set ConnectionCooldownUntil", () => {
      expect(getConnectionCooldownUntil()).toBe(0);
      setConnectionCooldownUntil(5000);
      expect(getConnectionCooldownUntil()).toBe(5000);
    });

    it("get/set TeardownInProgress", () => {
      expect(getTeardownInProgress()).toBe(false);
      setTeardownInProgress(true);
      expect(getTeardownInProgress()).toBe(true);
    });

    it("get/set WasHidden and LastVisibilityReconnectAt", () => {
      expect(getWasHidden()).toBe(false);
      setWasHidden(true);
      expect(getWasHidden()).toBe(true);

      expect(getLastVisibilityReconnectAt()).toBe(0);
      setLastVisibilityReconnectAt(10000);
      expect(getLastVisibilityReconnectAt()).toBe(10000);
    });
  });

  describe("resetCachedSigner", () => {
    it("clears cached signer and verification/sync times", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      setCachedSigner({ type: "nip46" } as never);
      setConnectionEstablishedAt(1000);
      setLastActivityTime(1000);
      setLastVerificationTime(1000);
      setLastRelaySyncAt(1000);
      resetCachedSigner();
      expect(getCachedSigner()).toBeNull();
      expect(getLastVerificationTime()).toBeNull();
      expect(getLastRelaySyncAt()).toBeNull();
    });
  });

  describe("recordSuccessfulSign", () => {
    it("updates lastActivityTime and lastVerificationTime", () => {
      recordSuccessfulSign();
      const t = getLastActivityTime();
      const v = getLastVerificationTime();
      expect(t).not.toBeNull();
      expect(v).not.toBeNull();
      expect(t).toBe(v);
    });
  });

  describe("cacheNip46SignerFromLogin", () => {
    it("does nothing when signer type is not nip46", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip07" } as never;
      cacheNip46SignerFromLogin(signer);
      expect(getCachedSigner()).toBeNull();
      expect(getActiveSignerConfig).not.toHaveBeenCalled();
    });

    it("does nothing when active config is not nip46", () => {
      vi.mocked(getActiveSignerConfig).mockReturnValue(null);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip46" } as never;
      cacheNip46SignerFromLogin(signer);
      expect(getCachedSigner()).toBeNull();
    });

    it("caches signer and updates timestamps when signer and config are nip46", () => {
      const config = {
        type: "nip46" as const,
        method: "bunker_input" as const,
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      };
      vi.mocked(getActiveSignerConfig).mockReturnValue(config);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip46" } as never;
      const onCached = vi.fn();
      cacheNip46SignerFromLogin(signer, onCached);
      expect(getCachedSigner()).toBe(signer);
      expect(setCachedConfigJson).toHaveBeenCalledWith(JSON.stringify(config));
      expect(getConnectionEstablishedAt()).not.toBeNull();
      expect(getLastActivityTime()).not.toBeNull();
      expect(getLastVerificationTime()).not.toBeNull();
      expect(getNeedsReprobe()).toBe(false);
      expect(onCached).toHaveBeenCalledTimes(1);
    });
  });
});
