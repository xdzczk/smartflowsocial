/**
 * BTCPay webhook settlement (Prisma + subscription completion).
 */

import {
  BTCPAY_MIN_ONCHAIN_CONFIRMS_FOR_ACCESS,
  btcpayGetInvoiceSnapshot,
} from "~/features/payments/btcpay.server";
import { handlePaymentCompleted } from "~/features/payments/data/payment.handlers.server";
import { parseCommercialPlanType } from "~/features/payments/plan-mapping";
import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

function parseWebhookInvoiceId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const o = payload as Record<string, unknown>;
  if (typeof o["invoiceId"] === "string") {
    return o["invoiceId"];
  }
  const data = o["data"];
  if (data && typeof data === "object") {
    const id = (data as Record<string, unknown>)["id"];
    if (typeof id === "string") {
      return id;
    }
  }
  return null;
}

function parseWebhookType(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const t = (payload as Record<string, unknown>)["type"];
  return typeof t === "string" ? t : null;
}

function planIdFromPaymentId(paymentId: string): string | null {
  const parts = paymentId.split("_");
  return parts.length >= 1 && parts[0] ? parts[0] : null;
}

function normalizeHistoricalPlanId(planId: string): string {
  const raw = planId.trim().toLowerCase();
  switch (raw) {
    case "basic":
      return "creator";
    case "premium":
      return "pro";
    case "enterprise":
      return "teams";
    default:
      return raw;
  }
}

/**
 * Completes subscription if this BTCPay invoice matches a pending Payment row
 * and on-chain confirmations meet {@link BTCPAY_MIN_ONCHAIN_CONFIRMS_FOR_ACCESS}.
 */
export async function settleSubscriptionFromBtcpayInvoiceId(
  btcpayInvoiceId: string
): Promise<void> {
  let snap;
  try {
    snap = await btcpayGetInvoiceSnapshot(btcpayInvoiceId);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      btcpayInvoiceId,
      message: "BTCPay webhook: invoice snapshot failed",
    });
    return;
  }

  if (
    snap.maxOnChainConfirmations < BTCPAY_MIN_ONCHAIN_CONFIRMS_FOR_ACCESS ||
    !snap.hasOnChainPaymentStarted
  ) {
    return;
  }

  const payment = await prisma.payment.findFirst({
    where: {
      btcpayInvoiceId,
      status: "PENDING",
      purpose: "SUBSCRIPTION",
    },
    select: { id: true, userId: true },
  });

  if (!payment) {
    return;
  }

  const rawPlanId = planIdFromPaymentId(payment.id);
  if (!rawPlanId) {
    logError(
      new Error("BTCPay settle: could not parse planId from payment id"),
      {
        paymentId: payment.id,
        btcpayInvoiceId,
      }
    );
    return;
  }

  const normalizedPlanId = normalizeHistoricalPlanId(rawPlanId);
  const planId = parseCommercialPlanType(normalizedPlanId);
  if (!planId) {
    logError(
      new Error("BTCPay settle: invalid planId parsed from payment id"),
      {
        paymentId: payment.id,
        btcpayInvoiceId,
        rawPlanId,
        normalizedPlanId,
      }
    );
    return;
  }

  await handlePaymentCompleted(payment.id, payment.userId, planId);
}

export async function processBtcpayWebhookPayload(
  payload: unknown
): Promise<void> {
  const type = parseWebhookType(payload);
  const invoiceId = parseWebhookInvoiceId(payload);

  if (!invoiceId) {
    return;
  }

  // 0-conf: do not grant access here  -  polling / later webhooks complete after ≥1 conf.
  // InvoiceSettled: usually matches store speed policy; we still require confirmations via snapshot.
  if (type === "InvoiceSettled") {
    await settleSubscriptionFromBtcpayInvoiceId(invoiceId);
    return;
  }

  if (type === "InvoiceExpired" || type === "InvoiceInvalid") {
    await prisma.payment.updateMany({
      where: {
        btcpayInvoiceId: invoiceId,
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
        failedAt: new Date(),
        failureReason:
          type === "InvoiceExpired"
            ? "BTCPay invoice expired"
            : "BTCPay invoice invalid",
      },
    });
  }
}
