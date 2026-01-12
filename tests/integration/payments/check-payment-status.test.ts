/**
 * Integration tests for checkPaymentStatus
 *
 * Tests payment status checking for various payment states
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
  createMockPayment,
  setupPaymentTestEnvironment,
  TEST_PAYMENT_ID,
} from "../../utils/payment-test-helpers";

import { checkPaymentStatus } from "~/models/payment.server";

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

describe("checkPaymentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should return payment status for completed payment", async () => {
    const mockPayment = createMockPayment({
      status: "COMPLETED",
    });
    (mockPayment as unknown as { paidAt: Date }).paidAt = new Date(
      "2024-01-15"
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
        paidAt: true,
        status: true,
      },
    });
    expect(result).toEqual({
      paid: true,
      paidAt: (mockPayment as unknown as { paidAt: Date | null }).paidAt,
      status: "COMPLETED",
    });
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

  it("should return correct status for TIMEOUT payment", async () => {
    const mockPayment = createMockPayment({
      status: "TIMEOUT",
    });
    (mockPayment as unknown as { paidAt: Date | null }).paidAt = null;

    (
      mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockPayment);

    const result = await checkPaymentStatus(TEST_PAYMENT_ID);

    expect(result).toEqual({
      paid: false,
      paidAt: undefined,
      status: "TIMEOUT",
    });
  });

  it("should return correct status for FAILED payment", async () => {
    const mockPayment = createMockPayment({
      status: "FAILED",
    });
    (mockPayment as unknown as { paidAt: Date | null }).paidAt = null;

    (
      mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockPayment);

    const result = await checkPaymentStatus(TEST_PAYMENT_ID);

    expect(result).toEqual({
      paid: false,
      paidAt: undefined,
      status: "FAILED",
    });
  });
});
