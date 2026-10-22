import { beforeEach, describe, expect, it, vi } from "vitest";

const { envState } = vi.hoisted(() => {
  const state: { OWNER_NWC?: string; NODE_ENV: string } = {
    OWNER_NWC: "owner-nwc",
    NODE_ENV: "test",
  };
  return { envState: state };
});

vi.mock("~/lib/env.server", () => ({
  env: envState,
}));

vi.mock("~/features/user", () => ({
  touchUserNwcLastUsed: vi.fn(),
}));

vi.mock(
  "~/features/payments/repositories/subscription-renewal-data.server",
  () => ({
    findOpenRenewalPaymentForPeriod: vi.fn(),
    attachPaymentSubscription: vi.fn(),
  })
);

vi.mock("~/features/payments/data/payment-plan-invoice.server", () => ({
  createPlanInvoice: vi.fn(),
}));

vi.mock("~/features/payments/data/payment-manual-verify.server", () => ({
  manuallyVerifyPayment: vi.fn(),
}));

vi.mock("~/features/payments/data/payment-subscription.server", () => ({
  extendUserSubscriptionFromPayment: vi.fn(),
}));

vi.mock("~/features/payments/data/payment.handlers.server", () => ({
  handlePaymentTimeout: vi.fn(),
}));

vi.mock("~/features/payments/data/payment.queries.server", () => ({
  getPlanPriceUsd: vi.fn(),
  getUserSubscription: vi.fn(),
}));

vi.mock("~/features/payments/services/nwc-user-pay.server", () => ({
  assertUserNwcCanPay: vi.fn(),
  payBolt11WithUserNwc: vi.fn(),
  classifyNwcPayError: vi.fn(),
  nwcChargeFailureNotice: vi.fn(),
  NwcChargeError: class NwcChargeError extends Error {
    readonly kind: string;
    constructor(kind: string, message: string) {
      super(message);
      this.name = "NwcChargeError";
      this.kind = kind;
    }
  },
}));

import { manuallyVerifyPayment } from "~/features/payments/data/payment-manual-verify.server";
import { createPlanInvoice } from "~/features/payments/data/payment-plan-invoice.server";
import { extendUserSubscriptionFromPayment } from "~/features/payments/data/payment-subscription.server";
import { handlePaymentTimeout } from "~/features/payments/data/payment.handlers.server";
import {
  getPlanPriceUsd,
  getUserSubscription,
} from "~/features/payments/data/payment.queries.server";
import {
  attachPaymentSubscription,
  findOpenRenewalPaymentForPeriod,
} from "~/features/payments/repositories/subscription-renewal-data.server";
import {
  assertUserNwcCanPay,
  NwcChargeError,
  payBolt11WithUserNwc,
} from "~/features/payments/services/nwc-user-pay.server";
import { chargeAutoRenewSubscription } from "~/features/payments/services/subscription-renewal-charge.server";
import { touchUserNwcLastUsed } from "~/features/user";

const periodEnd = new Date("2026-09-01T00:00:00.000Z");

function chargeParams() {
  return {
    userId: "user-1",
    nwcUrl: "nwc://user",
    subscriptionId: "sub-1",
    planId: "plan-1",
    planName: "Basic",
    planPriceUsd: 10,
    periodEnd,
    billingCadence: "monthly" as const,
  };
}

