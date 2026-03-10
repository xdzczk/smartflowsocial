/**
 * Unit tests for settings loader validation schemas
 * Tests app/lib/validation/schemas/settings-loader.schemas.ts
 */

import { describe, it, expect } from "vitest";

import {
  subscriptionSchema,
  availablePlanSchema,
  paymentHistoryItemSchema,
  accountChildSchema,
  accountsSchema,
} from "~/lib/validation/schemas/settings-loader.schemas";

describe("settings-loader.schemas", () => {
  describe("subscriptionSchema", () => {
    it("parses null", () => {
      expect(subscriptionSchema.parse(null)).toBeNull();
    });

    it("parses valid subscription with Date preprocess", () => {
      const startDate = new Date("2025-01-01");
      const result = subscriptionSchema.parse({
        id: "sub_1",
        planId: "plan_1",
        status: "active",
        startDate,
        currentPeriodEnd: "2025-02-01",
        nextPaymentDue: null,
        cancelAtPeriodEnd: false,
        plan: {
          id: "p1",
          name: "Pro",
          price: 1000,
          enableLifetimeAccess: false,
        },
      });
      expect(result).not.toBeNull();
      expect(result?.startDate).toBeInstanceOf(Date);
      expect(result?.currentPeriodEnd).toBeInstanceOf(Date);
      expect(result?.nextPaymentDue).toBeNull();
    });

    it("preprocesses string dates to Date", () => {
      const result = subscriptionSchema.parse({
        id: "sub_1",
        planId: null,
        status: "canceled",
        startDate: "2025-01-01T00:00:00.000Z",
        currentPeriodEnd: null,
        nextPaymentDue: null,
        cancelAtPeriodEnd: true,
        plan: null,
      });
      expect(result?.startDate).toBeInstanceOf(Date);
    });
  });

  describe("availablePlanSchema", () => {
    it("parses valid plan with enableLifetimeAccess default", () => {
      const result = availablePlanSchema.parse({
        id: "plan_1",
        name: "Pro",
        price: 1000,
      });
      expect(result.enableLifetimeAccess).toBe(false);
    });

    it("preprocesses enableLifetimeAccess", () => {
      const result = availablePlanSchema.parse({
        id: "plan_1",
        name: "Pro",
        price: 1000,
        enableLifetimeAccess: true,
      });
      expect(result.enableLifetimeAccess).toBe(true);
    });
  });

  describe("paymentHistoryItemSchema", () => {
    it("parses valid payment with preprocess for paidAt", () => {
      const result = paymentHistoryItemSchema.parse({
        id: "pay_1",
        amount: 100,
        amountUsd: 1.5,
        description: "Subscription",
        paidAt: "2025-01-15T12:00:00.000Z",
        paymentMethod: "card",
        paymentHash: "abc123",
        planName: "Pro",
        planPrice: 1000,
      });
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it("preprocesses null paidAt", () => {
      const result = paymentHistoryItemSchema.parse({
        id: "pay_1",
        amount: 100,
        amountUsd: null,
        description: null,
        paidAt: null,
        paymentMethod: null,
        paymentHash: "h",
      });
      expect(result.paidAt).toBeNull();
      expect(result.description).toBeNull();
    });
  });

  describe("accountChildSchema", () => {
    it("parses npub and optional nostrProfile", () => {
      const result = accountChildSchema.parse({
        npub: "npub1abc",
        nostrProfile: null,
      });
      expect(result.npub).toBe("npub1abc");
      expect(result.nostrProfile).toBeNull();
    });
  });

  describe("accountsSchema", () => {
    it("parses null", () => {
      expect(accountsSchema.parse(null)).toBeNull();
    });

    it("parses valid accounts with optional children", () => {
      const result = accountsSchema.parse({
        parentNpub: "npub1parent",
        confirmedChildren: [{ npub: "npub1child" }],
        pendingChildren: [],
        isChild: false,
        parentUser: null,
      });
      expect(result).not.toBeNull();
      expect(result?.confirmedChildren).toHaveLength(1);
      expect(result?.parentUser).toBeNull();
    });
  });
});
