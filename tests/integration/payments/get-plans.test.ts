/**
 * Integration tests for getAllPlans and getPlanById
 *
 * Tests plan retrieval functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { getAllPlans, getPlanById } from "~/models/payment.server";
import {
  resetMockPaymentPrismaTransaction,
  createMockPlan,
  setupPaymentTestEnvironment,
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

describe("getAllPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPaymentTestEnvironment();
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
