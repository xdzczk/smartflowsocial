/**
 * Integration tests for payment model commands
 * Tests app/models/payment.server.ts command functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    payment: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "~/lib/prisma.server";
import { createRenewalPayment } from "~/models/payment.server";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Payment Model Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRenewalPayment", () => {
    it("should create a renewal payment", async () => {
      const mockPayment = {
        id: "payment-123",
        userId: TEST_USER_ID,
        amount: 1000,
        amountUsd: 10,
        status: "COMPLETED",
      };
      (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPayment,
      );

      const result = await createRenewalPayment({
        paymentId: "payment-123",
        userId: TEST_USER_ID,
        amount: 1000,
        amountUsd: 10,
        invoice: "lnbc123",
        paymentHash: "hash123",
        description: "Renewal payment",
      });

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          id: "payment-123",
          userId: TEST_USER_ID,
          amount: 1000,
          amountUsd: 10,
          invoice: "lnbc123",
          paymentHash: "hash123",
          status: "COMPLETED",
          description: "Renewal payment",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          paidAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockPayment);
    });
  });
});
