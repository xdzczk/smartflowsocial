import { describe, it, expect } from "vitest";

import {
  computeFinalizationFeeSats,
  getFinalizationFeeRateBps,
} from "~/features/giveaway/giveaway-finalization-fee.shared";

describe("giveaway-finalization-fee.shared", () => {
  it("maps plan types to bps", () => {
    expect(getFinalizationFeeRateBps("free")).toBe(1000);
    expect(getFinalizationFeeRateBps("basic")).toBe(500);
    expect(getFinalizationFeeRateBps("premium")).toBe(0);
    expect(getFinalizationFeeRateBps("founder")).toBe(0);
    expect(getFinalizationFeeRateBps("pro")).toBe(0);
  });

  it("charges no fee when payout is zero", () => {
    const r = computeFinalizationFeeSats(0, 1000);
    expect(r.feeSats).toBe(0);
    expect(r.waivedByPlan).toBe(false);
  });

  it("applies minimum 1 sat on basic when percentage rounds to zero", () => {
    const r = computeFinalizationFeeSats(11, 500);
    expect(r.feeSats).toBe(1);
    expect(r.waivedByPlan).toBe(false);
  });

  it("waives by plan when bps is zero and payout positive", () => {
    const r = computeFinalizationFeeSats(10_000, 0);
    expect(r.feeSats).toBe(0);
    expect(r.waivedByPlan).toBe(true);
  });
});
