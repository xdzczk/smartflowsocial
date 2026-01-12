/**
 * Integration tests for getAllPlans and getPlanById
 *
 * Tests plan retrieval functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
  createMockPlan,
  setupPaymentTestEnvironment,
  TEST_PLAN_ID,
} from "../../utils/payment-test-helpers";

import { getAllPlans, getPlanById } from "~/models/payment.server";

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

describe("getAllPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should get all active plans", async () => {
    const mockPlans = [
      createMockPlan({ id: "plan-1", name: "Free Plan", price: 0 }),
      createMockPlan({ id: "plan-2", name: "Basic Plan", price: 1000 }),
    ];

    (mockPrisma.plan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPlans
    );

    const result = await getAllPlans();

    expect(
      mockPrisma.plan.findMany as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });
    expect(result).toEqual(mockPlans);
  });
});

describe("getPlanById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should get a plan by id", async () => {
    const mockPlan = createMockPlan({
      name: "Basic Plan",
      price: 1000,
    });

    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPlan
    );

    const result = await getPlanById(TEST_PLAN_ID);

    expect(
      mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
      where: { id: TEST_PLAN_ID },
    });
    expect(result).toEqual(mockPlan);
  });

  it("should return null for non-existent plan", async () => {
    (mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await getPlanById("invalid-plan");

    expect(result).toBeNull();
  });
});
