/**
 * Integration tests for Payment model functions
 * 
 * Tests the database operations in app/models/payment.server.ts
 * Uses mocked Prisma and external services to test business logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPlanInvoice,
  checkPaymentStatus,
  getUserSubscription,
  getAllPlans,
  getPlanById,
} from "~/models/payment.server";

// Mock Prisma - use vi.hoisted to allow top-level variables in mocks
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    plan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

// Mock external dependencies
vi.mock("~/features/payments/btc.rate", () => ({
  getBitcoinRate: vi.fn(),
}));

vi.mock("@getalby/sdk/lnclient", () => ({
  LN: vi.fn(),
  USD: vi.fn((amount) => amount),
}));

vi.mock("~/models/payment.server", async () => {
  const actual = await vi.importActual("~/models/payment.server");
  return {
    ...actual,
    updateUserSubscription: vi.fn(),
  };
});

import { getBitcoinRate } from "~/features/payments/btc.rate";
import { LN } from "@getalby/sdk/lnclient";

describe("Payment Model Functions", () => {
  const TEST_USER_ID = "user-123";
  const TEST_PLAN_ID = "plan-123";
  const TEST_PAYMENT_ID = "payment-123";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OWNER_NWC = "test-nwc-credentials";
  });

  describe("createPlanInvoice", () => {
    it("should create invoice for free plan", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Free Plan",
        price: 0,
        isActive: true,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        userId: TEST_USER_ID,
        amount: 0,
        status: "COMPLETED",
      });

      const { createPlanInvoice } = await import("~/models/payment.server");

      const result = await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
        description: "Free plan subscription",
      });

      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          amount: 0,
          invoice: "free_plan",
          status: "COMPLETED",
        }),
      });
      expect(result.invoice).toBe("free_plan");
      expect(result.amount).toBe(0);
    });

    it("should throw error for non-existent plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const { createPlanInvoice } = await import("~/models/payment.server");

      await expect(
        createPlanInvoice({
          planId: "invalid-plan",
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("Plan with ID invalid-plan not found");
    });

    it("should throw error for inactive plan", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Inactive Plan",
        price: 1000,
        isActive: false,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const { createPlanInvoice } = await import("~/models/payment.server");

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("is not currently available");
    });
  });

  describe("checkPaymentStatus", () => {
    it("should return payment status for completed payment", async () => {
      const mockPayment = {
        id: TEST_PAYMENT_ID,
        status: "COMPLETED",
        paidAt: new Date("2024-01-15"),
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await checkPaymentStatus(TEST_PAYMENT_ID);

      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        select: {
          paidAt: true,
          status: true,
        },
      });
      expect(result).toEqual({
        paid: true,
        paidAt: mockPayment.paidAt,
        status: "COMPLETED",
      });
    });

    it("should return payment status for pending payment", async () => {
      const mockPayment = {
        id: TEST_PAYMENT_ID,
        status: "PENDING",
        paidAt: null,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await checkPaymentStatus(TEST_PAYMENT_ID);

      expect(result).toEqual({
        paid: false,
        paidAt: undefined,
        status: "PENDING",
      });
    });

    it("should handle payment not found", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(checkPaymentStatus("invalid-payment")).rejects.toThrow();
    });
  });

  describe("getUserSubscription", () => {
    it("should get user subscription with plan", async () => {
      const mockSubscription = {
        id: "sub-123",
        userId: TEST_USER_ID,
        planId: TEST_PLAN_ID,
        Plan: {
          id: TEST_PLAN_ID,
          name: "Basic Plan",
          price: 1000,
        },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await getUserSubscription(TEST_USER_ID);

      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        include: { Plan: true },
      });
      expect(result).toEqual(mockSubscription);
    });

    it("should return null when user has no subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await getUserSubscription(TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("getAllPlans", () => {
    it("should get all active plans", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          name: "Free Plan",
          price: 0,
          isActive: true,
        },
        {
          id: "plan-2",
          name: "Basic Plan",
          price: 1000,
          isActive: true,
        },
      ];

      mockPrisma.plan.findMany.mockResolvedValue(mockPlans);

      const result = await getAllPlans();

      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { price: "asc" },
      });
      expect(result).toEqual(mockPlans);
    });
  });

  describe("getPlanById", () => {
    it("should get a plan by id", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 1000,
        isActive: true,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await getPlanById(TEST_PLAN_ID);

      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
      expect(result).toEqual(mockPlan);
    });

    it("should return null for non-existent plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const result = await getPlanById("invalid-plan");

      expect(result).toBeNull();
    });
  });
});

