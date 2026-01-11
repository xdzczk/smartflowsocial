/**
 * Integration tests for payment model queries
 * Tests app/models/payment.server.ts query functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  checkPaymentStatus,
  getUserSubscription,
  getUserPaymentHistory,
  getPlanById,
} from "~/models/payment.server";
import {
  resetMockPaymentPrismaTransaction,
  createMockPayment,
  createMockPlan,
  createMockSubscription,
  setupPaymentTestEnvironment,
  TEST_USER_ID,
  TEST_PLAN_ID,
  TEST_PAYMENT_ID,
} from "~/tests/utils/payment-test-helpers";

// Mock Prisma

const { mockPrisma } = vi.hoisted(async () => {
  // Import inside hoisted to avoid initialization issues
  const { createMockPaymentPrisma: createMock } =
    await import("../../utils/payment-test-helpers");
  const mockPrisma = createMock();
  return { mockPrisma };
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import needed for hoisting
}) as unknown as {
  mockPrisma: ReturnType<
    Awaited<
      typeof import("../../utils/payment-test-helpers")
    >["createMockPaymentPrisma"]
  >;
};

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

describe("Payment Model Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  describe("checkPaymentStatus", () => {
    it("should return payment status for completed payment", async () => {
      const mockPayment = createMockPayment({
        status: "COMPLETED",
      });
      (mockPayment as unknown as { paidAt: Date }).paidAt = new Date(
        "2024-12-25T12:00:00Z"
      );

      (
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPayment);

      const result = await checkPaymentStatus(TEST_PAYMENT_ID);

      expect(
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        select: {
          status: true,
          paidAt: true,
        },
      });
      expect(result.status).toBe("COMPLETED");
      expect(result.paid).toBe(true);
      expect(result.paidAt).toEqual(
        (mockPayment as unknown as { paidAt: Date | null }).paidAt
      );
    });

    it("should return payment status for pending payment", async () => {
      const mockPayment = createMockPayment({
        status: "PENDING",
      });
      (mockPayment as unknown as { paidAt: Date | null }).paidAt = null;

      (
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPayment);

      const result = await checkPaymentStatus(TEST_PAYMENT_ID);

      expect(result.status).toBe("PENDING");
      expect(result.paid).toBe(false);
      expect(result.paidAt).toBeUndefined();
    });

    it("should throw error if payment not found", async () => {
      (
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      await expect(checkPaymentStatus("nonexistent")).rejects.toThrow(
        "Payment not found"
      );
    });
  });

  describe("getUserSubscription", () => {
    it("should get user subscription", async () => {
      const mockSubscription = createMockSubscription({
        planId: TEST_PLAN_ID,
      });
      (
        mockSubscription as unknown as { plan: { id: string; name: string } }
      ).plan = {
        id: TEST_PLAN_ID,
        name: "Pro Plan",
      };

      (
        mockPrisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockSubscription);

      const result = await getUserSubscription(TEST_USER_ID);

      const callArgs = (
        mockPrisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as { where?: { userId?: string } } | undefined;
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockSubscription);
    });

    it("should return null if no subscription found", async () => {
      (
        mockPrisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getUserSubscription(TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("getUserPaymentHistory", () => {
    it("should get user payment history", async () => {
      const mockPayments = [
        createMockPayment({
          id: "payment-1",
          status: "COMPLETED",
          amount: 1000,
        }),
        createMockPayment({
          id: "payment-2",
          status: "PENDING",
          amount: 2000,
        }),
      ];
      (mockPayments[0] as unknown as { amountUsd: number }).amountUsd = 10;
      (mockPayments[1] as unknown as { amountUsd: number }).amountUsd = 20;

      (
        mockPrisma.payment.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPayments);

      const result = await getUserPaymentHistory(TEST_USER_ID);

      const callArgs = (mockPrisma.payment.findMany as ReturnType<typeof vi.fn>)
        .mock.calls[0]?.[0] as { where?: { userId?: string } } | undefined;
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockPayments);
    });

    it("should return empty array if no payments found", async () => {
      (
        mockPrisma.payment.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const result = await getUserPaymentHistory(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe("getPlanById", () => {
    it("should get plan by ID", async () => {
      const mockPlan = createMockPlan({
        name: "Pro Plan",
        price: 10,
      });

      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);

      const result = await getPlanById(TEST_PLAN_ID);

      expect(
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
      expect(result).toEqual(mockPlan);
    });

    it("should return null if plan not found", async () => {
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getPlanById("nonexistent");

      expect(result).toBeNull();
    });
  });
});
