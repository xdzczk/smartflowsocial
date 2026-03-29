/**
 * BTCPay webhook settlement (Prisma + subscription completion).
 */

import { handlePaymentCompleted } from "~/features/payments/data/payment.handlers.server";
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

/**
 * Completes subscription if this BTCPay invoice matches a pending Payment row.
 */
export async function settleSubscriptionFromBtcpayInvoiceId(
  btcpayInvoiceId: string
): Promise<void> {
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

  const planId = planIdFromPaymentId(payment.id);
  if (!planId) {
    logError(
      new Error("BTCPay settle: could not parse planId from payment id"),
      {
        paymentId: payment.id,
        btcpayInvoiceId,
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
