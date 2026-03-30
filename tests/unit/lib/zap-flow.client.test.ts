import { describe, expect, it } from "vitest";

import { buildZapRequestKind9734Tags } from "~/lib/zap-flow.client";

describe("buildZapRequestKind9734Tags", () => {
  const hex = "a".repeat(64) as `${string}` & { length: 64 };

  it("includes e tag when eventIdHex is valid 64-char hex", () => {
    const tags = buildZapRequestKind9734Tags({
      recipientHex: "b".repeat(64),
      millisats: 21_000,
      relays: ["wss://r.test"],
      eventIdHex: hex,
    });
    expect(tags[0]).toEqual(["p", "b".repeat(64)]);
    expect(tags[1]).toEqual(["e", "a".repeat(64)]);
    expect(tags[2]).toEqual(["amount", "21000"]);
    expect(tags[3]?.[0]).toBe("relays");
  });

  it("omits e tag when eventIdHex is absent", () => {
    const tags = buildZapRequestKind9734Tags({
      recipientHex: "b".repeat(64),
      millisats: 1000,
      relays: ["wss://r.test"],
    });
    expect(tags.some((t) => t[0] === "e")).toBe(false);
  });

  it("omits e tag for invalid event id", () => {
    const tags = buildZapRequestKind9734Tags({
      recipientHex: "b".repeat(64),
      millisats: 1000,
      relays: ["wss://r.test"],
      eventIdHex: "tooshort",
    });
    expect(tags.some((t) => t[0] === "e")).toBe(false);
  });
});
