import { describe, it, expect } from "vitest";

import { normalizeUserRelayUrlsForQuery } from "~/features/engagement/services/relay-mentions-fallback.server";

describe("normalizeUserRelayUrlsForQuery", () => {
  it("returns null for empty or missing", () => {
    expect(normalizeUserRelayUrlsForQuery(null)).toBeNull();
    expect(normalizeUserRelayUrlsForQuery(undefined)).toBeNull();
    expect(normalizeUserRelayUrlsForQuery([])).toBeNull();
  });

  it("keeps valid wss URLs and dedupes", () => {
    expect(
      normalizeUserRelayUrlsForQuery([
        "wss://relay.a.com",
        "wss://relay.b.com",
        "wss://relay.a.com",
        "bad",
        "",
      ])
    ).toEqual(["wss://relay.a.com", "wss://relay.b.com"]);
  });
});
