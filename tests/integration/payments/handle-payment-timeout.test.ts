/**
 * Integration tests for handlePaymentTimeout
 *
 * Tests payment timeout handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { handlePaymentTimeout } from "~/models/payment.server";
import {
  resetMockPaymentPrismaTransaction,
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

describe("handlePaymentTimeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
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
