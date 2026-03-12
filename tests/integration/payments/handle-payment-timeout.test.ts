/**
 * Integration tests for handlePaymentTimeout
 *
 * Tests payment timeout handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
  setupPaymentTestEnvironment,
  TEST_PAYMENT_ID,
} from "../../utils/payment-test-helpers";

import { handlePaymentTimeout } from "~/features/payments/data";

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

describe("handlePaymentTimeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should mark payment as expired", async () => {
    const failedAt = new Date("2024-01-15T12:30:00Z");

    const mockPayment = {
      id: TEST_PAYMENT_ID,
      status: "EXPIRED",
      failedAt,
      failureReason: "Payment timeout",
    };
    mockPrisma.payment.update.mockResolvedValue(mockPayment);

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

  it("should handle errors gracefully (not throw)", async () => {
    const error = new Error("Database error");
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      error
    );

    // Should not throw - timeout handler should be resilient
    await expect(handlePaymentTimeout(TEST_PAYMENT_ID)).resolves.not.toThrow();
  });
});
