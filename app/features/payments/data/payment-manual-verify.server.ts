import { NWCClient } from "@getalby/sdk";

import {
  BTCPAY_MIN_ONCHAIN_CONFIRMS_FOR_ACCESS,
  btcpayGetInvoiceSnapshot,
} from "~/features/payments/btcpay.server";
import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import { OWNER_NWC_MISSING } from "./payment-owner-wallet-invoice-timeout.server";
import { getOwnerNwcWithRelayOverrides } from "./payment-shared.server";
import {
  handlePaymentCompleted,
  handlePaymentTimeout,
} from "./payment.handlers.server";

interface ManualVerifyPaymentRow {
  status: string;
  userId: string;
  purpose: string;
  billingPaymentMethod: string | null;
  btcpayInvoiceId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  paymentHash: string;
  Subscription: { planId: string | null } | null;
}

function isBtcpayInvoiceTerminalFailure(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "expired" || s === "invalid";
}

function resolvePlanIdForManualVerify(
  payment: Pick<ManualVerifyPaymentRow, "purpose" | "Subscription">,
  paymentId: string
): string | null {
  if (payment.purpose === "GIVEAWAY_FINALIZATION") {
    return "__giveaway_finalization__";
  }
  if (payment.Subscription?.planId) {
    return payment.Subscription.planId;
  }
  const parts = paymentId.split("_");
  if (parts.length >= 3) {
    return parts[0] ?? null;
  }
  return null;
}

async function verifyBtcpayPaymentManually(params: {
  paymentId: string;
  userId: string;
  planId: string;
  btcpayInvoiceId: string;
  expiresAt: Date | null;
}): Promise<{
  success: boolean;
  paid: boolean;
  message: string;
  btcpayAwaitingConfirmations?: boolean;
}> {
  const graceEnd =
    params.expiresAt != null
      ? new Date(params.expiresAt.getTime() + 48 * 60 * 60 * 1000)
      : null;
  if (graceEnd != null && graceEnd < new Date()) {
    return {
      success: false,
      paid: false,
      message:
        "Payment window has ended. Please contact support if you already paid.",
    };
  }

  try {
    const snap = await btcpayGetInvoiceSnapshot(params.btcpayInvoiceId);
    const { invoiceStatus: status } = snap;

    if (isBtcpayInvoiceTerminalFailure(status)) {
      await handlePaymentTimeout(params.paymentId);
      return {
        success: true,
        paid: false,
        message: "Invoice expired or was invalidated",
      };
    }

    const confOk =
      snap.maxOnChainConfirmations >= BTCPAY_MIN_ONCHAIN_CONFIRMS_FOR_ACCESS;

    if (snap.hasOnChainPaymentStarted && confOk) {
      await handlePaymentCompleted(
        params.paymentId,
        params.userId,
        params.planId
      );
      return {
        success: true,
        paid: true,
        message: "Payment verified and completed",
      };
    }

    if (snap.hasOnChainPaymentStarted && !confOk) {
      return {
        success: true,
        paid: false,
        btcpayAwaitingConfirmations: true,
        message: "Payment seen; waiting for first on-chain confirmation",
      };
    }

    return {
      success: true,
      paid: false,
      message: "Payment not received yet",
    };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      paymentId: params.paymentId,
      message: "Failed to verify BTCPay invoice",
    });
    return {
      success: false,
      paid: false,
      message: "Failed to verify payment",
    };
  }
}

async function verifyNwcPaymentManually(params: {
  paymentId: string;
  userId: string;
  planId: string;
  paymentHash: string;
  createdAt: Date;
}): Promise<{ success: boolean; paid: boolean; message: string }> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (params.createdAt <= thirtyMinutesAgo) {
    return {
      success: false,
      paid: false,
      message: "Payment is too old to auto-verify. Please contact support.",
    };
  }

  const ownerNwc = env.OWNER_NWC;
  if (!ownerNwc) {
    return {
      success: false,
      paid: false,
      message: OWNER_NWC_MISSING,
    };
  }

  const { credentials: ownerNwcCredentials, relays: ownerRelays } =
    getOwnerNwcWithRelayOverrides(ownerNwc);

  const nwcClient = new NWCClient({
    nostrWalletConnectUrl: ownerNwcCredentials,
  });

  try {
    const tx = (await nwcClient.lookupInvoice({
      payment_hash: params.paymentHash,
    })) as unknown;

    const txObj: Record<string, unknown> =
      tx && typeof tx === "object" && !Array.isArray(tx)
        ? (tx as Record<string, unknown>)
        : {};

    const state = typeof txObj["state"] === "string" ? txObj["state"] : "";
    const settledAt =
      typeof txObj["settled_at"] === "number" ? txObj["settled_at"] : 0;
    const preimage =
      typeof txObj["preimage"] === "string" ? txObj["preimage"] : null;

    const isSettled =
      state === "settled" || (settledAt > 0 && typeof preimage === "string");

    if (!isSettled) {
      return {
        success: true,
        paid: false,
        message: "Payment not settled yet",
      };
    }

    await handlePaymentCompleted(
      params.paymentId,
      params.userId,
      params.planId
    );

    if (preimage) {
      await prisma.payment.update({
        where: { id: params.paymentId },
        data: { preimage },
      });
    }

    return {
      success: true,
      paid: true,
      message: "Payment verified and completed",
    };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      paymentId: params.paymentId,
      ownerRelays,
      message: "Failed to verify payment via lookup_invoice",
    });
    return {
      success: false,
      paid: false,
      message: "Failed to verify payment",
    };
  } finally {
    nwcClient.close();
  }
}

/**
 * Manually verify and complete a payment if it was received but not detected
 */
export async function manuallyVerifyPayment(paymentId: string): Promise<{
  success: boolean;
  paid: boolean;
  message: string;
  btcpayAwaitingConfirmations?: boolean;
}> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      Subscription: {
        select: {
          planId: true,
        },
      },
    },
  });

  if (!payment) {
    return {
      success: false,
      paid: false,
      message: "Payment not found",
    };
  }

  if (payment.status === "COMPLETED") {
    return {
      success: true,
      paid: true,
      message: "Payment already completed",
    };
  }

  const planId = resolvePlanIdForManualVerify(payment, paymentId);

  if (!planId) {
    return {
      success: false,
      paid: false,
      message: "Could not determine plan for this payment",
    };
  }

  if (payment.status !== "PENDING" || !payment.userId) {
    return {
      success: true,
      paid: false,
      message: "Payment is not pending",
    };
  }

  if (
    payment.billingPaymentMethod === "btc_btcpay_onchain" &&
    payment.btcpayInvoiceId
  ) {
    return verifyBtcpayPaymentManually({
      paymentId,
      userId: payment.userId,
      planId,
      btcpayInvoiceId: payment.btcpayInvoiceId,
      expiresAt: payment.expiresAt,
    });
  }

  return verifyNwcPaymentManually({
    paymentId,
    userId: payment.userId,
    planId,
    paymentHash: payment.paymentHash,
    createdAt: payment.createdAt,
  });
}
