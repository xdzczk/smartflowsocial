/**
 * Integration tests for payment handlers
 * Tests app/models/payment.server.ts handler functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  handlePaymentCompleted,
  handlePaymentTimeout,
  updateUserSubscription,
  getAllPlans,
} from "~/models/payment.server";
import {
  resetMockPaymentPrismaTransaction,
  createMockPlan,
  createMockPayment,
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

vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

describe("Payment Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  describe("handlePaymentCompleted", () => {
    it("should update payment status and subscription", async () => {
      const mockPlan = createMockPlan({
        price: 10,
      });
      (
        mockPlan as unknown as { enableLifetimeAccess: boolean }
      ).enableLifetimeAccess = false;

      (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPayment({ status: "COMPLETED" })
      );
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockPayment({ amount: 1000 }));
      (
        mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: "sub-123" });
      (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_USER_ID,
      });

      await handlePaymentCompleted(TEST_PAYMENT_ID, TEST_USER_ID, TEST_PLAN_ID);

      expect(
        mockPrisma.payment.update as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: {
          status: "COMPLETED",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          paidAt: expect.any(Date),
        },
      });
    });

    it("should handle errors and rethrow", async () => {
      (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error")
      );

      await expect(
        handlePaymentCompleted(TEST_PAYMENT_ID, TEST_USER_ID, TEST_PLAN_ID)
      ).rejects.toThrow("DB error");
    });
  });

  describe("handlePaymentTimeout", () => {
    it("should mark payment as expired", async () => {
      (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPayment({ status: "TIMEOUT" })
      );

      await handlePaymentTimeout(TEST_PAYMENT_ID);

      expect(
        mockPrisma.payment.update as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: {
          status: "EXPIRED",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          failedAt: expect.any(Date),
          failureReason: "Payment timeout",
        },
      });
    });

    it("should handle errors gracefully", async () => {
      (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error")
      );

      // Should not throw
      await handlePaymentTimeout(TEST_PAYMENT_ID);
    });
  });

  describe("updateUserSubscription", () => {
    it("should create subscription for lifetime plan", async () => {
      const mockPlan = createMockPlan({
        price: 100,
      });
      (
        mockPlan as unknown as { enableLifetimeAccess: boolean }
      ).enableLifetimeAccess = true;

      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockPayment({ amount: 10000 }));

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

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Test functions can be async
        (callback: (tx: typeof mockTx) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      await updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID);

      const upsertCall = mockTx.subscription.upsert.mock.calls[0]?.[0] as
        | {
            create?: {
              currentPeriodEnd?: Date | null;
              nextPaymentDue?: Date | null;
            };
          }
        | undefined;
      expect(upsertCall?.create?.currentPeriodEnd).toBeNull();
      expect(upsertCall?.create?.nextPaymentDue).toBeNull();
    });

    it("should create subscription for monthly plan", async () => {
      const mockPlan = createMockPlan({
        price: 10,
      });
      (
        mockPlan as unknown as { enableLifetimeAccess: boolean }
      ).enableLifetimeAccess = false;

      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockPayment({ amount: 1000 }));

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

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Test functions can be async
        (callback: (tx: typeof mockTx) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      await updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID);

      const upsertCall = mockTx.subscription.upsert.mock.calls[0]?.[0] as
        | {
            create?: {
              currentPeriodEnd?: Date | null;
              nextPaymentDue?: Date | null;
            };
          }
        | undefined;
      expect(upsertCall?.create?.currentPeriodEnd).toBeInstanceOf(Date);
      expect(upsertCall?.create?.nextPaymentDue).toBeInstanceOf(Date);
    });

    it("should handle free plan payments", async () => {
      const mockPlan = createMockPlan({
        price: 0,
      });
      (
        mockPlan as unknown as { enableLifetimeAccess: boolean }
      ).enableLifetimeAccess = false;

      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);

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

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Test functions can be async
        (callback: (tx: typeof mockTx) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      await updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, "free_123");

      expect(
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).not.toHaveBeenCalled();
    });

    it("should throw error if plan not found", async () => {
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      await expect(
        updateUserSubscription(TEST_USER_ID, "nonexistent", TEST_PAYMENT_ID)
      ).rejects.toThrow("Plan nonexistent not found");
    });
  });

  describe("getAllPlans", () => {
    it("should get all active plans ordered by price", async () => {
      const mockPlans = [
        createMockPlan({ id: "plan-1", name: "Free", price: 0 }),
        createMockPlan({ id: "plan-2", name: "Pro", price: 10 }),
        createMockPlan({ id: "plan-3", name: "Premium", price: 20 }),
      ];
      (mockPrisma.plan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPlans
      );

      const result = await getAllPlans();

      expect(
        mockPrisma.plan.findMany as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { price: "asc" },
      });
      expect(result).toEqual(mockPlans);
    });
  });
});
