import { describe, it, expect } from "vitest";

import { parseNip65WriteRelaysFromEventTags } from "~/features/relays/nip65-profile-relays.server";

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
