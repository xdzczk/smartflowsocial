import { describe, expect, it } from "vitest";

import { getBroadcastMessageLintWarnings } from "~/features/broadcast/broadcast-message-lint";

describe("broadcast-message-lint", () => {
  it("warns on very short body", () => {
    const w = getBroadcastMessageLintWarnings("hi");
    expect(w.some((x) => x.message.includes("short"))).toBe(true);
  });

  it("warns on many links", () => {
    const body = Array.from({ length: 5 }, () => "https://a.com/x").join(" ");
    const w = getBroadcastMessageLintWarnings(body);
    expect(w.some((x) => x.message.includes("links"))).toBe(true);
  });
});
