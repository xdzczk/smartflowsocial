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

describe("updateUserSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
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
    const paymentModule = await import("~/models/payment.server");
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
    const paymentModule = await import("~/models/payment.server");
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
    const paymentModule = await import("~/models/payment.server");
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
    const paymentModule = await import("~/models/payment.server");
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
    const paymentModule = await import("~/models/payment.server");
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
    const paymentModule = await import("~/models/payment.server");
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
    const paymentModule = await import("~/models/payment.server");
    await expect(
      paymentModule.updateUserSubscription(
        TEST_USER_ID,
        TEST_PLAN_ID,
        TEST_PAYMENT_ID
      )
    ).rejects.toThrow("Database error");
  });
});
