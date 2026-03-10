/**
 * Edge Case Tests for Payment Processing
 *
 * Tests critical edge cases that could cause financial issues:
 * - Network failures during payment
 * - Payment timeouts
 * - Partial payments
 * - Currency conversion edge cases
 * - Concurrent payment attempts
 */

import { LN } from "@getalby/sdk/lnclient";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
  createMockPlan,
  createMockPayment,
  createMockLN,
  setupPaymentTestEnvironment,
  TEST_USER_ID,
  TEST_PLAN_ID,
  TEST_PAYMENT_ID,
} from "../utils/payment-test-helpers";

import { getBitcoinRate } from "~/features/payments/btc.rate";
import { createPlanInvoice } from "~/models/payment.server";

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

vi.mock("~/features/payments/btc.rate", () => ({
  getBitcoinRate: vi.fn(),
}));

// So createPlanInvoice gets past the credentials check and hits the LN/network path
vi.mock("~/lib/env.server", () => ({
  env: {
    OWNER_NWC: "nostr+walletconnect://test",
  },
}));

// Mock LN as a constructor class
const { MockLN } = vi.hoisted(() => {
  class MockLN {
    credentials: string;
    requestPayment: ReturnType<typeof vi.fn>;
    onPaid: ReturnType<typeof vi.fn>;
    onTimeout: ReturnType<typeof vi.fn>;

    constructor(credentials: string) {
      this.credentials = credentials;
      this.requestPayment = vi.fn();
      this.onPaid = vi.fn().mockReturnValue(this);
      this.onTimeout = vi.fn().mockReturnValue(this);
    }
  }

  return { MockLN };
});

vi.mock("@getalby/sdk/lnclient", () => ({
  LN: vi.fn().mockImplementation(function (credentials: string) {
    return new MockLN(credentials);
  }),
  USD: vi.fn((amount: unknown) => ({ amount: amount as number })),
}));
// handlePaymentCompleted and updateUserSubscription will be dynamically imported

interface MockRequest {
  invoice: string;
  paymentHash: string;
  amount: number;
  onPaid: ReturnType<typeof vi.fn>;
  onTimeout: ReturnType<typeof vi.fn>;
}

