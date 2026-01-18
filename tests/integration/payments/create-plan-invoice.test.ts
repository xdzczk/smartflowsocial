/**
 * Integration tests for createPlanInvoice
 *
 * Tests invoice creation for free plans, paid plans, and error scenarios
 */

import { LN } from "@getalby/sdk/lnclient";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
  createMockPayment,
  createMockLN,
  setupPaymentTestEnvironment,
  TEST_USER_ID,
  TEST_PLAN_ID,
  paymentScenarios,
} from "../../utils/payment-test-helpers";

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

// Mock external dependencies
const { mockGetBitcoinRate } = vi.hoisted(() => {
  const mockGetBitcoinRate = vi.fn();
  return { mockGetBitcoinRate };
});

vi.mock("~/features/payments/btc.rate", () => ({
  getBitcoinRate: mockGetBitcoinRate,
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

interface MockRequest {
  invoice: string;
  paymentHash: string;
  amount: number;
  onPaid: ReturnType<typeof vi.fn>;
  onTimeout: ReturnType<typeof vi.fn>;
}

describe("createPlanInvoice", () => {
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
    lnMock.mockImplementation(function (_credentials: string) {
      return new MockLN(_credentials);
    });

    // Configure getBitcoinRate mock to return a default value if called
    mockGetBitcoinRate.mockResolvedValue(25000);
  });

  it("should create invoice for free plan", async () => {
    paymentScenarios.freePlanInvoice(mockPrisma);

    const { createPlanInvoice } = await import("~/models/payment.server");

    const result = await createPlanInvoice({
      planId: TEST_PLAN_ID,
      userId: TEST_USER_ID,
      description: "Free plan subscription",
    });

    expect(
      mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
      where: { id: TEST_PLAN_ID },
    });
    const createMock = mockPrisma.payment.create as ReturnType<typeof vi.fn>;
    expect(createMock).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
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
    paymentScenarios.nonExistentPlan(mockPrisma);

    const { createPlanInvoice } = await import("~/models/payment.server");

    await expect(
      createPlanInvoice({
        planId: "invalid-plan",
        userId: TEST_USER_ID,
      })
    ).rejects.toThrow("Plan with ID invalid-plan not found");
  });

  it("should throw error for inactive plan", async () => {
    paymentScenarios.inactivePlan(mockPrisma);

    const { createPlanInvoice } = await import("~/models/payment.server");

    await expect(
      createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      })
    ).rejects.toThrow("is not currently available");
  });

  it("should throw error if OWNER_NWC not configured", async () => {
    paymentScenarios.paidPlanInvoice(mockPrisma, 10);
    delete process.env["OWNER_NWC"];

    const { createPlanInvoice } = await import("~/models/payment.server");

    await expect(
      createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      })
    ).rejects.toThrow("Owner NWC credentials not configured");
  });

  it("should create invoice for paid plan", async () => {
    const mockInvoice = "lnbc100u1p3example";
    const mockPaymentHash = "payment-hash-123";
    const mockAmountSats = 25000; // ~$10 at $40k/BTC

    // Create and configure mock instance
    // The request object needs to have invoice and paymentHash at the top level
    // for extractInvoiceFromRequest and extractPaymentHashFromRequest to work
    const mockRequest: MockRequest = {
      invoice: mockInvoice,
      paymentHash: mockPaymentHash,
      amount: mockAmountSats,
      onPaid: vi.fn().mockReturnValue({
        onTimeout: vi.fn().mockReturnValue({}),
      }),
      onTimeout: vi.fn().mockReturnValue({}),
    };
    const mockLNInstance = createMockLN({
      requestPayment: vi.fn().mockResolvedValue(mockRequest),
    }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

    // Override the constructor to return our configured instance
    const lnMock = LN as unknown as {
      mockImplementation: (
        fn: (credentials: string) => InstanceType<typeof LN>
      ) => void;
    };
    lnMock.mockImplementation(function (
      _credentials: string
    ): InstanceType<typeof LN> {
      return mockLNInstance;
    });

    paymentScenarios.paidPlanInvoice(mockPrisma, 10);
    const createMock = mockPrisma.payment.create as ReturnType<typeof vi.fn>;
    createMock.mockResolvedValue(
      createMockPayment({
        amount: mockAmountSats,
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        status: "PENDING",
      })
    );

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
    const createMockPaymentFn = mockPrisma.payment.create as ReturnType<
      typeof vi.fn
    >;
    expect(createMockPaymentFn).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
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
    const mockLNInstance = createMockLN({
      requestPayment: vi.fn().mockRejectedValue(new Error("Network error")),
    }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

    const lnMock = LN as unknown as {
      mockImplementation: (
        fn: (credentials: string) => InstanceType<typeof LN>
      ) => void;
    };
    lnMock.mockImplementation(function (
      _credentials: string
    ): InstanceType<typeof LN> {
      return mockLNInstance;
    });

    paymentScenarios.paidPlanInvoice(mockPrisma, 10);

    const { createPlanInvoice } = await import("~/models/payment.server");

    await expect(
      createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      })
    ).rejects.toThrow("Payments are temporarily unavailable");
  });

  it("should handle missing invoice or paymentHash in response", async () => {
    const mockRequest: Partial<MockRequest> = {
      // Missing invoice and paymentHash
      amount: 25000,
      onPaid: vi.fn().mockReturnValue({}),
      onTimeout: vi.fn().mockReturnValue({}),
    };
    const mockLNInstance = createMockLN({
      requestPayment: vi.fn().mockResolvedValue(mockRequest),
    }) as unknown as { requestPayment: ReturnType<typeof vi.fn> };

    const lnMock = LN as unknown as {
      mockImplementation: (
        fn: (credentials: string) => InstanceType<typeof LN>
      ) => void;
    };
    lnMock.mockImplementation(function (
      _credentials: string
    ): InstanceType<typeof LN> {
      return mockLNInstance;
    });

    paymentScenarios.paidPlanInvoice(mockPrisma, 10);

    const { createPlanInvoice } = await import("~/models/payment.server");

    await expect(
      createPlanInvoice({
        planId: TEST_PLAN_ID,
        userId: TEST_USER_ID,
      })
    ).rejects.toThrow(
      "Failed to create payment invoice. Please try again later."
    );
  });
});
