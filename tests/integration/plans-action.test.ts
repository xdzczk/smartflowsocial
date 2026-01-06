/**
 * Integration tests for plans action handlers
 *
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see tests/e2e/subscription/billing-loader.cy.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUser: vi.fn(),
}));

vi.mock("~/models/payment.server", () => ({
  createPlanInvoice: vi.fn(),
  checkPaymentStatus: vi.fn(),
}));

import { createFormData, TEST_USER_ID } from "../utils/test-helpers";

import { requireUser } from "~/features/auth/session.server";
import { handlePlansAction } from "~/features/payments/services/plans-action.server";
import { createPlanInvoice, checkPaymentStatus } from "~/models/payment.server";

describe("Plans Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      npub: "test-npub",
    });
  });

  describe("Check Payment Status", () => {
    it("should check payment status without authentication", async () => {
      (checkPaymentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        paid: true,
        paidAt: new Date("2024-01-01"),
        status: "paid",
      });

      const formData = createFormData({
        intent: "check_payment",
        paymentId: "payment-123",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(checkPaymentStatus).toHaveBeenCalledWith("payment-123");
      expect(requireUser).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        paid: true,
        paidAt: new Date("2024-01-01"),
        message: "Payment completed successfully!",
      });
    });

    it("should return unpaid status when payment not completed", async () => {
      (checkPaymentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        paid: false,
        status: "pending",
      });

      const formData = createFormData({
        intent: "check_payment",
        paymentId: "payment-123",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        success: true,
        paid: false,
        status: "pending",
      });
    });

    it("should return error when paymentId is missing", async () => {
      const formData = createFormData({
        intent: "check_payment",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      // Zod validation returns Response with error
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as {
        error?: string;
        success?: boolean;
      };
      expect(data).toHaveProperty("error");
      expect(String(data.error)).toBeTruthy();
      expect(checkPaymentStatus).not.toHaveBeenCalled();
    });

    it("should handle payment status check errors gracefully", async () => {
      (checkPaymentStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Payment not found")
      );

      const formData = createFormData({
        intent: "check_payment",
        paymentId: "invalid-payment",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        success: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        error: expect.any(String),
      });
    });
  });

  describe("Select Plan Action", () => {
    it("should create invoice for selected plan", async () => {
      const mockInvoice = {
        invoice: "lnbc123...",
        paymentHash: "hash123",
        amount: 1000,
        amountUsd: 10.0,
        paymentId: "payment-123",
        expiresAt: new Date("2024-12-31"),
        planName: "Basic Plan",
        planId: "basic",
      };

      (createPlanInvoice as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockInvoice
      );

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(requireUser).toHaveBeenCalledWith(request);
      expect(createPlanInvoice).toHaveBeenCalledWith({
        planId: "basic",
        userId: TEST_USER_ID,
        description: "SmartFlow Social - Plan subscription",
      });
      expect(result).toEqual({
        success: true,
        invoice: "lnbc123...",
        paymentHash: "hash123",
        amount: 1000,
        amountUsd: 10.0,
        paymentId: "payment-123",
        expiresAt: mockInvoice.expiresAt.toISOString(),
        planName: "Basic Plan",
        planId: "basic",
      });
    });

    it("should return redirect for free plan", async () => {
      (createPlanInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({
        invoice: "free_plan",
        paymentHash: null,
        amount: 0,
        amountUsd: 0,
        paymentId: null,
        expiresAt: new Date(),
        planName: "Free Plan",
        planId: "free",
      });

      const formData = createFormData({
        intent: "select_plan",
        planId: "free",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        redirect:
          "/dashboard?planActivated=true&message=" +
          encodeURIComponent("Free plan activated successfully!"),
      });
    });

    it("should return error when planId is missing", async () => {
      const formData = createFormData({
        intent: "select_plan",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      // Zod validation returns Response with error
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as {
        error?: string;
        success?: boolean;
      };
      expect(data).toHaveProperty("error");
      expect(String(data.error)).toBeTruthy();
      expect(createPlanInvoice).not.toHaveBeenCalled();
    });

    it("should handle invoice creation errors", async () => {
      (createPlanInvoice as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Plan not found")
      );

      const formData = createFormData({
        intent: "select_plan",
        planId: "invalid-plan",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        error: "Plan not found",
      });
    });

    it("should handle generic errors in invoice creation", async () => {
      (createPlanInvoice as ReturnType<typeof vi.fn>).mockRejectedValue(
        "Unknown error"
      );

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        error: "Failed to create payment invoice",
      });
    });
  });

  describe("Error Handling", () => {
    it("should return error for invalid intent", async () => {
      const formData = createFormData({
        intent: "invalid_intent",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      // Zod validation fails for invalid intent, returns Response with error
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as {
        error?: string;
        success?: boolean;
      };
      expect(data).toHaveProperty("error");
    });

    it("should handle authentication errors for select_plan", async () => {
      (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required")
      );

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
      });

      const request = new Request("http://localhost:3000/plans");

      await expect(handlePlansAction(formData, request)).rejects.toThrow(
        "Authentication required"
      );
    });
  });
});
