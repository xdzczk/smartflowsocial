/**
 * Integration tests for handlePaymentCompleted
 *
 * Tests payment completion handling and subscription updates
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { handlePaymentCompleted } from "~/models/payment.server";
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

describe("handlePaymentCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should update payment status and subscription", async () => {
    const paidAt = new Date("2024-01-15T12:00:00Z");

    mockPrisma.payment.update.mockResolvedValue(
      createMockPayment({
        status: "COMPLETED",
      })
    );
    (
      mockPrisma.payment.update.mock.results[0]?.value as { paidAt: Date }
    ).paidAt = paidAt;

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
