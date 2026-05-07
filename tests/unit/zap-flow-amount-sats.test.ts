import { describe, expect, it } from "vitest";

import { coercePositiveAmountSats } from "~/lib/zap-flow.client";

describe("coercePositiveAmountSats", () => {
  it("accepts positive integers", () => {
    expect(coercePositiveAmountSats(100)).toBe(100);
    expect(coercePositiveAmountSats(1)).toBe(1);
  });

  it("parses numeric strings (JSON / hydration edge cases)", () => {
    expect(coercePositiveAmountSats("100")).toBe(100);
    expect(coercePositiveAmountSats(" 42 ")).toBe(42);
  });

  it("floors fractional numbers", () => {
    expect(coercePositiveAmountSats(99.9)).toBe(99);
  });

  it("returns undefined for invalid or non-positive values", () => {
    expect(coercePositiveAmountSats(undefined)).toBeUndefined();
    expect(coercePositiveAmountSats(null)).toBeUndefined();
    expect(coercePositiveAmountSats(0)).toBeUndefined();
    expect(coercePositiveAmountSats(-5)).toBeUndefined();
    expect(coercePositiveAmountSats("")).toBeUndefined();
    expect(coercePositiveAmountSats("nan")).toBeUndefined();
  });

  it("accepts bigint", () => {
    expect(coercePositiveAmountSats(100n)).toBe(100);
  });
});
