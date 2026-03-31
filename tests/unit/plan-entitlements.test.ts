import { describe, it, expect } from "vitest";

import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";

describe("getPlanEntitlements", () => {
  it("applies free-like caps to free and teams", () => {
    for (const plan of ["free", "teams"] as const) {
      const e = getPlanEntitlements(plan);
      expect(e.maxFutureScheduledItems).toBe(10);
      expect(e.maxQueues).toBe(1);
      expect(e.maxDrafts).toBe(5);
      expect(e.maxTemplates).toBe(5);
      expect(e.canSendBroadcast).toBe(false);
      expect(e.canExecuteBulkActions).toBe(false);
    }
  });

  it("removes caps for basic", () => {
    const e = getPlanEntitlements("basic");
    expect(e.maxFutureScheduledItems).toBeNull();
    expect(e.maxQueues).toBeNull();
    expect(e.canSendBroadcast).toBe(true);
    expect(e.canExecuteBulkActions).toBe(true);
  });
});
