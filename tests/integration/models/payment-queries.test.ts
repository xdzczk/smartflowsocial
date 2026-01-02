/**
 * Integration tests for payment model queries
 * Tests app/models/payment.server.ts query functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    payment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "~/lib/prisma.server";
import {
  checkPaymentStatus,
  getUserSubscription,
  getUserPaymentHistory,
  getPlanById,
} from "~/models/payment.server";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Payment Model Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkPaymentStatus", () => {
    it("should return payment status for completed payment", async () => {
      const mockPayment = {
        status: "COMPLETED",
        paidAt: new Date("2024-12-25T12:00:00Z"),
      };
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPayment,
      );

      const result = await checkPaymentStatus("payment-123");

      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: "payment-123" },
        select: {
          status: true,
          paidAt: true,
        },
      });
      expect(result.status).toBe("COMPLETED");
      expect(result.paid).toBe(true);
      expect(result.paidAt).toEqual(mockPayment.paidAt);
    });

    it("should return payment status for pending payment", async () => {
      const mockPayment = {
        status: "PENDING",
        paidAt: null,
      };
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPayment,
      );

      const result = await checkPaymentStatus("payment-123");

      expect(result.status).toBe("PENDING");
      expect(result.paid).toBe(false);
      expect(result.paidAt).toBeUndefined();
    });

    it("should throw error if payment not found", async () => {
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(checkPaymentStatus("nonexistent")).rejects.toThrow(
        "Payment not found",
      );
    });
  });

  describe("getUserSubscription", () => {
    it("should get user subscription", async () => {
      const mockSubscription = {
        id: "sub-123",
        userId: TEST_USER_ID,
        planId: "plan-123",
        isActive: true,
        plan: {
          id: "plan-123",
          name: "Pro Plan",
        },
      };
      (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockSubscription);

      const result = await getUserSubscription(TEST_USER_ID);

      const callArgs = (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as { where?: { userId?: string } } | undefined;
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockSubscription);
    });

    it("should return null if no subscription found", async () => {
      (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getUserSubscription(TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("getUserPaymentHistory", () => {
    it("should get user payment history", async () => {
      const mockPayments = [
        {
          id: "payment-1",
          userId: TEST_USER_ID,
          status: "COMPLETED",
          amount: 1000,
          amountUsd: 10,
        },
        {
          id: "payment-2",
          userId: TEST_USER_ID,
          status: "PENDING",
          amount: 2000,
          amountUsd: 20,
        },
      ];
      (prisma.payment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPayments,
      );

      const result = await getUserPaymentHistory(TEST_USER_ID);

      const callArgs = (prisma.payment.findMany as ReturnType<typeof vi.fn>)
        .mock.calls[0]?.[0] as { where?: { userId?: string } } | undefined;
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockPayments);
    });

    it("should return empty array if no payments found", async () => {
      (prisma.payment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await getUserPaymentHistory(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe("getPlanById", () => {
    it("should get plan by ID", async () => {
      const mockPlan = {
        id: "plan-123",
        name: "Pro Plan",
        price: "10.00",
        isActive: true,
      };
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPlan,
      );

      const result = await getPlanById("plan-123");

      expect(prisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: "plan-123" },
      });
      expect(result).toEqual(mockPlan);
    });

    it("should return null if plan not found", async () => {
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await getPlanById("nonexistent");

      expect(result).toBeNull();
    });
  });
});
