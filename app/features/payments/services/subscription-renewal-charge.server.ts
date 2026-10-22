import { manuallyVerifyPayment } from "~/features/payments/data/payment-manual-verify.server";
import { createPlanInvoice } from "~/features/payments/data/payment-plan-invoice.server";
import { extendUserSubscriptionFromPayment } from "~/features/payments/data/payment-subscription.server";
import { handlePaymentTimeout } from "~/features/payments/data/payment.handlers.server";
import {
  getPlanPriceUsd,
  getUserSubscription,
} from "~/features/payments/data/payment.queries.server";
import { touchUserNwcLastUsed } from "~/features/user";
import { env } from "~/lib/env.server";

import {
  attachPaymentSubscription,
  findOpenRenewalPaymentForPeriod,
} from "../repositories/subscription-renewal-data.server";

import {
  assertUserNwcCanPay,
  NwcChargeError,
  payBolt11WithUserNwc,
} from "./nwc-user-pay.server";

const VERIFY_ATTEMPTS = 3;
const VERIFY_DELAY_MS = 500;

type OpenRenewalPayment = NonNullable<
  Awaited<ReturnType<typeof findOpenRenewalPaymentForPeriod>>
>;

/**
 * Charges one auto-renew period through the checkout invoice path.
 * The subscription is extended only after the owner wallet confirms the
 * payment. A second invoice is not created while one for this period is
 * still pending or already paid.
 */
export async function chargeAutoRenewSubscription(params: {
  userId: string;
  nwcUrl: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  planPriceUsd: number;
  periodEnd: Date;
  billingCadence: "monthly" | "yearly";
}): Promise<void> {
  if (!env.OWNER_NWC) {
    throw new NwcChargeError(
      "invoice_failed",
      "Owner NWC credentials not configured"
    );
  }

  const existing = await findOpenRenewalPaymentForPeriod({
    userId: params.userId,
    periodEnd: params.periodEnd,
  });

  if (existing?.status === "COMPLETED") {
    await ensurePeriodExtended(params, existing.id);
    return;
  }

  const payment = await invoiceToPay(params, existing);
  if (!payment) return;

  try {
    await payBolt11WithUserNwc(params.nwcUrl, payment.invoice);
  } catch (error) {
    if (error instanceof NwcChargeError && error.kind === "unconfirmed") {
      if (await confirmPayment(params, payment.id)) return;
    }
    throw error;
  }

  await touchUserNwcLastUsed(params.userId);
  if (await confirmPayment(params, payment.id)) return;
  throw new NwcChargeError("unconfirmed", "Renewal payment was not confirmed");
}

/**
 * Returns the invoice to pay, or null when this period is already confirmed.
 */
async function invoiceToPay(
  params: {
    userId: string;
    nwcUrl: string;
    subscriptionId: string;
    planId: string;
    planName: string;
    planPriceUsd: number;
    periodEnd: Date;
    billingCadence: "monthly" | "yearly";
  },
  existing: OpenRenewalPayment | null
): Promise<{ id: string; invoice: string } | null> {
  if (existing && isUnexpiredPending(existing)) {
    if (existing.subscriptionId !== params.subscriptionId) {
      await attachPaymentSubscription(existing.id, params.subscriptionId);
    }
    if (await confirmPayment(params, existing.id)) return null;
    await assertUserNwcCanPay(params.nwcUrl);
    return { id: existing.id, invoice: existing.invoice };
  }

  if (existing?.status === "PENDING") {
    await handlePaymentTimeout(existing.id);
  }

  return createRenewalInvoice(params);
}

function isUnexpiredPending(payment: OpenRenewalPayment): boolean {
  return (
    payment.status === "PENDING" &&
    payment.invoice.length > 0 &&
    payment.expiresAt != null &&
    payment.expiresAt.getTime() > Date.now()
  );
}

async function createRenewalInvoice(params: {
  userId: string;
  nwcUrl: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  planPriceUsd: number;
  billingCadence: "monthly" | "yearly";
}): Promise<{ id: string; invoice: string }> {
  const durationMonths = params.billingCadence === "yearly" ? 12 : 1;
  const skuUsd = await getPlanPriceUsd({
    planId: params.planId,
    billingCadence: params.billingCadence,
    accessDurationMonths: durationMonths,
    paymentMethod: "nwc_auto_renew",
  });
  const amountUsd =
    typeof skuUsd === "number" && Number.isFinite(skuUsd) && skuUsd > 0
      ? skuUsd
      : params.planPriceUsd;
  if (!(amountUsd > 0)) {
    throw new NwcChargeError(
      "invoice_failed",
      "Renewal price is not configured"
    );
  }

  await assertUserNwcCanPay(params.nwcUrl);

  let created: Awaited<ReturnType<typeof createPlanInvoice>>;
  try {
    created = await createPlanInvoice({
      planId: params.planId,
      userId: params.userId,
      description: `${params.planName} plan renewal`,
      amountUsdOverride: amountUsd,
      billingCadence: params.billingCadence,
      accessDurationMonths: durationMonths,
      billingPaymentMethod: "nwc_auto_renew",
    });
  } catch (error) {
    throw new NwcChargeError(
      "invoice_failed",
      error instanceof Error ? error.message : String(error)
    );
  }

  await attachPaymentSubscription(created.paymentId, params.subscriptionId);
  return { id: created.paymentId, invoice: created.invoice };
}

async function confirmPayment(
  params: { userId: string; planId: string; periodEnd: Date },
  paymentId: string
): Promise<boolean> {
  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
    const verification = await manuallyVerifyPayment(paymentId);
    if (verification.success && verification.paid) {
      await ensurePeriodExtended(params, paymentId);
      return true;
    }
    if (attempt < VERIFY_ATTEMPTS - 1) {
      await sleep(VERIFY_DELAY_MS);
    }
  }
  return false;
}

async function ensurePeriodExtended(
  params: { userId: string; planId: string; periodEnd: Date },
  paymentId: string
): Promise<void> {
  const sub = await getUserSubscription(params.userId);
  const end = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  if (
    end &&
    end.getTime() > params.periodEnd.getTime() &&
    end.getTime() > Date.now()
  ) {
    return;
  }
  await extendUserSubscriptionFromPayment(
    params.userId,
    params.planId,
    paymentId
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
