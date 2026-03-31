/**
 * Integration tests for plans action handlers
 *
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see tests/e2e/subscription/billing-loader.cy.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFormData, TEST_USER_ID } from "../utils/test-helpers";

import { requireUser } from "~/features/auth/session.server";
import { isBtcpayConfigured } from "~/features/payments/btcpay.server";
import {
  createPlanInvoice,
  checkPaymentStatus,
  manuallyVerifyPayment,
  getPlanPriceUsd,
  getPlanById,
  countActiveSubscriptionsForPlan,
  getUserSubscription,
} from "~/features/payments/data";
import { PlanBillingModel } from "~/features/payments/data/billing-models.server";
import { handlePlansAction } from "~/features/payments/services/plans-action.server";
import { getDecryptedUserNWC, updateUserNWC } from "~/features/user";

vi.mock("~/features/auth/session.server", () => ({
  requireUser: vi.fn(),
}));

vi.mock("~/features/payments/data", () => ({
  PlanBillingModel,
  createPlanInvoice: vi.fn(),
  checkPaymentStatus: vi.fn(),
  manuallyVerifyPayment: vi.fn(),
  getPlanPriceUsd: vi.fn(),
  getPlanById: vi.fn(),
  countActiveSubscriptionsForPlan: vi.fn(),
  getUserSubscription: vi.fn(),
}));

vi.mock("~/features/payments/btcpay.server", () => ({
  isBtcpayConfigured: vi.fn(() => false),
}));

vi.mock("~/features/user", () => ({
  updateUserNWC: vi.fn(),
  getDecryptedUserNWC: vi.fn(),
}));

vi.mock("@getalby/sdk", () => ({
  NWCClient: class {
    payInvoice = vi.fn().mockResolvedValue({ preimage: "preimage" });
    close = vi.fn();
    constructor(_opts: unknown) {}
  },
}));

describe("Plans Action Handler", () => {
  /* eslint-disable @typescript-eslint/no-misused-promises -- mockImplementation returns Promise for async getPlanById; beforeEach expects void */
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      npub: "test-npub",
    });
    (isBtcpayConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);

    (getPlanById as ReturnType<typeof vi.fn>).mockImplementation(
      (planId: string) => {
        if (planId === "teams") {
          return Promise.resolve({
            id: "teams",
            isActive: true,
            planBillingModel: PlanBillingModel.disabled,
            purchasable: false,
            founderSeatCap: null,
          });
        }
        if (planId === "founder") {
          return Promise.resolve({
            id: "founder",
            isActive: true,
            planBillingModel: PlanBillingModel.lifetime,
            purchasable: true,
            founderSeatCap: 21,
          });
        }
        return Promise.resolve({
          id: planId,
          isActive: true,
          planBillingModel: PlanBillingModel.recurring,
          purchasable: true,
          founderSeatCap: null,
        });
      }
    );
    (
      countActiveSubscriptionsForPlan as ReturnType<typeof vi.fn>
    ).mockResolvedValue(0);
    (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });
  /* eslint-enable @typescript-eslint/no-misused-promises */

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
      (getPlanPriceUsd as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
        billingCadence: "monthly",
        accessDurationMonths: "1",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(requireUser).toHaveBeenCalledWith(request);
      expect(createPlanInvoice).toHaveBeenCalledWith({
        planId: "basic",
        userId: TEST_USER_ID,
        description: "SmartFlow Social - Plan subscription",
        amountUsdOverride: expect.any(Number) as unknown as number,
        billingCadence: "monthly",
        accessDurationMonths: 1,
        billingPaymentMethod: "lightning_one_time",
      });
      expect(result).toEqual({
        success: true,
        paymentMode: "manual",
        invoice: "lnbc123...",
        paymentHash: "hash123",
        amount: 1000,
        amountUsd: 10.0,
        paymentId: "payment-123",
        expiresAt: mockInvoice.expiresAt.toISOString(),
        planName: "Basic Plan",
        planId: "basic",
        checkoutKind: "lightning",
      });
    });

    it("should attempt auto-renew payment via NWC when selected", async () => {
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
      (getDecryptedUserNWC as ReturnType<typeof vi.fn>).mockResolvedValue(
        "nostr+walletconnect://saved"
      );
      (manuallyVerifyPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        paid: true,
        message: "ok",
      });
      (getPlanPriceUsd as ReturnType<typeof vi.fn>).mockResolvedValue(120);

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
        paymentMode: "auto_renew",
        billingCadence: "yearly",
        accessDurationMonths: "12",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(updateUserNWC).not.toHaveBeenCalled();
      expect(getDecryptedUserNWC).toHaveBeenCalledWith(TEST_USER_ID);
      expect(manuallyVerifyPayment).toHaveBeenCalledWith("payment-123");
      expect(result).toEqual({
        success: true,
        paid: true,
        message: "Subscription started with auto-renew enabled.",
      });
    });

    it("should create manual invoice for monthly 6-month prepay", async () => {
      const mockInvoice = {
        invoice: "lnbc123...",
        paymentHash: "hash123",
        amount: 1000,
        amountUsd: 60.0,
        paymentId: "payment-123",
        expiresAt: new Date("2024-12-31"),
        planName: "Basic Plan",
        planId: "basic",
      };

      (createPlanInvoice as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockInvoice
      );
      (getPlanPriceUsd as ReturnType<typeof vi.fn>).mockResolvedValue(60);

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
        paymentMode: "manual",
        billingCadence: "monthly",
        accessDurationMonths: "6",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(createPlanInvoice).toHaveBeenCalledWith({
        planId: "basic",
        userId: TEST_USER_ID,
        description: "SmartFlow Social - Plan subscription",
        amountUsdOverride: expect.any(Number) as unknown as number,
        billingCadence: "monthly",
        accessDurationMonths: 6,
        billingPaymentMethod: "lightning_one_time",
      });
      expect(result).toEqual({
        success: true,
        paymentMode: "manual",
        invoice: "lnbc123...",
        paymentHash: "hash123",
        amount: 1000,
        amountUsd: 60.0,
        paymentId: "payment-123",
        expiresAt: mockInvoice.expiresAt.toISOString(),
        planName: "Basic Plan",
        planId: "basic",
        checkoutKind: "lightning",
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

      expect(createPlanInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: "free",
          userId: TEST_USER_ID,
          billingCadence: "monthly",
          accessDurationMonths: 1,
          billingPaymentMethod: "lightning_one_time",
          amountUsdOverride: 0,
        })
      );
      expect(getPlanPriceUsd).not.toHaveBeenCalled();
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
      (getPlanPriceUsd as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const formData = createFormData({
        intent: "select_plan",
        planId: "invalid-plan",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        error: "Plan not found",
        status: 500,
      });
    });

    it("should handle generic errors in invoice creation", async () => {
      (createPlanInvoice as ReturnType<typeof vi.fn>).mockRejectedValue(
        "Unknown error"
      );
      (getPlanPriceUsd as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        error: "Failed to create payment invoice",
        status: 500,
      });
    });

    it("should reject btc_onchain when billing is not yearly (validation)", async () => {
      (isBtcpayConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
        paymentMode: "btc_onchain",
        billingCadence: "monthly",
        accessDurationMonths: "1",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toBeInstanceOf(Response);
      expect(createPlanInvoice).not.toHaveBeenCalled();
      const data = (await (result as Response).json()) as { error?: string };
      expect(data.error).toBeDefined();
      expect(String(data.error)).toMatch(/yearly/i);
    });

    it("should reject btc_onchain for free plan", async () => {
      (isBtcpayConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const formData = createFormData({
        intent: "select_plan",
        planId: "free",
        paymentMode: "btc_onchain",
        billingCadence: "yearly",
        accessDurationMonths: "12",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        success: false,
        error: "Bitcoin on-chain checkout is not available for the free plan.",
        status: 400,
      });
      expect(createPlanInvoice).not.toHaveBeenCalled();
    });

    it("should reject btc_onchain when BTCPay env is not configured", async () => {
      (isBtcpayConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const formData = createFormData({
        intent: "select_plan",
        planId: "founder",
        paymentMode: "btc_onchain",
        billingCadence: "yearly",
        accessDurationMonths: "12",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toEqual({
        success: false,
        error: "Bitcoin on-chain checkout is not available right now.",
        status: 503,
      });
      expect(createPlanInvoice).not.toHaveBeenCalled();
    });

    it("should create BTCPay checkout for founder yearly when BTCPay is configured", async () => {
      (isBtcpayConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (getPlanPriceUsd as ReturnType<typeof vi.fn>).mockResolvedValue(2600);
      const exp = new Date("2030-01-01T00:00:00.000Z");
      (createPlanInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({
        invoice: "https://pay.example/checkout/abc",
        paymentHash: "btcpay:abc",
        amount: 50_000,
        amountUsd: 2600,
        expiresAt: exp,
        paymentId: "founder_1_u",
        planName: "Founder",
        planId: "founder",
        checkoutKind: "btcpay",
      });

      const formData = createFormData({
        intent: "select_plan",
        planId: "founder",
        paymentMode: "btc_onchain",
        billingCadence: "yearly",
        accessDurationMonths: "12",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(createPlanInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: "founder",
          userId: TEST_USER_ID,
          billingPaymentMethod: "btc_btcpay_onchain",
          billingCadence: "yearly",
          accessDurationMonths: 12,
          amountUsdOverride: 2600,
        })
      );
      expect(result).toEqual({
        success: true,
        paymentMode: "btc_onchain",
        invoice: "https://pay.example/checkout/abc",
        paymentHash: "btcpay:abc",
        amount: 50_000,
        amountUsd: 2600,
        paymentId: "founder_1_u",
        expiresAt: exp.toISOString(),
        planName: "Founder",
        planId: "founder",
        checkoutKind: "btcpay",
      });
    });

    it("should create BTCPay checkout for basic yearly when BTCPay is configured", async () => {
      (isBtcpayConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (getPlanPriceUsd as ReturnType<typeof vi.fn>).mockResolvedValue(336);
      const exp = new Date("2030-01-01T00:00:00.000Z");
      (createPlanInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({
        invoice: "https://pay.example/checkout/basic",
        paymentHash: "btcpay:basic",
        amount: 500_000,
        amountUsd: 336,
        expiresAt: exp,
        paymentId: "basic_12_u",
        planName: "Basic",
        planId: "basic",
        checkoutKind: "btcpay",
      });

      const formData = createFormData({
        intent: "select_plan",
        planId: "basic",
        paymentMode: "btc_onchain",
        billingCadence: "yearly",
        accessDurationMonths: "12",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(createPlanInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: "basic",
          billingPaymentMethod: "btc_btcpay_onchain",
          billingCadence: "yearly",
          accessDurationMonths: 12,
          amountUsdOverride: 336,
        })
      );
      expect(result).toMatchObject({
        success: true,
        paymentMode: "btc_onchain",
        planId: "basic",
        checkoutKind: "btcpay",
      });
    });

    it("should reject checkout for Teams (disabled / not purchasable)", async () => {
      const formData = createFormData({
        intent: "select_plan",
        planId: "teams",
        paymentMode: "manual",
        billingCadence: "monthly",
        accessDurationMonths: "1",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toMatchObject({
        success: false,
        status: 400,
      });
      expect(createPlanInvoice).not.toHaveBeenCalled();
    });

    it("should reject auto_renew for Founder lifetime plan", async () => {
      const formData = createFormData({
        intent: "select_plan",
        planId: "founder",
        paymentMode: "auto_renew",
        billingCadence: "yearly",
        accessDurationMonths: "12",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toMatchObject({
        success: false,
        status: 400,
      });
      expect(String((result as { error?: string }).error)).toMatch(
        /auto-renew/i
      );
      expect(createPlanInvoice).not.toHaveBeenCalled();
    });

    it("should reject Founder checkout when sold out", async () => {
      (
        countActiveSubscriptionsForPlan as ReturnType<typeof vi.fn>
      ).mockResolvedValue(21);

      const formData = createFormData({
        intent: "select_plan",
        planId: "founder",
        paymentMode: "manual",
        billingCadence: "yearly",
        accessDurationMonths: "12",
      });

      const request = new Request("http://localhost:3000/plans");
      const result = await handlePlansAction(formData, request);

      expect(result).toMatchObject({
        success: false,
        status: 400,
      });
      expect((result as { error?: string }).error).toMatch(/sold out/i);
      expect(createPlanInvoice).not.toHaveBeenCalled();
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

      const result = await handlePlansAction(formData, request);
      expect(result).toEqual({
        error: "Authentication required",
        status: 500,
      });
    });
  });
});
