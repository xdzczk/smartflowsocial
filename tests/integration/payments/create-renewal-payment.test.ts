/**
 * Integration tests for createRenewalPayment
 *
 * Tests renewal payment creation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
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

describe("createRenewalPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should create a completed renewal payment", async () => {
    const paidAt = new Date("2024-01-15T12:00:00Z");
    const renewalPayment = {
      id: TEST_PAYMENT_ID,
      userId: TEST_USER_ID,
      amount: 25000,
      amountUsd: 10,
      invoice: "renewal-invoice",
      paymentHash: "renewal-hash",
      status: "COMPLETED",
      description: "Monthly renewal",
      paidAt,
    };

    (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      renewalPayment
    );

    const result = await createRenewalPayment({
      paymentId: TEST_PAYMENT_ID,
      userId: TEST_USER_ID,
      amount: 25000,
      amountUsd: 10,
      invoice: "renewal-invoice",
      paymentHash: "renewal-hash",
      description: "Monthly renewal",
    });

    expect(
      mockPrisma.payment.create as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
      data: {
        id: TEST_PAYMENT_ID,
        userId: TEST_USER_ID,
        amount: 25000,
        amountUsd: 10,
        invoice: "renewal-invoice",
        paymentHash: "renewal-hash",
        status: "COMPLETED",
        description: "Monthly renewal",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        paidAt: expect.any(Date),
      },
    });
    expect(result.status).toBe("COMPLETED");
  });

  it("should create free plan renewal payment", async () => {
    const renewalPayment = {
      id: "free_renewal_123",
      userId: TEST_USER_ID,
      amount: 0,
      amountUsd: 0,
      invoice: "free_plan_renewal",
      paymentHash: "free_plan_renewal",
      status: "COMPLETED",
      description: "Free plan renewal",
      paidAt: new Date(),
    };

    (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      renewalPayment
    );

    const result = await createRenewalPayment({
      paymentId: "free_renewal_123",
      userId: TEST_USER_ID,
      amount: 0,
      amountUsd: 0,
      invoice: "free_plan_renewal",
      paymentHash: "free_plan_renewal",
      description: "Free plan renewal",
    });

    expect(result.amount).toBe(0);
    expect(result.status).toBe("COMPLETED");
  });
});
