import { describe, expect, it } from "vitest";

import { getMetricDefinition } from "~/features/admin/metrics/registry";
import {
  confidenceForCount,
  confidenceForRate,
} from "~/features/admin/metrics/resolve-confidence";

describe("admin resolve-confidence", () => {
  it("rates empty attempts as insufficient", () => {
    expect(confidenceForRate(0, 0).confidence).toBe("insufficient_sample");
  });

  it("rates large samples as confident", () => {
    expect(confidenceForRate(95, 100).confidence).toBe("confident");
  });

  it("counts use thresholds", () => {
    expect(confidenceForCount(0)).toBe("insufficient_sample");
    expect(confidenceForCount(5)).toBe("directional");
    expect(confidenceForCount(20)).toBe("confident");
  });
});

describe("admin metric registry", () => {
  it("exposes MRR definition", () => {
    const d = getMetricDefinition("mrr_sats");
    expect(d.key).toBe("mrr_sats");
    expect(d.domain).toBe("business");
  });
});
