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

import { LN, USD } from "@getalby/sdk/lnclient";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma - use vi.hoisted to allow top-level variables in mocks
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    plan: {
      findUnique: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      upsert: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => {
      // Create a transaction client that has the same methods as mockPrisma
      const tx = {
        plan: mockPrisma.plan,
        payment: mockPrisma.payment,
        subscription: mockPrisma.subscription,
        user: mockPrisma.user,
      };
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

// Mock LN as a constructor class - use vi.hoisted to allow per-test configuration
const { MockLN } = vi.hoisted(() => {
  class MockLN {
    credentials: string;
    requestPayment: ReturnType<typeof vi.fn>;
    onPaid: ReturnType<typeof vi.fn>;
    onTimeout: ReturnType<typeof vi.fn>;
    
    constructor(credentials: string) {
      this.credentials = credentials;
      // Initialize methods as vi.fn() so they can be mocked per test
      this.requestPayment = vi.fn();
      this.onPaid = vi.fn().mockReturnValue(this); // Chainable
      this.onTimeout = vi.fn().mockReturnValue(this); // Chainable
    }
  }
  
  return { MockLN };
});

vi.mock("@getalby/sdk/lnclient", () => ({
  LN: vi.fn().mockImplementation(function(credentials: string) {
    return new MockLN(credentials);
  }),
  USD: vi.fn((amount) => ({ amount: amount })),
}));

import { getBitcoinRate } from "~/features/payments/btc.rate";
import { createPlanInvoice } from "~/models/payment.server";
// handlePaymentCompleted and updateUserSubscription will be dynamically imported

describe("Payment Processing Edge Cases", () => {
  const TEST_USER_ID = "user-123";
  const TEST_PLAN_ID = "plan-123";
  const TEST_PAYMENT_ID = "payment-123";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OWNER_NWC = "test-nwc-credentials";
    // Reset $transaction to default implementation
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      // Create a transaction client that has the same methods as mockPrisma
      const tx = {
        plan: mockPrisma.plan,
        payment: mockPrisma.payment,
        subscription: mockPrisma.subscription,
        user: mockPrisma.user,
      };
      return await callback(tx);
    });
    // Reset LN to default implementation - use function, not arrow, so it works as constructor
    (LN as any).mockImplementation(function(credentials: string) {
      return new MockLN(credentials);
    });
  });

  describe("Network Failures", () => {
    it("should handle network failure during invoice creation", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockLNInstance = new MockLN("test-nwc");
      mockLNInstance.requestPayment = vi.fn().mockRejectedValue(
        new Error("Network request failed: ECONNREFUSED"),
      );
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("Failed to create payment invoice");

      // Should not create payment record on failure
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it("should handle timeout during invoice creation", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockLNInstance = new MockLN("test-nwc");
      mockLNInstance.requestPayment = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 100);
        });
      });
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("Failed to create payment invoice");
    });

    it("should handle network failure during payment completion", async () => {
      // Simulate payment completed but network fails when updating subscription
      mockPrisma.payment.update.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "COMPLETED",
        paidAt: new Date(),
      });

      // Mock the plan lookup that updateUserSubscription will do
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        enableLifetimeAccess: false,
      });

      // Make the transaction fail to simulate database connection failure
      // This will cause updateUserSubscription to fail
      mockPrisma.$transaction.mockImplementation(async () => {
        throw new Error("Database connection failed");
      });

      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      
      // Now when handlePaymentCompleted calls updateUserSubscription, the transaction will fail
      await expect(
        paymentModule.handlePaymentCompleted(TEST_PAYMENT_ID, TEST_USER_ID, TEST_PLAN_ID),
      ).rejects.toThrow("Database connection failed");

      // Payment should still be marked as completed (update happens before subscription update)
      expect(mockPrisma.payment.update).toHaveBeenCalled();
      // updateUserSubscription should have been attempted (plan lookup should be called)
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
    });
  });

  describe("Payment Timeout Edge Cases", () => {
    it("should handle payment timeout after invoice creation", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockInvoice = "lnbc100u1p3example";
      const mockPaymentHash = "payment-hash-123";
      const mockAmountSats = 25000;

      const mockLNInstance = new MockLN("test-nwc");
      // Create object first, then add methods that reference it
      const mockRequest: any = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        amount: mockAmountSats,
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn((timeout: number, callback: () => void) => {
        // Simulate timeout after specified seconds
        setTimeout(() => callback(), 100);
        return mockRequest;
      });
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue(mockRequest);
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "PENDING",
      });

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
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockInvoice = "lnbc100u1p3example";
      const mockPaymentHash = "payment-hash-123";

      const mockLNInstance = new MockLN("test-nwc");
      // Create object first, then add methods that reference it
      const mockRequest: any = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        // Missing amount field
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue(mockRequest);
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      (getBitcoinRate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Bitcoin rate API unavailable"),
      );

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "PENDING",
      });

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
        expect.objectContaining({
          data: expect.objectContaining({
            amount: expect.any(Number),
          }),
        }),
      );
    });

    it("should handle very small payment amounts", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Micro Plan",
        price: 0.01, // $0.01 USD
        isActive: true,
      };

      const mockInvoice = "lnbc1u1p3example"; // 1 satoshi
      const mockPaymentHash = "payment-hash-123";

      const mockLNInstance = new MockLN("test-nwc");
      // Create object first, then add methods that reference it
      const mockRequest: any = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        amount: 1, // 1 satoshi
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue(mockRequest);
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "PENDING",
      });

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
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Enterprise Plan",
        price: 10000, // $10,000 USD
        isActive: true,
      };

      const mockInvoice = "lnbc100000000u1p3example";
      const mockPaymentHash = "payment-hash-123";
      const largeAmount = 2500000000; // 2.5 billion sats (~$10k at $40k/BTC)

      const mockLNInstance = new MockLN("test-nwc");
      // Create object first, then add methods that reference it
      const mockRequest: any = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        amount: largeAmount,
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue(mockRequest);
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "PENDING",
      });

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
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockInvoice = "lnbc100u1p3example";
      const mockPaymentHash = "payment-hash-123";

      const mockLNInstance = new MockLN("test-nwc");
      // Create a mock request object with chainable methods
      const createMockRequest = () => {
        const mockRequest: any = {
          invoice: mockInvoice,
          paymentHash: mockPaymentHash,
          amount: 25000,
        };
        mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
        mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
        return mockRequest;
      };
      // Each call should return a new mock request
      mockLNInstance.requestPayment = vi.fn().mockImplementation(() => Promise.resolve(createMockRequest()));
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "PENDING",
      });

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
      expect(mockPrisma.payment.create).toHaveBeenCalledTimes(3);
    });
  });

  describe("Transaction Rollback Edge Cases", () => {
    it("should rollback subscription update if payment update fails", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        enableLifetimeAccess: false,
      };

      const mockPayment = {
        id: TEST_PAYMENT_ID,
        amount: 25000,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.subscription.upsert.mockResolvedValue({ id: "sub-123" });
      
      // Simulate transaction failure - override the default implementation
      // Must set this BEFORE importing to ensure the function uses it
      const transactionError = new Error("Transaction failed");
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        throw transactionError;
      });

      // Import the module - it should use the real function with mocked prisma
      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      
      await expect(
        paymentModule.updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID),
      ).rejects.toThrow("Transaction failed");
      
      // Verify transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should rollback if user update fails in transaction", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        enableLifetimeAccess: false,
      };

      const mockPayment = {
        id: TEST_PAYMENT_ID,
        amount: 25000,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.subscription.upsert.mockResolvedValue({ id: "sub-123" });
      mockPrisma.payment.update.mockResolvedValue({ id: TEST_PAYMENT_ID });
      
      // Simulate transaction failure - override the default implementation
      // Note: This must be set AFTER importing to ensure the function uses it
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        throw new Error("Transaction failed");
      });

      // Import the module - it should use the real function with mocked prisma
      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      
      await expect(
        paymentModule.updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID),
      ).rejects.toThrow("Transaction failed");
    });
  });

  describe("Invalid Payment Data Edge Cases", () => {
    it("should handle missing payment amount in response", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockLNInstance = new MockLN("test-nwc");
      // Create object first, then add methods that reference it
      const mockRequest: any = {
        invoice: "lnbc100u1p3example",
        paymentHash: "payment-hash-123",
        // Missing amount field
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue(mockRequest);
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      (getBitcoinRate as ReturnType<typeof vi.fn>).mockResolvedValue(2500);

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "PENDING",
      });

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
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockLNInstance = new MockLN("test-nwc");
      // Create object first, then add methods that reference it
      const mockRequest: any = {
        invoice: "invalid-invoice-format",
        paymentHash: "hash-123",
        amount: 25000,
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue(mockRequest);
      
      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

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

