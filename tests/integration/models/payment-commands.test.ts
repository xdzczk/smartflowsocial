/**
 * Integration tests for payment model commands
 * Tests app/models/payment.server.ts command functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
  createMockPayment,
  setupPaymentTestEnvironment,
  TEST_USER_ID,
  TEST_PAYMENT_ID,
} from "../../utils/payment-test-helpers";

import { createRenewalPayment } from "~/models/payment.server";

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

describe("Payment Model Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
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
