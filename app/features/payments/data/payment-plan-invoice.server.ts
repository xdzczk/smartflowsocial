import { LN, USD } from "@getalby/sdk/lnclient";

import { getBitcoinRate } from "~/features/payments/btc.rate";
import type {
  CreateInvoiceParams,
  InvoiceResponse,
} from "~/features/payments/types";
import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { ExternalServiceError } from "~/lib/errors";
import { prisma } from "~/lib/prisma.server";

import { createBtcpayFounderInvoice } from "./btcpay-plan-invoice.server";
import { handleFreePlanInvoice } from "./payment-free-plan.server";
import {
  OWNER_NWC_MISSING,
  withOwnerWalletInvoiceRequestTimeout,
} from "./payment-owner-wallet-invoice-timeout.server";
import {
  getOwnerNwcWithRelayOverrides,
  isLikelyWebsocketRelayError,
} from "./payment-shared.server";
import {
  extractInvoiceFromRequest,
  extractPaymentHashFromRequest,
  extractAmountFromRequest,
} from "./payment-utils.server";
import {
  handlePaymentCompleted,
  handlePaymentTimeout,
} from "./payment.handlers.server";

async function getFallbackAmount(amountUsd: number): Promise<number> {
  try {
    return await getBitcoinRate(amountUsd);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      amountUsd,
      message: "Failed to fetch Bitcoin rate, using fallback",
    });
    return Math.round(amountUsd * 2500);
  }
}

/**
 * Creates an invoice for a specific plan using owner's NWC
 */
export async function createPlanInvoice({
  planId,
  userId,
  description,
  amountUsdOverride,
  billingCadence,
  accessDurationMonths,
  billingPaymentMethod,
}: CreateInvoiceParams): Promise<InvoiceResponse> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan with ID ${planId} not found`);
  }

  if (!plan.isActive) {
    throw new Error(`Plan ${plan.name} is not currently available`);
  }

  if (Number(plan.price) === 0) {
    return handleFreePlanInvoice(userId, planId, description);
  }

  if (billingPaymentMethod === "btc_btcpay_onchain") {
    return createBtcpayFounderInvoice({
      planId,
      userId,
      description,
      amountUsdOverride,
      billingCadence,
      accessDurationMonths,
      billingPaymentMethod,
    });
  }

  const credentials = env.OWNER_NWC;
  if (!credentials) {
    throw new Error(OWNER_NWC_MISSING);
  }

  const amountUsd =
    typeof amountUsdOverride === "number"
      ? amountUsdOverride
      : Number(plan.price);
  const { credentials: ownerNwcCredentials, relays: ownerRelays } =
    getOwnerNwcWithRelayOverrides(credentials);
  const ln = new LN(ownerNwcCredentials) as unknown as {
    requestPayment: (amount: { amount: number }) => Promise<{
      onPaid: (callback: () => void) => {
        onTimeout: (seconds: number, callback: () => void) => void;
      };
      onTimeout: (seconds: number, callback: () => void) => void;
    }>;
  };
  try {
    const request = (await withOwnerWalletInvoiceRequestTimeout(
      ln.requestPayment(USD(amountUsd) as unknown as { amount: number })
    )) as unknown as {
      onPaid: (callback: () => void) => {
        onTimeout: (seconds: number, callback: () => void) => void;
      };
      onTimeout: (seconds: number, callback: () => void) => void;
    };

    const paymentId = `${planId}_${Date.now()}_${userId}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const invoiceString = extractInvoiceFromRequest(request);
    const paymentHashString = extractPaymentHashFromRequest(request);
    const amountSats = await extractAmountFromRequest(
      request,
      invoiceString,
      amountUsd,
      getFallbackAmount
    );

    if (!invoiceString || !paymentHashString) {
      logError(
        new Error("Failed to extract invoice or paymentHash from request"),
        {
          invoiceString,
          paymentHashString,
          requestStructure: Object.keys(
            typeof request === "object" && !Array.isArray(request)
              ? (request as Record<string, unknown>)
              : {}
          ),
        }
      );
      throw new Error(
        "Invalid response from payment provider - missing invoice or paymentHash"
      );
    }

    await prisma.payment.create({
      data: {
        id: paymentId,
        userId,
        amount: amountSats,
        amountUsd,
        billingCadence,
        accessDurationMonths,
        billingPaymentMethod,
        invoice: invoiceString,
        paymentHash: paymentHashString,
        status: "PENDING",
        description: description ?? `${plan.name} plan subscription`,
        expiresAt,
      },
    });

    const giveAccess = () => {
      void handlePaymentCompleted(paymentId, userId, planId);
    };

    const showTimeout = () => {
      void handlePaymentTimeout(paymentId);
    };

    request.onPaid(giveAccess).onTimeout(1800, showTimeout);

    return {
      invoice: invoiceString,
      paymentHash: paymentHashString,
      amount: amountSats,
      amountUsd,
      expiresAt,
      paymentId,
      planName: plan.name,
      planId: plan.id,
    };
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      logError(error, {
        planId,
        userId,
        ownerRelays,
        message: "Failed to create invoice",
      });
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logError(err, {
      planId,
      userId,
      ownerRelays,
      message: "Failed to create invoice",
    });

    if (isLikelyWebsocketRelayError(err.message)) {
      throw new ExternalServiceError(
        "Payments are temporarily unavailable (cannot reach the Lightning relay). Please try again in a few minutes.",
        503,
        {
          planId,
          userId,
          ownerRelays,
          originalError: err.message,
        }
      );
    }

    throw new ExternalServiceError(
      "Failed to create payment invoice. Please try again later.",
      502,
      {
        planId,
        userId,
        ownerRelays,
        originalError: err.message,
      }
    );
  }
}
