/**
 * Unit tests for settings loader validation utilities
 * Tests app/lib/validation/settings-loader.ts
 */

import { describe, it, expect } from "vitest";

import {
  validateSubscription,
  validateAvailablePlans,
  validatePaymentHistory,
  validateAccountChildren,
  validateAccounts,
} from "~/lib/validation/settings-loader";

describe("Settings Loader Validation", () => {
  describe("validateSubscription", () => {
    it("should return null for non-object values", () => {
      expect(validateSubscription(null)).toBeNull();
      expect(validateSubscription(undefined)).toBeNull();
      expect(validateSubscription("string")).toBeNull();
      expect(validateSubscription(123)).toBeNull();
      expect(validateSubscription([])).toBeNull();
    });

    it("should return null for invalid subscription data", () => {
      expect(validateSubscription({})).toBeNull();
      expect(validateSubscription({ invalid: "data" })).toBeNull();
      expect(validateSubscription({ id: "sub-1" })).toBeNull(); // Missing required fields
    });

    it("should return validated subscription for valid data", () => {
      const validSubscription = {
        id: "sub-1",
        planId: "plan-1",
        status: "active",
        startDate: "2024-01-01T00:00:00Z",
        currentPeriodEnd: "2024-02-01T00:00:00Z",
        nextPaymentDue: "2024-02-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        plan: {
          id: "plan-1",
          name: "Pro Plan",
          price: 29.99,
          enableLifetimeAccess: false,
        },
      };

      const result = validateSubscription(validSubscription);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("sub-1");
      expect(result?.status).toBe("active");
    });

    it("should handle nullable fields correctly", () => {
      const subscriptionWithNulls = {
        id: "sub-1",
        planId: null,
        status: "active",
        startDate: "2024-01-01T00:00:00Z",
        currentPeriodEnd: null,
        nextPaymentDue: null,
        cancelAtPeriodEnd: false,
        plan: null,
      };

      const result = validateSubscription(subscriptionWithNulls);
      expect(result).not.toBeNull();
      expect(result?.planId).toBeNull();
      expect(result?.currentPeriodEnd).toBeNull();
      expect(result?.plan).toBeNull();
    });

    it("should handle Date objects", () => {
      const subscriptionWithDates = {
        id: "sub-1",
        planId: "plan-1",
        status: "active",
        startDate: new Date("2024-01-01"),
        currentPeriodEnd: new Date("2024-02-01"),
        nextPaymentDue: null,
        cancelAtPeriodEnd: true,
      };

      const result = validateSubscription(subscriptionWithDates);
      expect(result).not.toBeNull();
      expect(result?.startDate).toBeInstanceOf(Date);
    });
  });

  describe("validateAvailablePlans", () => {
    it("should return empty array for non-array values", () => {
      expect(validateAvailablePlans(null)).toEqual([]);
      expect(validateAvailablePlans(undefined)).toEqual([]);
      expect(validateAvailablePlans({})).toEqual([]);
      expect(validateAvailablePlans("string")).toEqual([]);
      expect(validateAvailablePlans(123)).toEqual([]);
    });

    it("should return empty array for empty array", () => {
      expect(validateAvailablePlans([])).toEqual([]);
    });

    it("should filter out invalid items and keep valid ones", () => {
      const mixed = [
        { id: "plan1", name: "Plan 1", price: 10, enableLifetimeAccess: false },
        { invalid: "data" },
        { id: "plan2", name: "Plan 2", price: 20 },
        { id: "plan3", name: "Plan 3", price: 30, enableLifetimeAccess: true },
      ];

      const result = validateAvailablePlans(mixed);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((p) => p.id === "plan1")).toBe(true);
      expect(result.some((p) => p.id === "plan3")).toBe(true);
    });

    it("should return all valid plans", () => {
      const validPlans = [
        { id: "plan1", name: "Plan 1", price: 10, enableLifetimeAccess: false },
        { id: "plan2", name: "Plan 2", price: 20, enableLifetimeAccess: true },
      ];

      const result = validateAvailablePlans(validPlans);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("plan1");
      expect(result[1]?.id).toBe("plan2");
    });

    it("should handle enableLifetimeAccess defaulting to false", () => {
      const planWithoutFlag = {
        id: "plan1",
        name: "Plan 1",
        price: 10,
      };

      const result = validateAvailablePlans([planWithoutFlag]);
      expect(result[0]?.enableLifetimeAccess).toBe(false);
    });
  });

  describe("validatePaymentHistory", () => {
    it("should return empty array for non-array values", () => {
      expect(validatePaymentHistory(null)).toEqual([]);
      expect(validatePaymentHistory(undefined)).toEqual([]);
      expect(validatePaymentHistory({})).toEqual([]);
      expect(validatePaymentHistory("string")).toEqual([]);
    });

    it("should filter out invalid items and keep valid ones", () => {
      const mixed = [
        {
          id: "pay-1",
          amount: 100,
          amountUsd: 1.0,
          description: "Payment 1",
          paidAt: "2024-01-01T00:00:00Z",
          paymentMethod: "lightning",
          paymentHash: "hash1",
        },
        { invalid: "data" },
        {
          id: "pay-2",
          amount: 200,
          paymentHash: "hash2",
        },
      ];

      const result = validatePaymentHistory(mixed);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((p) => p.id === "pay-1")).toBe(true);
    });

    it("should return all valid payment history items", () => {
      const validPayments = [
        {
          id: "pay-1",
          amount: 100,
          amountUsd: 1.0,
          description: "Payment 1",
          paidAt: "2024-01-01T00:00:00Z",
          paymentMethod: "lightning",
          paymentHash: "hash1",
          planName: "Pro Plan",
          planPrice: 29.99,
        },
        {
          id: "pay-2",
          amount: 200,
          paymentHash: "hash2",
        },
      ];

      const result = validatePaymentHistory(validPayments);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("pay-1");
      expect(result[1]?.id).toBe("pay-2");
    });

    it("should handle nullable fields correctly", () => {
      const paymentWithNulls = {
        id: "pay-1",
        amount: 100,
        amountUsd: null,
        description: null,
        paidAt: null,
        paymentMethod: null,
        paymentHash: "hash1",
      };

      const result = validatePaymentHistory([paymentWithNulls]);
      expect(result[0]?.amountUsd).toBeNull();
      expect(result[0]?.description).toBeNull();
      expect(result[0]?.paidAt).toBeNull();
    });
  });

  describe("validateAccountChildren", () => {
    it("should return empty array for non-array values", () => {
      expect(validateAccountChildren(null)).toEqual([]);
      expect(validateAccountChildren(undefined)).toEqual([]);
      expect(validateAccountChildren({})).toEqual([]);
      expect(validateAccountChildren("string")).toEqual([]);
    });

    it("should filter out invalid items and keep valid ones", () => {
      const mixed = [
        { npub: "npub1test", nostrProfile: null },
        { invalid: "data" },
        { npub: "npub2test" },
      ];

      const result = validateAccountChildren(mixed);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((c) => c.npub === "npub1test")).toBe(true);
      expect(result.some((c) => c.npub === "npub2test")).toBe(true);
    });

    it("should return all valid account children", () => {
      const validChildren = [
        { npub: "npub1test", nostrProfile: { name: "User 1" } },
        { npub: "npub2test", nostrProfile: null },
        { npub: "npub3test" },
      ];

      const result = validateAccountChildren(validChildren);
      expect(result).toHaveLength(3);
      expect(result[0]?.npub).toBe("npub1test");
      expect(result[1]?.npub).toBe("npub2test");
      expect(result[2]?.npub).toBe("npub3test");
    });
  });

  describe("validateAccounts", () => {
    it("should return null for non-object values", () => {
      expect(validateAccounts(null)).toBeNull();
      expect(validateAccounts(undefined)).toBeNull();
      expect(validateAccounts("string")).toBeNull();
      expect(validateAccounts(123)).toBeNull();
      expect(validateAccounts([])).toBeNull();
    });

    it("should return empty object for empty object (schema allows it)", () => {
      // The schema allows empty objects, so it returns an empty object, not null
      const result = validateAccounts({});
      expect(result).not.toBeNull();
      expect(typeof result).toBe("object");
    });

    it("should return validated accounts for valid data", () => {
      const validAccounts = {
        parentNpub: "npub1test",
        confirmedChildren: [
          { npub: "npub2test", nostrProfile: null },
        ],
        pendingChildren: [
          { npub: "npub3test" },
        ],
        isChild: false,
        parentUser: {
          npub: "npub1test",
          nostrProfile: { name: "Parent" },
        },
      };

      const result = validateAccounts(validAccounts);
      expect(result).not.toBeNull();
      expect(result?.parentNpub).toBe("npub1test");
      expect(result?.confirmedChildren).toHaveLength(1);
      expect(result?.pendingChildren).toHaveLength(1);
      expect(result?.isChild).toBe(false);
    });

    it("should handle optional fields", () => {
      const accountsWithMinimalFields = {
        parentNpub: "npub1test",
      };

      const result = validateAccounts(accountsWithMinimalFields);
      expect(result).not.toBeNull();
      expect(result?.parentNpub).toBe("npub1test");
    });

    it("should handle nullable accounts", () => {
      expect(validateAccounts(null)).toBeNull();
    });
  });
});

