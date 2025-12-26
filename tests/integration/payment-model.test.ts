/**
 * Integration tests for Payment model functions
 * 
 * Tests the database operations in app/models/payment.server.ts
 * Uses mocked Prisma and external services to test business logic.
 * 
 * CRITICAL: These functions handle real money (Lightning payments).
 * Comprehensive test coverage is essential.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Import only what we need - updateUserSubscription will be dynamically imported
// to ensure it uses mocked prisma. Other functions are imported statically for convenience.
import {
  checkPaymentStatus,
  getUserSubscription,
  getAllPlans,
  getPlanById,
  handlePaymentCompleted,
  handlePaymentTimeout,
  createRenewalPayment,
} from "~/models/payment.server";
// createPlanInvoice and updateUserSubscription will be dynamically imported
// to ensure they use mocked prisma

// Mock Prisma - use vi.hoisted to allow top-level variables in mocks
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    plan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findUnique: vi.fn(),
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

// Mock external dependencies
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
  USD: vi.fn((amount) => ({ amount })),
}));

import { getBitcoinRate } from "~/features/payments/btc.rate";
import { LN } from "@getalby/sdk/lnclient";

describe("Payment Model Functions", () => {
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

  describe("createPlanInvoice", () => {
    it("should create invoice for free plan", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Free Plan",
        price: 0,
        isActive: true,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        userId: TEST_USER_ID,
        amount: 0,
        status: "COMPLETED",
      });

      const { createPlanInvoice } = await import("~/models/payment.server");

      const result = await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
        description: "Free plan subscription",
      });

      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          amount: 0,
          invoice: "free_plan",
          status: "COMPLETED",
        }),
      });
      expect(result.invoice).toBe("free_plan");
      expect(result.amount).toBe(0);
    });

    it("should throw error for non-existent plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const { createPlanInvoice } = await import("~/models/payment.server");

      await expect(
        createPlanInvoice({
          planId: "invalid-plan",
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("Plan with ID invalid-plan not found");
    });

    it("should throw error for inactive plan", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Inactive Plan",
        price: 1000,
        isActive: false,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const { createPlanInvoice } = await import("~/models/payment.server");

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("is not currently available");
    });

    it("should throw error if OWNER_NWC not configured", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10, // $10 USD
        isActive: true,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      delete process.env.OWNER_NWC;

      const { createPlanInvoice } = await import("~/models/payment.server");

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("Owner NWC credentials not configured");
    });

    it("should create invoice for paid plan", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10, // $10 USD
        isActive: true,
      };

      const mockInvoice = "lnbc100u1p3example";
      const mockPaymentHash = "payment-hash-123";
      const mockAmountSats = 25000; // ~$10 at $40k/BTC

      // Create and configure mock instance
      const mockLNInstance = new MockLN("test-nwc-credentials");
      // requestPayment must return an object with onPaid and onTimeout methods
      // Create object first, then add methods that reference it
      const mockRequest: any = {
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        amount: mockAmountSats,
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue(mockRequest);
      
      // Override the constructor to return our configured instance
      // Use a constructor function that returns the instance
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      process.env.OWNER_NWC = "test-nwc-credentials";

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.create.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        userId: TEST_USER_ID,
        amount: mockAmountSats,
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        status: "PENDING",
      });

      const { createPlanInvoice } = await import("~/models/payment.server");
      
      // Mock updateUserSubscription for free plan path
      const paymentModule = await import("~/models/payment.server");
      vi.spyOn(paymentModule, "updateUserSubscription").mockResolvedValue();

      const result = await createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
        description: "Basic plan subscription",
      });

      expect(mockLNInstance.requestPayment).toHaveBeenCalled();
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          amount: mockAmountSats,
          amountUsd: 10,
          invoice: mockInvoice,
          paymentHash: mockPaymentHash,
          status: "PENDING",
          description: "Basic plan subscription",
        }),
      });
      expect(result.invoice).toBe(mockInvoice);
      expect(result.invoice).toMatch(/^lnbc/); // Lightning invoice format
      expect(result.amount).toBe(mockAmountSats);
      expect(result.amount).toBeGreaterThan(0);
      expect(result.amountUsd).toBe(10);
      expect(result.paymentId).toBeDefined();
      expect(typeof result.paymentId).toBe("string");
      expect(result.paymentId.length).toBeGreaterThan(0);
    });

    it("should handle Lightning invoice creation errors", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockLNInstance = new MockLN("test-nwc-credentials");
      mockLNInstance.requestPayment = vi.fn().mockRejectedValue(new Error("Network error"));
      
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      process.env.OWNER_NWC = "test-nwc-credentials";

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const { createPlanInvoice } = await import("~/models/payment.server");

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("Failed to create payment invoice");
    });

    it("should handle missing invoice or paymentHash in response", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        isActive: true,
      };

      const mockLNInstance = new MockLN("test-nwc-credentials");
      // Create object first, then add methods that reference it
      const mockRequest: any = {
        // Missing invoice and paymentHash
        amount: 25000,
      };
      mockRequest.onPaid = vi.fn().mockReturnValue(mockRequest);
      mockRequest.onTimeout = vi.fn().mockReturnValue(mockRequest);
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue(mockRequest);
      
      (LN as any).mockImplementation(function(credentials: string) {
        return mockLNInstance;
      });
      process.env.OWNER_NWC = "test-nwc-credentials";

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const { createPlanInvoice } = await import("~/models/payment.server");

      await expect(
        createPlanInvoice({
          planId: TEST_PLAN_ID,
          userId: TEST_USER_ID,
        }),
      ).rejects.toThrow("Failed to create payment invoice");
    });
  });

  describe("checkPaymentStatus", () => {
    it("should return payment status for completed payment", async () => {
      const mockPayment = {
        id: TEST_PAYMENT_ID,
        status: "COMPLETED",
        paidAt: new Date("2024-01-15"),
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await checkPaymentStatus(TEST_PAYMENT_ID);

      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        select: {
          paidAt: true,
          status: true,
        },
      });
      expect(result).toEqual({
        paid: true,
        paidAt: mockPayment.paidAt,
        status: "COMPLETED",
      });
    });

    it("should return payment status for pending payment", async () => {
      const mockPayment = {
        id: TEST_PAYMENT_ID,
        status: "PENDING",
        paidAt: null,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

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
  });

  describe("getUserSubscription", () => {
    it("should get user subscription with plan", async () => {
      const mockSubscription = {
        id: "sub-123",
        userId: TEST_USER_ID,
        planId: TEST_PLAN_ID,
        Plan: {
          id: TEST_PLAN_ID,
          name: "Basic Plan",
          price: 1000,
        },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await getUserSubscription(TEST_USER_ID);

      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        include: { Plan: true },
      });
      expect(result).toEqual(mockSubscription);
    });

    it("should return null when user has no subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await getUserSubscription(TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("getAllPlans", () => {
    it("should get all active plans", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          name: "Free Plan",
          price: 0,
          isActive: true,
        },
        {
          id: "plan-2",
          name: "Basic Plan",
          price: 1000,
          isActive: true,
        },
      ];

      mockPrisma.plan.findMany.mockResolvedValue(mockPlans);

      const result = await getAllPlans();

      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { price: "asc" },
      });
      expect(result).toEqual(mockPlans);
    });
  });

  describe("getPlanById", () => {
    it("should get a plan by id", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 1000,
        isActive: true,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await getPlanById(TEST_PLAN_ID);

      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
      expect(result).toEqual(mockPlan);
    });

    it("should return null for non-existent plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const result = await getPlanById("invalid-plan");

      expect(result).toBeNull();
    });
  });

  describe("updateUserSubscription", () => {
    it("should create new subscription for user", async () => {
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
      mockPrisma.user.update.mockResolvedValue({ id: TEST_USER_ID, isEnabled: true });

      // Dynamically import to ensure it uses mocked prisma
      // Use vi.resetModules() to clear cache and ensure fresh import with mocked prisma
      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      expect(paymentModule.updateUserSubscription).toBeDefined();
      expect(typeof paymentModule.updateUserSubscription).toBe("function");
      
      await paymentModule.updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID);

      // Verify the function was called with correct arguments
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        select: { amount: true },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should update existing subscription", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Premium Plan",
        price: 20,
        enableLifetimeAccess: false,
      };

      const mockPayment = {
        id: TEST_PAYMENT_ID,
        amount: 50000,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.subscription.upsert.mockResolvedValue({ id: "sub-123" });
      mockPrisma.payment.update.mockResolvedValue({ id: TEST_PAYMENT_ID });
      mockPrisma.user.update.mockResolvedValue({ id: TEST_USER_ID, isEnabled: true });

      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      await paymentModule.updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID);

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_USER_ID },
          create: expect.objectContaining({
            planId: TEST_PLAN_ID,
            status: "ACTIVE",
            amountSats: BigInt(50000),
          }),
          update: expect.objectContaining({
            planId: TEST_PLAN_ID,
            status: "ACTIVE",
            cancelAtPeriodEnd: false,
          }),
        }),
      );
    });

    it("should handle lifetime plans (no expiration)", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Lifetime Plan",
        price: 100,
        enableLifetimeAccess: true,
      };

      const mockPayment = {
        id: TEST_PAYMENT_ID,
        amount: 250000,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.subscription.upsert.mockResolvedValue({ id: "sub-123" });
      mockPrisma.payment.update.mockResolvedValue({ id: TEST_PAYMENT_ID });
      mockPrisma.user.update.mockResolvedValue({ id: TEST_USER_ID, isEnabled: true });

      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      await paymentModule.updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID);

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            currentPeriodEnd: null,
            nextPaymentDue: null,
          }),
        }),
      );
    });

    it("should handle free plan payments", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Free Plan",
        price: 0,
        enableLifetimeAccess: false,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.subscription.upsert.mockResolvedValue({ id: "sub-123" });
      mockPrisma.user.update.mockResolvedValue({ id: TEST_USER_ID, isEnabled: true });

      // Free plan payment ID starts with "free_"
      const paymentModule = await import("~/models/payment.server");
      await paymentModule.updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, "free_123");

      expect(mockPrisma.payment.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
    });

    it("should throw error if plan not found", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      await expect(
        paymentModule.updateUserSubscription(TEST_USER_ID, "invalid-plan", TEST_PAYMENT_ID),
      ).rejects.toThrow("Plan invalid-plan not found");
    });

    it("should enable user account", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        enableLifetimeAccess: false,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.findUnique.mockResolvedValue({ id: TEST_PAYMENT_ID, amount: 25000 });
      mockPrisma.subscription.upsert.mockResolvedValue({ id: "sub-123" });
      mockPrisma.payment.update.mockResolvedValue({ id: TEST_PAYMENT_ID });
      mockPrisma.user.update.mockResolvedValue({ id: TEST_USER_ID, isEnabled: true });

      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      await paymentModule.updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { isEnabled: true },
      });
    });

    it("should handle transaction rollback on error", async () => {
      const mockPlan = {
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        enableLifetimeAccess: false,
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.payment.findUnique.mockResolvedValue({ id: TEST_PAYMENT_ID, amount: 25000 });
      
      // Simulate transaction failure - override the default implementation
      const transactionError = new Error("Database error");
      mockPrisma.$transaction.mockImplementation(async () => {
        throw transactionError;
      });

      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");
      await expect(
        paymentModule.updateUserSubscription(TEST_USER_ID, TEST_PLAN_ID, TEST_PAYMENT_ID),
      ).rejects.toThrow("Database error");
    });
  });

  describe("handlePaymentCompleted", () => {
    it("should update payment status and subscription", async () => {
      const paidAt = new Date("2024-01-15T12:00:00Z");

      mockPrisma.payment.update.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "COMPLETED",
        paidAt,
      });

      // Mock the plan lookup that updateUserSubscription will do
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: TEST_PLAN_ID,
        name: "Basic Plan",
        price: 10,
        enableLifetimeAccess: false,
      });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: TEST_PAYMENT_ID, amount: 25000 });
      mockPrisma.subscription.upsert.mockResolvedValue({ id: "sub-123" });
      mockPrisma.user.update.mockResolvedValue({ id: TEST_USER_ID, isEnabled: true });

      // Import the module - we'll verify updateUserSubscription was called by checking
      // the database calls it makes, rather than spying on it directly
      // (since handlePaymentCompleted calls it directly, spying doesn't work)
      vi.resetModules();
      const paymentModule = await import("~/models/payment.server");

      await paymentModule.handlePaymentCompleted(TEST_PAYMENT_ID, TEST_USER_ID, TEST_PLAN_ID);

      // Verify payment was updated
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: {
          status: "COMPLETED",
          paidAt: expect.any(Date),
        },
      });
      
      // Verify updateUserSubscription was called by checking the database calls it makes
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PLAN_ID },
      });
      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        select: { amount: true },
      });
      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { isEnabled: true },
      });
    });

    it("should handle errors during payment completion", async () => {
      const error = new Error("Database error");
      mockPrisma.payment.update.mockRejectedValue(error);

      await expect(
        handlePaymentCompleted(TEST_PAYMENT_ID, TEST_USER_ID, TEST_PLAN_ID),
      ).rejects.toThrow("Database error");
    });
  });

  describe("handlePaymentTimeout", () => {
    it("should mark payment as expired", async () => {
      const failedAt = new Date("2024-01-15T12:30:00Z");

      mockPrisma.payment.update.mockResolvedValue({
        id: TEST_PAYMENT_ID,
        status: "EXPIRED",
        failedAt,
        failureReason: "Payment timeout",
      });

      await handlePaymentTimeout(TEST_PAYMENT_ID);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: {
          status: "EXPIRED",
          failedAt: expect.any(Date),
          failureReason: "Payment timeout",
        },
      });
    });

    it("should handle errors gracefully (not throw)", async () => {
      const error = new Error("Database error");
      mockPrisma.payment.update.mockRejectedValue(error);

      // Should not throw - timeout handler should be resilient
      await expect(handlePaymentTimeout(TEST_PAYMENT_ID)).resolves.not.toThrow();
    });
  });

  describe("createRenewalPayment", () => {
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

      mockPrisma.payment.create.mockResolvedValue(renewalPayment);

      const result = await createRenewalPayment({
        paymentId: TEST_PAYMENT_ID,
        userId: TEST_USER_ID,
        amount: 25000,
        amountUsd: 10,
        invoice: "renewal-invoice",
        paymentHash: "renewal-hash",
        description: "Monthly renewal",
      });

      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: {
          id: TEST_PAYMENT_ID,
          userId: TEST_USER_ID,
          amount: 25000,
          amountUsd: 10,
          invoice: "renewal-invoice",
          paymentHash: "renewal-hash",
          status: "COMPLETED",
          description: "Monthly renewal",
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

      mockPrisma.payment.create.mockResolvedValue(renewalPayment);

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

  describe("checkPaymentStatus - Edge Cases", () => {
    it("should return correct status for EXPIRED payment", async () => {
      const mockPayment = {
        id: TEST_PAYMENT_ID,
        status: "EXPIRED",
        paidAt: null,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await checkPaymentStatus(TEST_PAYMENT_ID);

      expect(result).toEqual({
        paid: false,
        paidAt: undefined,
        status: "EXPIRED",
      });
    });

    it("should return correct status for FAILED payment", async () => {
      const mockPayment = {
        id: TEST_PAYMENT_ID,
        status: "FAILED",
        paidAt: null,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await checkPaymentStatus(TEST_PAYMENT_ID);

      expect(result).toEqual({
        paid: false,
        paidAt: undefined,
        status: "FAILED",
      });
    });
  });
});

