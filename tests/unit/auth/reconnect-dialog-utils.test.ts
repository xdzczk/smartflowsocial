/**
 * Unit tests for reconnect dialog utils.
 * Tests app/features/auth/reconnect-dialog-utils.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildRelayUnion,
  debugReconnectTrace,
  DEFAULT_RELAYS,
  DEFAULT_RELAYS_ARRAY,
  RELAY_UNION_CAP,
  PROFILE_MISMATCH_MESSAGE,
  TOAST_RECONNECT_SUCCESS,
  METHOD_BUNKER_INPUT,
} from "~/features/auth/reconnect-dialog-utils.client";
import { BRAND_NAME } from "~/lib/brand";

describe("reconnect-dialog-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  describe("buildRelayUnion", () => {
    it("returns empty array when stored and defaults are empty", () => {
      expect(buildRelayUnion([], [], 5)).toEqual([]);
    });

    it("merges stored and defaults and deduplicates by normalized url", () => {
      const stored = ["wss://relay.A.com  "];
      const defaults = ["wss://relay.a.com", "wss://relay.b.com"];
      const out = buildRelayUnion(stored, defaults, 10);
      expect(out).toContain("wss://relay.A.com  ".trim());
      expect(out).toContain("wss://relay.b.com");
      expect(out.length).toBe(2);
    });

    it("respects cap", () => {
      const stored = ["wss://a.com", "wss://b.com"];
      const defaults = ["wss://c.com", "wss://d.com"];
      const out = buildRelayUnion(stored, defaults, 2);
      expect(out).toHaveLength(2);
    });

    it("filters out non-wss URLs", () => {
      const stored = ["wss://ok.com", "https://skip.com", "http://skip.com"];
      const out = buildRelayUnion(stored, [], 10);
      expect(out).toEqual(["wss://ok.com"]);
    });

    it("uses RELAY_UNION_CAP when cap not provided", () => {
      const many = Array.from({ length: 20 }, (_, i) => `wss://r${i}.com`);
      const out = buildRelayUnion(many, [], undefined as unknown as number);
      expect(out.length).toBe(RELAY_UNION_CAP);
    });
  });

  describe("debugReconnectTrace", () => {
    it("calls console.info with message only when no details", () => {
      debugReconnectTrace("test message");
      expect(console.info).toHaveBeenCalledWith(
        "[remote-signer-reconnect] test message"
      );
    });

    it("calls console.info with message and details when details provided", () => {
      debugReconnectTrace("with details", { foo: "bar" });
      expect(console.info).toHaveBeenCalledWith(
        "[remote-signer-reconnect] with details",
        { foo: "bar" }
      );
    });
  });

  describe("constants", () => {
    it("exports expected constants", () => {
      expect(DEFAULT_RELAYS).toContain("wss://");
      expect(DEFAULT_RELAYS_ARRAY).toEqual(expect.any(Array));
      expect(RELAY_UNION_CAP).toBe(8);
      expect(PROFILE_MISMATCH_MESSAGE).toBe(
        `Different signer profile detected. Please activate the same identity as your ${BRAND_NAME} connection.`
      );
      expect(TOAST_RECONNECT_SUCCESS).toBe("Remote signer reconnected.");
      expect(METHOD_BUNKER_INPUT).toBe("bunker_input");
    });
  });
});
