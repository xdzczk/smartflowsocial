/**
 * Unit tests for remote-signer-sessions-detect (detectSignerAppName, maskConnectionUri).
 */

import { describe, expect, it } from "vitest";

import {
  detectSignerAppName,
  maskConnectionUri,
} from "~/features/auth/signer/remote-signer-sessions.client";

describe("remote-signer-sessions-detect", () => {
  describe("detectSignerAppName", () => {
    it("returns Browser Extension for nip07", () => {
      expect(detectSignerAppName({ type: "nip07" })).toBe("Browser Extension");
    });

    it("returns app name from bunker_input hostname", () => {
      expect(
        detectSignerAppName({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "https://bunker.primal.net/xxx",
          clientSecretKeyHex: "ab",
        })
      ).toBe("Primal");
      expect(
        detectSignerAppName({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "https://relay.damus.io/bunker",
          clientSecretKeyHex: "ab",
        })
      ).toBe("Damus");
    });

    it("returns name from nostrconnect_uri ?name= param when present", () => {
      expect(
        detectSignerAppName({
          type: "nip46",
          method: "nostrconnect_uri",
          uri: "nostrconnect://x?relay=wss://a&name=My%20App&secret=s",
          relays: ["wss://relay.damus.io"],
          clientSecretKeyHex: "ab",
        })
      ).toBe("My App");
    });

    it("returns app name from relay hostname when uri has no name param", () => {
      expect(
        detectSignerAppName({
          type: "nip46",
          method: "nostrconnect_uri",
          uri: "nostrconnect://x?relay=wss://relay.primal.net&secret=s",
          relays: ["wss://relay.primal.net"],
          clientSecretKeyHex: "ab",
        })
      ).toBe("Primal");
    });
  });

  describe("maskConnectionUri", () => {
    it("returns uri as-is when length <= 50", () => {
      const short = "https://short.uri";
      expect(maskConnectionUri(short)).toBe(short);
    });

    it("masks long uri with start and end", () => {
      const long =
        "nostrconnect://verylongclientid?relay=wss://relay.example.com&secret=abcdef";
      const masked = maskConnectionUri(long);
      expect(masked.length).toBeLessThan(long.length);
      expect(masked).toMatch(/^.{20}\.\.\..{10}$/);
      expect(masked.startsWith(long.slice(0, 20))).toBe(true);
      expect(masked.endsWith(long.slice(-10))).toBe(true);
    });
  });
});
