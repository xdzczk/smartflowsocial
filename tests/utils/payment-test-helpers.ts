/**
 * Payment test helpers
 *
 * Provides reusable mocks and builders for payment-related tests
 * to reduce duplication in large test files like payment-model.test.ts
 */

import type { LN } from "@getalby/sdk/lnclient";
import { vi } from "vitest";

// Common test IDs
export const TEST_USER_ID = "user-123";
export const TEST_PLAN_ID = "plan-123";
export const TEST_PAYMENT_ID = "payment-123";
export const TEST_SUBSCRIPTION_ID = "subscription-123";

/**
 * Create a mock Prisma client for payment tests
 */
export function createMockPaymentPrisma() {
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
      // Create a transaction client that has the same methods as mockPrisma
      const tx = {
        plan: mockPrisma.plan,
        payment: mockPrisma.payment,
        subscription: mockPrisma.subscription,
        user: mockPrisma.user,
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Test mocks have complex types
      return await callback(tx);
    }),
  };

  return mockPrisma;
}

/**
 * Reset mock Prisma transaction to default implementation
 */
export function resetMockPaymentPrismaTransaction(
  mockPrismaInstance: ReturnType<typeof createMockPaymentPrisma>
) {
  mockPrismaInstance.$transaction.mockImplementation(async (callback) => {
    const tx = {
      plan: mockPrismaInstance.plan,
      payment: mockPrismaInstance.payment,
      subscription: mockPrismaInstance.subscription,
      user: mockPrismaInstance.user,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Test mocks have complex types
    return await callback(tx);
  });
}

/**
 * Mock Plan builder
 */
export interface MockPlanOptions {
  id?: string;
  name?: string;
  price?: number;
  isActive?: boolean;
}

export function createMockPlan(options: MockPlanOptions = {}) {
  return {
    id: options.id ?? TEST_PLAN_ID,
    name: options.name ?? "Test Plan",
    price: options.price ?? 1000,
    isActive: options.isActive ?? true,
    sortOrder: 0,
    planBillingModel: "recurring",
    purchasable: true,
    visibleOnPricingPage: true,
    isComingSoon: false,
    isSpecialOffering: false,
    founderSeatCap: null,
  };
}

/**
 * Mock Payment builder
 */
export interface MockPaymentOptions {
  id?: string;
  userId?: string;
  planId?: string;
  amount?: number;
  status?: "PENDING" | "COMPLETED" | "FAILED" | "TIMEOUT";
  invoice?: string;
  paymentHash?: string;
}

export function createMockPayment(options: MockPaymentOptions = {}) {
  return {
    id: options.id ?? TEST_PAYMENT_ID,
    userId: options.userId ?? TEST_USER_ID,
    planId: options.planId ?? TEST_PLAN_ID,
    amount: options.amount ?? 1000,
    status: options.status ?? "PENDING",
    invoice: options.invoice ?? "invoice-123",
    paymentHash: options.paymentHash ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Mock Subscription builder
 */
export interface MockSubscriptionOptions {
  id?: string;
  userId?: string;
  planId?: string;
  status?: "ACTIVE" | "CANCELLED" | "EXPIRED";
  currentPeriodEnd?: Date;
}

export function createMockSubscription(options: MockSubscriptionOptions = {}) {
  return {
    id: options.id ?? TEST_SUBSCRIPTION_ID,
    userId: options.userId ?? TEST_USER_ID,
    planId: options.planId ?? TEST_PLAN_ID,
    status: options.status ?? "ACTIVE",
    currentPeriodEnd:
      options.currentPeriodEnd ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Mock LN Client builder
 */
export interface MockLNOptions {
  credentials?: string;
  requestPayment?: ReturnType<typeof vi.fn>;
  onPaid?: ReturnType<typeof vi.fn>;
  onTimeout?: ReturnType<typeof vi.fn>;
}

export function createMockLN(
  options: MockLNOptions = {}
): InstanceType<typeof LN> {
  const mockLN: {
    credentials: string;
    requestPayment: ReturnType<typeof vi.fn>;
    onPaid: ReturnType<typeof vi.fn>;
    onTimeout: ReturnType<typeof vi.fn>;
  } = {
    credentials: options.credentials ?? "test-nwc-credentials",
    requestPayment: options.requestPayment ?? vi.fn(),
    onPaid: vi.fn(),
    onTimeout: vi.fn(),
  };

  // Set up chainable methods after object creation
  mockLN.onPaid = (options.onPaid ?? vi.fn()).mockReturnValue(mockLN);
  mockLN.onTimeout = (options.onTimeout ?? vi.fn()).mockReturnValue(mockLN);

  return mockLN;
}

/**
 * Setup common payment test environment
 */
export function setupPaymentTestEnvironment() {
  process.env["OWNER_NWC"] = "test-nwc-credentials";
}

/**
 * Cleanup payment test environment
 */
export function cleanupPaymentTestEnvironment() {
  delete process.env["OWNER_NWC"];
}

/**
 * Common payment test scenarios
 */
export const paymentScenarios = {
  /**
   * Setup for free plan invoice creation
   */
  freePlanInvoice: (
    mockPrismaInstance: ReturnType<typeof createMockPaymentPrisma>
  ) => {
    const mockPlan = createMockPlan({ name: "Free Plan", price: 0 });
    (
      mockPrismaInstance.plan.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockPlan);
    (
      mockPrismaInstance.payment.create as ReturnType<typeof vi.fn>
    ).mockResolvedValue(createMockPayment({ amount: 0, status: "COMPLETED" }));
    return { mockPlan };
  },

  /**
   * Setup for paid plan invoice creation
   */
  paidPlanInvoice: (
    mockPrismaInstance: ReturnType<typeof createMockPaymentPrisma>,
    price = 10
  ) => {
    const mockPlan = createMockPlan({ name: "Basic Plan", price });
    (
      mockPrismaInstance.plan.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockPlan);
    return { mockPlan };
  },

  /**
   * Setup for inactive plan
   */
  inactivePlan: (
    mockPrismaInstance: ReturnType<typeof createMockPaymentPrisma>
  ) => {
    const mockPlan = createMockPlan({ name: "Inactive Plan", isActive: false });
    (
      mockPrismaInstance.plan.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockPlan);
    return { mockPlan };
  },

  /**
   * Setup for non-existent plan
   */
  nonExistentPlan: (
    mockPrismaInstance: ReturnType<typeof createMockPaymentPrisma>
  ) => {
    (
      mockPrismaInstance.plan.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
  },
};
