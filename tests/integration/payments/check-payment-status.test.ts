/**
 * Integration tests for checkPaymentStatus
 *
 * Tests payment status checking for various payment states
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { checkPaymentStatus } from "~/models/payment.server";
import {
  resetMockPaymentPrismaTransaction,
  createMockPayment,
  setupPaymentTestEnvironment,
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

describe("checkPaymentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
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
      status: "EXPIRED",
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
