/**
 * Integration tests for getUserSubscription
 *
 * Tests subscription retrieval for users
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resetMockPaymentPrismaTransaction,
  createMockSubscription,
  setupPaymentTestEnvironment,
  TEST_USER_ID,
  TEST_PLAN_ID,
} from "../../utils/payment-test-helpers";

import { getUserSubscription } from "~/models/payment.server";

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

describe("getUserSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
    // Ensure mockPrisma is initialized before resetting transaction
    resetMockPaymentPrismaTransaction(mockPrisma);
  });

  it("should get user subscription with plan", async () => {
    const mockSubscription = createMockSubscription({
      planId: TEST_PLAN_ID,
    });
    (
      mockSubscription as unknown as {
        Plan: { id: string; name: string; price: number };
      }
    ).Plan = {
      id: TEST_PLAN_ID,
      name: "Basic Plan",
      price: 1000,
    };

    (
      mockPrisma.subscription.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockSubscription);

    const result = await getUserSubscription(TEST_USER_ID);

    expect(
      mockPrisma.subscription.findUnique as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith({
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
