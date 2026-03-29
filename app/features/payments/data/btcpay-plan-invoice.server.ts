/**
 * Creates a pending subscription Payment + BTCPay checkout invoice (Founder on-chain).
 */

import { getBitcoinRate } from "~/features/payments/btc.rate";
import {
  btcpayCreateInvoice,
  isBtcpayConfigured,
} from "~/features/payments/btcpay.server";
import type {
  CreateInvoiceParams,
  InvoiceResponse,
} from "~/features/payments/types";
import { logError } from "~/lib/error-logger.server";
import { ExternalServiceError } from "~/lib/errors";
import { prisma } from "~/lib/prisma.server";

async function fallbackSats(amountUsd: number): Promise<number> {
  try {
    return await getBitcoinRate(amountUsd);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      amountUsd,
      message: "BTCPay invoice: fallback sats estimate",
    });
    return Math.round(amountUsd * 2500);
  }
}

export async function createBtcpayFounderInvoice(
  params: CreateInvoiceParams
): Promise<InvoiceResponse> {
  const {
    planId,
    userId,
    description,
    amountUsdOverride,
    billingCadence,
    accessDurationMonths,
    billingPaymentMethod,
  } = params;

  if (billingPaymentMethod !== "btc_btcpay_onchain") {
    throw new Error("createBtcpayFounderInvoice: invalid payment method");
  }

  if (!isBtcpayConfigured()) {
    throw new ExternalServiceError(
      "Bitcoin (on-chain) checkout is not available right now.",
      503,
      { reason: "btcpay_unconfigured" }
    );
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new Error(`Plan with ID ${planId} not found`);
  }
  if (!plan.isActive) {
    throw new Error(`Plan ${plan.name} is not currently available`);
  }

  const amountUsd =
    typeof amountUsdOverride === "number"
      ? amountUsdOverride
      : Number(plan.price);

  const paymentId = `${planId}_${Date.now()}_${userId}`;

  const btcpay = await btcpayCreateInvoice({
    amountUsd,
    paymentId,
    userId,
    planId,
    planLabel: plan.name,
  });

  const expiresAt =
    typeof btcpay.expirationTime === "number" && btcpay.expirationTime > 0
      ? new Date(btcpay.expirationTime * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

  const amountSats = await fallbackSats(amountUsd);

  await prisma.payment.create({
    data: {
      id: paymentId,
      userId,
      amount: amountSats,
      amountUsd,
      billingCadence: billingCadence ?? "monthly",
      accessDurationMonths: accessDurationMonths ?? 1,
      billingPaymentMethod: "btc_btcpay_onchain",
      invoice: btcpay.checkoutLink,
      paymentHash: `btcpay:${btcpay.id}`,
      btcpayInvoiceId: btcpay.id,
      status: "PENDING",
      description: description ?? `${plan.name} plan subscription`,
      expiresAt,
    },
  });

  return {
    invoice: btcpay.checkoutLink,
    paymentHash: `btcpay:${btcpay.id}`,
    amount: amountSats,
    amountUsd,
    expiresAt,
    paymentId,
    planName: plan.name,
    planId: plan.id,
    checkoutKind: "btcpay",
  };
}
