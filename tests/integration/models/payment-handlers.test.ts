/**
 * Integration tests for payment handlers
 * Tests app/models/payment.server.ts handler functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    payment: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    subscription: {
      upsert: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

import { prisma } from "~/lib/prisma.server";
import {
  handlePaymentCompleted,
  handlePaymentTimeout,
  updateUserSubscription,
  getAllPlans,
} from "~/models/payment.server";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Payment Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handlePaymentCompleted", () => {
    it("should update payment status and subscription", async () => {
      const mockPayment = { id: "payment-123", status: "COMPLETED" };
      (prisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "plan-123",
        price: "10.00",
        enableLifetimeAccess: false,
      });
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        amount: 1000,
      });
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => {
        return await callback(prisma);
      });
      (prisma.subscription.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sub-123" });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });

      await handlePaymentCompleted("payment-123", TEST_USER_ID, "plan-123");

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: "payment-123" },
        data: {
          status: "COMPLETED",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          paidAt: expect.any(Date),
        },
      });
    });

    it("should handle errors and rethrow", async () => {
      (prisma.payment.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));

      await expect(
        handlePaymentCompleted("payment-123", TEST_USER_ID, "plan-123"),
      ).rejects.toThrow("DB error");
    });
  });

  describe("handlePaymentTimeout", () => {
    it("should mark payment as expired", async () => {
      const mockPayment = { id: "payment-123", status: "EXPIRED" };
      (prisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);

      await handlePaymentTimeout("payment-123");

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: "payment-123" },
        data: {
          status: "EXPIRED",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          failedAt: expect.any(Date),
          failureReason: "Payment timeout",
        },
      });
    });

    it("should handle errors gracefully", async () => {
      (prisma.payment.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));

      // Should not throw
      await handlePaymentTimeout("payment-123");
    });
  });

  describe("updateUserSubscription", () => {
    it("should create subscription for lifetime plan", async () => {
      const mockPlan = {
        id: "plan-123",
        price: "100.00",
        enableLifetimeAccess: true,
      };
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlan);
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ amount: 10000 });
      
      const mockTx = {
        subscription: {
          upsert: vi.fn().mockResolvedValue({ id: "sub-123" }),
        },
        payment: {
          update: vi.fn().mockResolvedValue({}),
        },
        user: {
          update: vi.fn().mockResolvedValue({ id: TEST_USER_ID }),
        },
      };
      
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
        return await callback(mockTx);
      });

      await updateUserSubscription(TEST_USER_ID, "plan-123", "payment-123");

      const upsertCall = mockTx.subscription.upsert.mock.calls[0]?.[0] as { create?: { currentPeriodEnd?: Date | null; nextPaymentDue?: Date | null } } | undefined;
      expect(upsertCall?.create?.currentPeriodEnd).toBeNull();
      expect(upsertCall?.create?.nextPaymentDue).toBeNull();
    });

    it("should create subscription for monthly plan", async () => {
      const mockPlan = {
        id: "plan-123",
        price: "10.00",
        enableLifetimeAccess: false,
      };
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlan);
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ amount: 1000 });
      
      const mockTx = {
        subscription: {
          upsert: vi.fn().mockResolvedValue({ id: "sub-123" }),
        },
        payment: {
          update: vi.fn().mockResolvedValue({}),
        },
        user: {
          update: vi.fn().mockResolvedValue({ id: TEST_USER_ID }),
        },
      };
      
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
        return await callback(mockTx);
      });

      await updateUserSubscription(TEST_USER_ID, "plan-123", "payment-123");

      const upsertCall = mockTx.subscription.upsert.mock.calls[0]?.[0] as { create?: { currentPeriodEnd?: Date | null; nextPaymentDue?: Date | null } } | undefined;
      expect(upsertCall?.create?.currentPeriodEnd).toBeInstanceOf(Date);
      expect(upsertCall?.create?.nextPaymentDue).toBeInstanceOf(Date);
    });

    it("should handle free plan payments", async () => {
      const mockPlan = {
        id: "plan-123",
        price: "0.00",
        enableLifetimeAccess: false,
      };
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlan);
      
      const mockTx = {
        subscription: {
          upsert: vi.fn().mockResolvedValue({ id: "sub-123" }),
        },
        payment: {
          update: vi.fn().mockResolvedValue({}),
        },
        user: {
          update: vi.fn().mockResolvedValue({ id: TEST_USER_ID }),
        },
      };
      
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
        return await callback(mockTx);
      });

      await updateUserSubscription(TEST_USER_ID, "plan-123", "free_123");

      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    });

    it("should throw error if plan not found", async () => {
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        updateUserSubscription(TEST_USER_ID, "nonexistent", "payment-123"),
      ).rejects.toThrow("Plan nonexistent not found");
    });
  });

  describe("getAllPlans", () => {
    it("should get all active plans ordered by price", async () => {
      const mockPlans = [
        { id: "plan-1", name: "Free", price: "0.00", isActive: true },
        { id: "plan-2", name: "Pro", price: "10.00", isActive: true },
        { id: "plan-3", name: "Premium", price: "20.00", isActive: true },
      ];
      (prisma.plan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlans);

      const result = await getAllPlans();

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { price: "asc" },
      });
      expect(result).toEqual(mockPlans);
    });
  });
});

