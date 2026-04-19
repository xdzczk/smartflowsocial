/**
 * Unit tests for connection-cache (get/set, resetCachedSigner, cacheNip46SignerFromLogin).
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
  getInFlightSignerPromise,
  setInFlightSignerPromise,
  getInFlightSignerConfigJson,
  setInFlightSignerConfigJson,
  resetCachedSigner,
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

  describe("get/set cached signer", () => {
    it("getCachedSigner returns null initially", () => {
      expect(getCachedSigner()).toBeNull();
    });

    it("setCachedSigner and getCachedSigner round-trip", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const signer = { type: "nip46" } as never;
      setCachedSigner(signer);
      expect(getCachedSigner()).toBe(signer);
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
  });

  describe("resetCachedSigner", () => {
    it("clears cached signer and in-flight state", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      setCachedSigner({ type: "nip46" } as never);
      setInFlightSignerPromise(Promise.resolve(null as never));
      setInFlightSignerConfigJson("x");
      resetCachedSigner();
      expect(getCachedSigner()).toBeNull();
      expect(getInFlightSignerPromise()).toBeNull();
      expect(getInFlightSignerConfigJson()).toBeNull();
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

    it("caches signer and persists config json when both are nip46", () => {
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
      expect(onCached).toHaveBeenCalledTimes(1);
    });
  });
});
