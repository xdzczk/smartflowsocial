/**
 * Integration tests for updateUserSubscription
 *
 * Tests subscription creation, updates, and error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
  createMockPlan,
  createMockPayment,
  setupPaymentTestEnvironment,
  TEST_USER_ID,
  TEST_PLAN_ID,
  TEST_PAYMENT_ID,
} from "../../utils/payment-test-helpers";

// Mock Prisma - use vi.hoisted to allow top-level variables in mocks
// Create mock inline to avoid circular dependency
const { mockPrisma } = vi.hoisted(() => {
  // Inline mock creation to avoid import issues
  const mockPrisma = {
    plan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => {
      const tx = {
        plan: mockPrisma.plan,
        payment: mockPrisma.payment,
        subscription: mockPrisma.subscription,
        user: mockPrisma.user,
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Test mock callback has complex types
      return await callback(tx);
    }),
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

describe("updateUserSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should create new subscription for user", async () => {
    const mockPlan = createMockPlan({
      name: "Basic Plan",
      price: 10,
    });
    (
      mockPlan as unknown as { enableLifetimeAccess: boolean }
    ).enableLifetimeAccess = false;

    const mockPayment = createMockPayment({
      amount: 25000,
    });

    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPlan
    );
    (
      mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockPayment);
    (
      mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "sub-123" });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_PAYMENT_ID,
    });
    (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      isEnabled: true,
    });

    vi.resetModules();
    const paymentModule = await import("~/features/payments/data");
    expect(paymentModule.updateUserSubscription).toBeDefined();
    expect(typeof paymentModule.updateUserSubscription).toBe("function");

    await paymentModule.updateUserSubscription(
      TEST_USER_ID,
      TEST_PLAN_ID,
      TEST_PAYMENT_ID
    );

    expect(
      mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
      where: { id: TEST_PLAN_ID },
    });
    expect(
      mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
      where: { id: TEST_PAYMENT_ID },
      select: { amount: true },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("should update existing subscription", async () => {
    const mockPlan = createMockPlan({
      name: "Premium Plan",
      price: 20,
    });
    (
      mockPlan as unknown as { enableLifetimeAccess: boolean }
    ).enableLifetimeAccess = false;

    const mockPayment = createMockPayment({
      amount: 50000,
    });

    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPlan
    );
    (
      mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockPayment);
    (
      mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "sub-123" });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_PAYMENT_ID,
    });
    (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      isEnabled: true,
    });

    vi.resetModules();
    const paymentModule = await import("~/features/payments/data");
    await paymentModule.updateUserSubscription(
      TEST_USER_ID,
      TEST_PLAN_ID,
      TEST_PAYMENT_ID
    );

    expect(
      mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(
      // expect.objectContaining returns 'any' - acceptable for test mocks
      expect.objectContaining({
        where: { userId: TEST_USER_ID },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        create: expect.objectContaining({
          planId: TEST_PLAN_ID,
          status: "ACTIVE",
          amountSats: BigInt(50000),
        }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        update: expect.objectContaining({
          planId: TEST_PLAN_ID,
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
        }),
      })
    );
  });

  it("should handle lifetime plans (no expiration)", async () => {
    const mockPlan = createMockPlan({
      name: "Lifetime Plan",
      price: 100,
    });
    (
      mockPlan as unknown as { enableLifetimeAccess: boolean }
    ).enableLifetimeAccess = true;

    const mockPayment = createMockPayment({
      amount: 250000,
    });

    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPlan
    );
    (
      mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockPayment);
    (
      mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "sub-123" });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_PAYMENT_ID,
    });
    (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      isEnabled: true,
    });

    vi.resetModules();
    const paymentModule = await import("~/features/payments/data");
    await paymentModule.updateUserSubscription(
      TEST_USER_ID,
      TEST_PLAN_ID,
      TEST_PAYMENT_ID
    );

    expect(
      mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(
      // expect.objectContaining returns 'any' - acceptable for test mocks
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        create: expect.objectContaining({
          currentPeriodEnd: null,
          nextPaymentDue: null,
        }),
      })
    );
  });

  it("should handle free plan payments", async () => {
    const mockPlan = createMockPlan({
      name: "Free Plan",
      price: 0,
    });
    (
      mockPlan as unknown as { enableLifetimeAccess: boolean }
    ).enableLifetimeAccess = false;

    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPlan
    );
    (
      mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "sub-123" });
    (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      isEnabled: true,
    });

    // Free plan payment ID starts with "free_"
    const paymentModule = await import("~/features/payments/data");
    await paymentModule.updateUserSubscription(
      TEST_USER_ID,
      TEST_PLAN_ID,
      "free_123"
    );

    expect(
      mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
    ).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
  });

  it("should throw error if plan not found", async () => {
    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    vi.resetModules();
    const paymentModule = await import("~/features/payments/data");
    await expect(
      paymentModule.updateUserSubscription(
        TEST_USER_ID,
        "invalid-plan",
        TEST_PAYMENT_ID
      )
    ).rejects.toThrow("Plan invalid-plan not found");
  });

  it("should enable user account", async () => {
    const mockPlan = createMockPlan({
      name: "Basic Plan",
      price: 10,
    });
    (
      mockPlan as unknown as { enableLifetimeAccess: boolean }
    ).enableLifetimeAccess = false;

    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPlan
    );
    mockPrisma.payment.findUnique.mockResolvedValue(
      createMockPayment({ amount: 25000 })
    );
    (
      mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "sub-123" });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_PAYMENT_ID,
    });
    (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      isEnabled: true,
    });

    vi.resetModules();
    const paymentModule = await import("~/features/payments/data");
    await paymentModule.updateUserSubscription(
      TEST_USER_ID,
      TEST_PLAN_ID,
      TEST_PAYMENT_ID
    );

    expect(
      mockPrisma.user.update as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
      data: { isEnabled: true },
    });
  });

  it("should handle transaction rollback on error", async () => {
    const mockPlan = createMockPlan({
      name: "Basic Plan",
      price: 10,
    });
    (
      mockPlan as unknown as { enableLifetimeAccess: boolean }
    ).enableLifetimeAccess = false;

    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPlan
    );
    mockPrisma.payment.findUnique.mockResolvedValue(
      createMockPayment({ amount: 25000 })
    );

    // Simulate transaction failure
    const transactionError = new Error("Database error");
    mockPrisma.$transaction.mockImplementation(async () => {
      throw transactionError;
    });

    vi.resetModules();
    const paymentModule = await import("~/features/payments/data");
    await expect(
      paymentModule.updateUserSubscription(
        TEST_USER_ID,
        TEST_PLAN_ID,
        TEST_PAYMENT_ID
      )
    ).rejects.toThrow("Database error");
  });
});
