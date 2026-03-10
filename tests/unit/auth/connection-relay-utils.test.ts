import { describe, expect, it } from "vitest";

import {
  buildRelayUnion,
  normalizeRelayList,
  relayListsEqual,
} from "~/features/auth/signer/connection-relay-utils.client";

describe("connection-relay-utils", () => {
  describe("normalizeRelayList", () => {
    it("trims and deduplicates wss relays", () => {
      expect(
        normalizeRelayList([
          "  wss://a.com  ",
          "wss://a.com",
          "wss://b.com",
          "https://c.com",
        ])
      ).toEqual(["  wss://a.com  ".trim(), "wss://b.com"]);
    });

    it("filters out non-wss URLs", () => {
      expect(normalizeRelayList(["wss://r.com", "http://x.com"])).toEqual([
        "wss://r.com",
      ]);
    });
  });

  describe("relayListsEqual", () => {
    it("returns true for same relays in different order", () => {
      expect(
        relayListsEqual(
          ["wss://a.com", "wss://b.com"],
          ["wss://b.com", "wss://a.com"]
        )
      ).toBe(true);
    });

    it("returns false for different length or content", () => {
      expect(
        relayListsEqual(["wss://a.com"], ["wss://a.com", "wss://b.com"])
      ).toBe(false);
      expect(relayListsEqual(["wss://a.com"], ["wss://b.com"])).toBe(false);
    });
  });

  describe("buildRelayUnion", () => {
    it("merges stored and defaults up to cap", () => {
      const stored = ["wss://one.com"];
      const defaults = ["wss://two.com", "wss://three.com"];
      const out = buildRelayUnion(stored, defaults, 3);
      expect(out).toHaveLength(3);
      expect(out).toContain("wss://one.com");
      expect(out).toContain("wss://two.com");
      expect(out).toContain("wss://three.com");
    });

    it("respects cap", () => {
      const stored = ["wss://a.com", "wss://b.com"];
      const defaults = ["wss://c.com", "wss://d.com"];
      const out = buildRelayUnion(stored, defaults, 2);
      expect(out).toHaveLength(2);
    });
  });
});
