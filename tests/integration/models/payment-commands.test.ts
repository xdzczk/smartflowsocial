/**
 * Integration tests for payment model commands
 * Tests app/models/payment.server.ts command functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { createRenewalPayment } from "~/models/payment.server";
import {
  resetMockPaymentPrismaTransaction,
  createMockPayment,
  setupPaymentTestEnvironment,
  TEST_USER_ID,
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

describe("Payment Model Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  describe("createRenewalPayment", () => {
    it("should create a renewal payment", async () => {
      const mockPayment = createMockPayment({
        amount: 1000,
        status: "COMPLETED",
      });
      (mockPayment as unknown as { amountUsd: number }).amountUsd = 10;

      (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPayment
      );

      const result = await createRenewalPayment({
        paymentId: TEST_PAYMENT_ID,
        userId: TEST_USER_ID,
        amount: 1000,
        amountUsd: 10,
        invoice: "lnbc123",
        paymentHash: "hash123",
        description: "Renewal payment",
      });

      expect(
        mockPrisma.payment.create as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        data: {
          id: TEST_PAYMENT_ID,
          userId: TEST_USER_ID,
          amount: 1000,
          amountUsd: 10,
          invoice: "lnbc123",
          paymentHash: "hash123",
          status: "COMPLETED",
          description: "Renewal payment",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          paidAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockPayment);
    });
  });
});
