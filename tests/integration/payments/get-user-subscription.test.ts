/**
 * Integration tests for getUserSubscription
 *
 * Tests subscription retrieval for users
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { getUserSubscription } from "~/models/payment.server";
import {
  resetMockPaymentPrismaTransaction,
  createMockSubscription,
  setupPaymentTestEnvironment,
  TEST_USER_ID,
  TEST_PLAN_ID,
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

describe("getUserSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
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