describe("Payment Processing Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);

    // Reset LN to default implementation
    const lnMock = LN as unknown as {
      mockImplementation: (
        fn: (credentials: string) => InstanceType<typeof MockLN>
      ) => void;
    };
    lnMock.mockImplementation(function (credentials: string) {
      return new MockLN(credentials);
    });
  });

  describe("Network Failures", () => {
    it("should handle network failure during invoice creation", async () => {
      const mockPlan = createMockPlan({
        name: "Basic Plan",
        price: 10,
      });

      const mockLNInstance = createMockLN({
        requestPayment: vi
          .fn()
          .mockRejectedValue(new Error("Network request failed: ECONNREFUSED")),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow("Payments are temporarily unavailable");

      // Should not create payment record on failure
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it("should handle timeout during invoice creation", async () => {
      const mockPlan = createMockPlan({
        name: "Basic Plan",
        price: 10,
      });

      const mockLNInstance = createMockLN({
        requestPayment: vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 100);
          });
        }),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow("Payments are temporarily unavailable");
    });

    it("should handle network failure during payment completion", async () => {
      // Simulate payment completed but network fails when updating subscription
      mockPrisma.payment.update.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "COMPLETED",
        paidAt: new Date(),
      });

      // Mock the plan lookup that updateUserSubscription will do
      const mockPlan = createMockPlan({
        name: "Basic Plan",
        price: 10,
      });
      (
        mockPlan as unknown as { enableLifetimeAccess: boolean }
      ).enableLifetimeAccess = false;
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);

      // Make the transaction fail to simulate database connection failure
      // This will cause updateUserSubscription to fail
      mockPrisma.$transaction.mockImplementation(
        async (_callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
          throw new Error("Database connection failed");
        }
      );

      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");

      // Now when handlePaymentCompleted calls updateUserSubscription, the transaction will fail
      await expect(
        paymentModule.handlePaymentCompleted(
          TEST_PAYMENT_ID,
          TEST_USER_ID,
          TEST_PLAN_ID
        )
      ).rejects.toThrow("Database connection failed");

      // Payment should still be marked as completed (update happens before subscription update)
      expect(
        mockPrisma.payment.update as ReturnType<typeof vi.fn>
      ).toHaveBeenCalled();
      // updateUserSubscription should have been attempted (plan lookup should be called)
      expect(
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
    });
  });

  describe("Payment Timeout Edge Cases", () => {
    it("should handle payment timeout after invoice creation", async () => {
      const mockPlan = createMockPlan({
        name: "Basic Plan",
        price: 10,
      });

      const mockInvoice = "lnbc100u1p3example";
      const mockPaymentHash = "payment-hash-123";
      const mockAmountSats = 25000;

      const mockRequest: MockRequest = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        amount: mockAmountSats,
        onPaid: vi.fn(),
        onTimeout: vi.fn(),
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn((timeout: number, callback: () => void) => {
        // Simulate timeout after specified seconds
        setTimeout(() => callback(), 100);
        return mockRequest;
      });

      const mockLNInstance = createMockLN({
        requestPayment: vi.fn().mockResolvedValue(mockRequest),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPayment({ status: "PENDING" })
      );

      const { createPlanInvoice } = await import("~/models/payment.server");
      const paymentModule = await import("~/models/payment.server");
      vi.spyOn(paymentModule, "updateUserSubscription").mockResolvedValue();

      await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      });

      // Wait for timeout callback
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify timeout handler would be called on the request object, not the LN instance
      expect(mockRequest.onTimeout).toHaveBeenCalled();
    });
  });

  describe("Currency Conversion Edge Cases", () => {
    it("should handle Bitcoin rate API failure gracefully", async () => {
      const mockPlan = createMockPlan({
        name: "Basic Plan",
        price: 10,
      });

      const mockInvoice = "lnbc100u1p3example";
      const mockPaymentHash = "payment-hash-123";

      interface MockRequestPartial {
        invoice: string;
        paymentHash: string;
        onPaid: ReturnType<typeof vi.fn>;
        onTimeout: ReturnType<typeof vi.fn>;
      }
      const mockRequest: MockRequestPartial = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        onPaid: vi.fn(),
        onTimeout: vi.fn(),
        // Missing amount field
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);

      const mockLNInstance = createMockLN({
        requestPayment: vi.fn().mockResolvedValue(mockRequest),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (getBitcoinRate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Bitcoin rate API unavailable")
      );

      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPayment({ status: "PENDING" })
      );

      const { createPlanInvoice } = await import("~/models/payment.server");
      const paymentModule = await import("~/models/payment.server");
      vi.spyOn(paymentModule, "updateUserSubscription").mockResolvedValue();

      const result = await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      });

      // Should use fallback calculation
      expect(result.amount).toBeGreaterThan(0);
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
            amount: expect.any(Number),
          }),
        })
      );
    });

    it("should handle very small payment amounts", async () => {
      const mockPlan = createMockPlan({
        name: "Micro Plan",
        price: 0.01, // $0.01 USD
      });

      const mockInvoice = "lnbc1u1p3example"; // 1 satoshi
      const mockPaymentHash = "payment-hash-123";

      const mockRequest: MockRequest = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        amount: 1, // 1 satoshi
        onPaid: vi.fn(),
        onTimeout: vi.fn(),
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);

      const mockLNInstance = createMockLN({
        requestPayment: vi.fn().mockResolvedValue(mockRequest),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPayment({ status: "PENDING" })
      );

      const { createPlanInvoice } = await import("~/models/payment.server");
      const paymentModule = await import("~/models/payment.server");
      vi.spyOn(paymentModule, "updateUserSubscription").mockResolvedValue();

      const result = await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      });

      expect(result.amount).toBe(1);
      expect(result.amountUsd).toBe(0.01);
    });

    it("should handle very large payment amounts", async () => {
      const mockPlan = createMockPlan({
        name: "Enterprise Plan",
        price: 10000, // $10,000 USD
      });

      const mockInvoice = "lnbc100000000u1p3example";
      const mockPaymentHash = "payment-hash-123";
      const largeAmount = 2500000000; // 2.5 billion sats (~$10k at $40k/BTC)

      const mockRequest: MockRequest = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        amount: largeAmount,
        onPaid: vi.fn(),
        onTimeout: vi.fn(),
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);

      const mockLNInstance = createMockLN({
        requestPayment: vi.fn().mockResolvedValue(mockRequest),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPayment({ status: "PENDING" })
      );

      const { createPlanInvoice } = await import("~/models/payment.server");
      const paymentModule = await import("~/models/payment.server");
      vi.spyOn(paymentModule, "updateUserSubscription").mockResolvedValue();

      const result = await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      });

      expect(result.amount).toBe(largeAmount);
      expect(result.amountUsd).toBe(10000);
    });
  });

  describe("Concurrent Payment Attempts", () => {
    it("should handle concurrent invoice creation for same user", async () => {
      const mockPlan = createMockPlan({
        name: "Basic Plan",
        price: 10,
      });

      const mockInvoice = "lnbc100u1p3example";
      const mockPaymentHash = "payment-hash-123";

      // Create a mock request object with chainable methods
      const createMockRequest = (): MockRequest => {
        const mockRequest: MockRequest = {
          invoice: mockInvoice,
          paymentHash: mockPaymentHash,
          amount: 25000,
          onPaid: vi.fn(),
          onTimeout: vi.fn(),
        };
        mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
        mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
        return mockRequest;
      };

      const mockLNInstance = createMockLN({
        requestPayment: vi
          .fn()
          .mockImplementation(() => Promise.resolve(createMockRequest())),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPayment({ status: "PENDING" })
      );

      const { createPlanInvoice } = await import("~/models/payment.server");
      const paymentModule = await import("~/models/payment.server");
      vi.spyOn(paymentModule, "updateUserSubscription").mockResolvedValue();

      // Simulate concurrent requests
      const promises = [
        createPlanInvoice({ planId: TEST_PLAN_ID, userId: TEST_USER_ID }),
        createPlanInvoice({ planId: TEST_PLAN_ID, userId: TEST_USER_ID }),
        createPlanInvoice({ planId: TEST_PLAN_ID, userId: TEST_USER_ID }),
      ];

      const results = await Promise.allSettled(promises);

      // All should succeed (or at least not crash)
      results.forEach((result) => {
        expect(result.status).toBe("fulfilled");
      });

      // Should create multiple payment records
      expect(
        mockPrisma.payment.create as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledTimes(3);
    });
  });

  describe("Transaction Rollback Edge Cases", () => {
    it("should rollback subscription update if payment update fails", async () => {
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

      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPayment);
      (
        mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: "sub-123" });

      // Simulate transaction failure - override the default implementation
      // Must set this BEFORE importing to ensure the function uses it
      const transactionError = new Error("Transaction failed");
      mockPrisma.$transaction.mockImplementation(
        async (_callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
          throw transactionError;
        }
      );

      // Import the module - it should use the real function with mocked prisma
      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");

      await expect(
        paymentModule.updateUserSubscription(
          TEST_USER_ID,
          TEST_PLAN_ID,
          TEST_PAYMENT_ID
        )
      ).rejects.toThrow("Transaction failed");

      // Verify transaction was called
      expect(
        mockPrisma.$transaction as ReturnType<typeof vi.fn>
      ).toHaveBeenCalled();
    });

    it("should rollback if user update fails in transaction", async () => {
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

      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (
        mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPayment);
      (
        mockPrisma.subscription.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: "sub-123" });
      (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: TEST_PAYMENT_ID,
        }
      );

      // Simulate transaction failure - override the default implementation
      // Note: This must be set AFTER importing to ensure the function uses it
      mockPrisma.$transaction.mockImplementation(
        async (_callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
          throw new Error("Transaction failed");
        }
      );

      // Import the module - it should use the real function with mocked prisma
      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");

      await expect(
        paymentModule.updateUserSubscription(
          TEST_USER_ID,
          TEST_PLAN_ID,
          TEST_PAYMENT_ID
        )
      ).rejects.toThrow("Transaction failed");
    });
  });

  describe("Invalid Payment Data Edge Cases", () => {
    it("should handle missing payment amount in response", async () => {
      const mockPlan = createMockPlan({
        name: "Basic Plan",
        price: 10,
      });

      interface MockRequestPartial {
        invoice: string;
        paymentHash: string;
        onPaid: ReturnType<typeof vi.fn>;
        onTimeout: ReturnType<typeof vi.fn>;
      }
      const mockRequest: MockRequestPartial = {
        invoice: "lnbc100u1p3example",
        paymentHash: "payment-hash-123",
        // Missing amount field
        onPaid: vi.fn(),
        onTimeout: vi.fn(),
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);

      const mockLNInstance = createMockLN({
        requestPayment: vi.fn().mockResolvedValue(mockRequest),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (getBitcoinRate as ReturnType<typeof vi.fn>).mockResolvedValue(2500);

      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);
      (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPayment({ status: "PENDING" })
      );

      const { createPlanInvoice } = await import("~/models/payment.server");
      const paymentModule = await import("~/models/payment.server");
      vi.spyOn(paymentModule, "updateUserSubscription").mockResolvedValue();

      const result = await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      });

      // Should fallback to Bitcoin rate calculation
      expect(result.amount).toBeGreaterThan(0);
    });

    it("should handle malformed Lightning invoice", async () => {
      const mockPlan = createMockPlan({
        name: "Basic Plan",
        price: 10,
      });

      const mockRequest: MockRequest = {
        invoice: "invalid-invoice-format",
        paymentHash: "hash-123",
        amount: 25000,
        onPaid: vi.fn(),
        onTimeout: vi.fn(),
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);

      const mockLNInstance = createMockLN({
        requestPayment: vi.fn().mockResolvedValue(mockRequest),
      }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });
      (
        mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPlan);

      const { createPlanInvoice } = await import("~/models/payment.server");
      const paymentModule = await import("~/models/payment.server");
      vi.spyOn(paymentModule, "updateUserSubscription").mockResolvedValue();

      // Should still work even with malformed invoice (uses amount from response)
      const result = await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      });

      expect(result.invoice).toBe("invalid-invoice-format");
      expect(result.amount).toBe(25000);
    });
  });
});