describe("chargeAutoRenewSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.OWNER_NWC = "owner-nwc";
    (
      findOpenRenewalPaymentForPeriod as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (getPlanPriceUsd as ReturnType<typeof vi.fn>).mockResolvedValue(12);
    (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue({
      currentPeriodEnd: periodEnd,
    });
    (createPlanInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentId: "pay-1",
      invoice: "lnbc1new",
    });
    (manuallyVerifyPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      paid: true,
      message: "paid",
    });
    (payBolt11WithUserNwc as ReturnType<typeof vi.fn>).mockResolvedValue(
      "preimage"
    );
    (assertUserNwcCanPay as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
  });

  it("probes the wallet before creating an invoice", async () => {
    const order: string[] = [];
    (assertUserNwcCanPay as ReturnType<typeof vi.fn>).mockImplementation(() => {
      order.push("probe");
    });
    (createPlanInvoice as ReturnType<typeof vi.fn>).mockImplementation(() => {
      order.push("invoice");
      return { paymentId: "pay-1", invoice: "lnbc1new" };
    });

    await chargeAutoRenewSubscription(chargeParams());

    expect(order).toEqual(["probe", "invoice"]);
    expect(createPlanInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        amountUsdOverride: 12,
        billingPaymentMethod: "nwc_auto_renew",
        accessDurationMonths: 1,
      })
    );
    expect(attachPaymentSubscription).toHaveBeenCalledWith("pay-1", "sub-1");
    expect(payBolt11WithUserNwc).toHaveBeenCalledWith("nwc://user", "lnbc1new");
    expect(touchUserNwcLastUsed).toHaveBeenCalledWith("user-1");
  });

  it("does not create an invoice when the wallet cannot be reached", async () => {
    (assertUserNwcCanPay as ReturnType<typeof vi.fn>).mockRejectedValue(
      new NwcChargeError("connection_dead", "websocket closed")
    );

    await expect(
      chargeAutoRenewSubscription(chargeParams())
    ).rejects.toMatchObject({ kind: "connection_dead" });
    expect(createPlanInvoice).not.toHaveBeenCalled();
  });

  it("does not create an invoice when the owner wallet is not configured", async () => {
    envState.OWNER_NWC = undefined;

    await expect(
      chargeAutoRenewSubscription(chargeParams())
    ).rejects.toMatchObject({ kind: "invoice_failed" });
    expect(assertUserNwcCanPay).not.toHaveBeenCalled();
    expect(createPlanInvoice).not.toHaveBeenCalled();
  });

  it("pays an existing pending invoice instead of creating another", async () => {
    (
      findOpenRenewalPaymentForPeriod as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "pay-old",
      status: "PENDING",
      invoice: "lnbc1old",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      subscriptionId: "sub-1",
    });
    (manuallyVerifyPayment as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ success: true, paid: false, message: "open" })
      .mockResolvedValueOnce({ success: true, paid: false, message: "open" })
      .mockResolvedValueOnce({ success: true, paid: false, message: "open" })
      .mockResolvedValue({ success: true, paid: true, message: "paid" });

    vi.useFakeTimers();
    try {
      const pending = chargeAutoRenewSubscription(chargeParams());
      await vi.runAllTimersAsync();
      await pending;
    } finally {
      vi.useRealTimers();
    }

    expect(createPlanInvoice).not.toHaveBeenCalled();
    expect(payBolt11WithUserNwc).toHaveBeenCalledWith("nwc://user", "lnbc1old");
  });

  it("does not pay again when this period is already completed", async () => {
    (
      findOpenRenewalPaymentForPeriod as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "pay-done",
      status: "COMPLETED",
      invoice: "lnbc1done",
      expiresAt: new Date(),
      subscriptionId: "sub-1",
    });
    (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue({
      currentPeriodEnd: periodEnd,
    });

    await chargeAutoRenewSubscription(chargeParams());

    expect(payBolt11WithUserNwc).not.toHaveBeenCalled();
    expect(createPlanInvoice).not.toHaveBeenCalled();
    expect(extendUserSubscriptionFromPayment).toHaveBeenCalledWith(
      "user-1",
      "plan-1",
      "pay-done"
    );
  });

  it("skips extension when the completed payment already renewed the period", async () => {
    (
      findOpenRenewalPaymentForPeriod as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "pay-done",
      status: "COMPLETED",
      invoice: "lnbc1done",
      expiresAt: new Date(),
      subscriptionId: "sub-1",
    });
    (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue({
      currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
    });

    await chargeAutoRenewSubscription(chargeParams());

    expect(extendUserSubscriptionFromPayment).not.toHaveBeenCalled();
  });

  it("expires a stale pending invoice before creating a new one", async () => {
    (
      findOpenRenewalPaymentForPeriod as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "pay-stale",
      status: "PENDING",
      invoice: "lnbc1stale",
      expiresAt: new Date(Date.now() - 60_000),
      subscriptionId: "sub-1",
    });

    await chargeAutoRenewSubscription(chargeParams());

    expect(handlePaymentTimeout).toHaveBeenCalledWith("pay-stale");
    expect(createPlanInvoice).toHaveBeenCalled();
  });

  it("fails as unconfirmed when the preimage never settles", async () => {
    (manuallyVerifyPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      paid: false,
      message: "open",
    });

    vi.useFakeTimers();
    try {
      const pending = chargeAutoRenewSubscription(chargeParams());
      const assertion = expect(pending).rejects.toMatchObject({
        kind: "unconfirmed",
      });
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
