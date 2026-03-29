import { describe, it, expect } from "vitest";

import {
  parseNip65ProfileRelayEntriesFromEventTags,
  parseNip65WriteRelaysFromEventTags,
} from "~/features/relays/nip65-profile-relays.server";

describe("parseNip65ProfileRelayEntriesFromEventTags", () => {
  it("preserves order and scopes (unmarked → both)", () => {
    const tags = [
      ["r", "wss://relay.a.com"],
      ["r", "wss://relay.b.com", "write"],
      ["r", "wss://relay.c.com", "read"],
      ["p", "abc"],
    ];
    expect(parseNip65ProfileRelayEntriesFromEventTags(tags)).toEqual([
      { url: "wss://relay.a.com", scope: "both" },
      { url: "wss://relay.b.com", scope: "write" },
      { url: "wss://relay.c.com", scope: "read" },
    ]);
  });

  it("treats unknown third field as both", () => {
    const tags = [["r", "wss://relay.a.com", "nope"]];
    expect(parseNip65ProfileRelayEntriesFromEventTags(tags)).toEqual([
      { url: "wss://relay.a.com", scope: "both" },
    ]);
  });
});

describe("parseNip65WriteRelaysFromEventTags", () => {
  it("includes unmarked r tags and write-marked tags", () => {
    const tags = [
      ["r", "wss://relay.a.com"],
      ["r", "wss://relay.b.com", "write"],
      ["r", "wss://relay.c.com", "read"],
      ["p", "abc"],
    ];
    expect(parseNip65WriteRelaysFromEventTags(tags)).toEqual([
      "wss://relay.a.com",
      "wss://relay.b.com",
    ]);
  });

  it("returns empty for invalid input", () => {
    expect(parseNip65WriteRelaysFromEventTags(null)).toEqual([]);
    expect(parseNip65WriteRelaysFromEventTags("x")).toEqual([]);
  });
});
