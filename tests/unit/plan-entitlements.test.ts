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

  it("applies concrete caps for creator", () => {
    const e = getPlanEntitlements("creator");
    expect(e.maxFutureScheduledItems).toBe(200);
    expect(e.maxQueues).toBe(5);
    expect(e.maxDrafts).toBe(100);
    expect(e.maxTemplates).toBe(100);
    expect(e.canSendBroadcast).toBe(true);
    expect(e.canExecuteBulkActions).toBe(true);
  });

  it("applies Starter concrete limits", () => {
    const e = getPlanEntitlements("starter");
    expect(e.maxFutureScheduledItems).toBe(50);
    expect(e.maxQueues).toBe(2);
    expect(e.maxDrafts).toBe(25);
    expect(e.maxTemplates).toBe(25);
    expect(e.canExecuteBulkActions).toBe(true);
  });

  it("applies highest concrete caps for pro", () => {
    const e = getPlanEntitlements("pro");
    expect(e.maxFutureScheduledItems).toBe(1000);
    expect(e.maxQueues).toBe(15);
    expect(e.maxDrafts).toBe(500);
    expect(e.maxTemplates).toBe(500);
    expect(e.canSendBroadcast).toBe(true);
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
