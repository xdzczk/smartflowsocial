import { describe, expect, it } from "vitest";

import {
  parseCustomNpubLines,
  normalizePubkeyInput,
} from "~/features/broadcast/broadcast-resolve.server";

describe("broadcast-resolve", () => {
  it("parseCustomNpubLines dedupes and counts invalid", () => {
    const hex = "a".repeat(64);
    const { valid, invalid } = parseCustomNpubLines([
      hex,
      hex.toUpperCase(),
      "bad",
      "",
      "  ",
    ]);
    expect(valid).toEqual([hex.toLowerCase()]);
    expect(invalid).toBe(1);
  });

  it("normalizePubkeyInput accepts 64 hex", () => {
    const h = "b".repeat(64);
    expect(normalizePubkeyInput(h)).toBe(h);
  });
});
