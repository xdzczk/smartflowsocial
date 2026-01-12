/**
 * Integration tests for handlePaymentCompleted
 *
 * Tests payment completion handling and subscription updates
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

import { handlePaymentCompleted } from "~/models/payment.server";

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

describe("handlePaymentCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should update payment status and subscription", async () => {
    const paidAt = new Date("2024-01-15T12:00:00Z");

    // Create a mock payment object that can be modified
    const mockUpdatedPayment = createMockPayment({
      status: "COMPLETED",
    });
    (mockUpdatedPayment as unknown as { paidAt: Date }).paidAt = paidAt;

    mockPrisma.payment.update.mockResolvedValue(mockUpdatedPayment);

    // Mock the plan lookup that updateUserSubscription will do
    const mockPlan = createMockPlan({
      name: "Basic Plan",
      price: 10,
    });
    (
      mockPlan as unknown as { enableLifetimeAccess: boolean }
    ).enableLifetimeAccess = false;
    mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
    mockPrisma.payment.findUnique.mockResolvedValue(
      createMockPayment({ amount: 25000 })
    );
    (
      mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "sub-123" });
    (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      isEnabled: true,
    });

    vi.resetModules();
    const paymentModule = await import("~/models/payment.server");

    await paymentModule.handlePaymentCompleted(
      TEST_PAYMENT_ID,
      TEST_USER_ID,
      TEST_PLAN_ID
    );

    // Verify payment was updated
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

    // Verify updateUserSubscription was called by checking the database calls it makes
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
    expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
    expect(
      mockPrisma.user.update as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
      data: { isEnabled: true },
    });
  });

  it("should handle errors during payment completion", async () => {
    const error = new Error("Database error");
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      error
    );

    await expect(
      handlePaymentCompleted(TEST_PAYMENT_ID, TEST_USER_ID, TEST_PLAN_ID)
    ).rejects.toThrow("Database error");
  });
});
