import { describe, it, expect } from "vitest";

import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import { getCanonicalPlanPolicy } from "~/features/payments/plan-policy";

describe("getPlanEntitlements", () => {
  it("applies strict caps to free", () => {
    const e = getPlanEntitlements("free");
    expect(e.maxFutureScheduledItems).toBe(10);
    expect(e.maxQueues).toBe(1);
    expect(e.maxDrafts).toBe(5);
    expect(e.maxTemplates).toBe(5);
    expect(e.canSendBroadcast).toBe(false);
    expect(e.canExecuteBulkActions).toBe(false);
  });

  it("removes caps for creator", () => {
    const e = getPlanEntitlements("creator");
    expect(e.maxFutureScheduledItems).toBeNull();
    expect(e.maxQueues).toBeNull();
    expect(e.canSendBroadcast).toBe(true);
    expect(e.canExecuteBulkActions).toBe(true);
  });

  it("applies Starter queue and bulk defaults", () => {
    const e = getPlanEntitlements("starter");
    expect(e.maxQueues).toBe(2);
    expect(e.canExecuteBulkActions).toBe(true);
  });
});

describe("getCanonicalPlanPolicy accountsIncluded", () => {
  it("matches public pricing boundaries", () => {
    expect(getCanonicalPlanPolicy("free").accountsIncluded).toBe(1);
    expect(getCanonicalPlanPolicy("starter").accountsIncluded).toBe(1);
    expect(getCanonicalPlanPolicy("creator").accountsIncluded).toBe(2);
    expect(getCanonicalPlanPolicy("pro").accountsIncluded).toBe(5);
    expect(getCanonicalPlanPolicy("founder").accountsIncluded).toBe(5);
    expect(getCanonicalPlanPolicy("teams").accountsIncluded).toBe(1);
  });
});
