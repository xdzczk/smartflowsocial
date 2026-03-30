import { LN, SATS } from "@getalby/sdk/lnclient";

import { appendGiveawayActivityLog } from "~/features/giveaway/giveaway-activity-log.server";
import { quoteGiveawayFinalization } from "~/features/giveaway/giveaway-finalization-fee.server";
import { findGiveawayByIdAndUser } from "~/features/giveaway/repositories/giveaway-actions-data.server";
import { expireStaleFinalizationPaymentsForGiveaway } from "~/features/giveaway/repositories/giveaway-finalization-payment.server";
import type { UserSubscription } from "~/features/payments/types";
import { getPlanDisplayName, getUserPlanType } from "~/features/payments/types";
import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { ExternalServiceError } from "~/lib/errors";
import { prisma } from "~/lib/prisma.server";

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
import { getUserSubscription } from "./payment.queries.server";

export interface GiveawayFinalizationInvoiceResponse {
  invoice: string;
  paymentHash: string;
  amount: number;
  amountUsd: null;
  expiresAt: Date;
  paymentId: string;
  lockConfigHash: string;
}

/**
 * Lightning invoice for giveaway finalization fee (sats). Reuses Payment + GiveawayFinalizationPayment.
 */
export async function createGiveawayFinalizationInvoice(params: {
  giveawayId: string;
  userId: string;
  /** Client hash must match server recomputation (stale preview guard). */
  lockConfigHash: string;
}): Promise<GiveawayFinalizationInvoiceResponse> {
  const { giveawayId, userId, lockConfigHash: clientHash } = params;

  const g = await findGiveawayByIdAndUser(giveawayId, userId);
  if (!g) {
    throw new Error("Giveaway not found");
  }
  if (g.status !== "PREVIEWED") {
    throw new Error("Only previewed giveaways can pay a finalization fee");
  }

  const subscription = await getUserSubscription(userId);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const quote = quoteGiveawayFinalization({
    giveaway: {
      winnerSnapshot: g.winnerSnapshot,
      engagementConfig: g.engagementConfig,
      winnerCount: g.winnerCount,
      selectionMode: g.selectionMode,
      scopeType: g.scopeType,
      scopeReference: g.scopeReference,
      engagementTypes: g.engagementTypes,
      filters: g.filters,
      engagementWeights: g.engagementWeights,
    },
    planType,
  });

  if (clientHash !== quote.lockConfigHash) {
    throw new Error(
      "This preview changed after the fee was quoted. Refresh and try again."
    );
  }

  if (quote.feeSats <= 0) {
    throw new Error("No finalization fee is due for this giveaway");
  }

  const credentials = env.OWNER_NWC;
  if (!credentials) {
    throw new Error(OWNER_NWC_MISSING);
  }

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
    await expireStaleFinalizationPaymentsForGiveaway(giveawayId);

    const request = (await withOwnerWalletInvoiceRequestTimeout(
      ln.requestPayment(SATS(quote.feeSats) as unknown as { amount: number })
    )) as unknown as {
      onPaid: (callback: () => void) => {
        onTimeout: (seconds: number, callback: () => void) => void;
      };
      onTimeout: (seconds: number, callback: () => void) => void;
    };

    const paymentId = `gf_${giveawayId}_${Date.now()}_${userId}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const invoiceString = extractInvoiceFromRequest(request);
    const paymentHashString = extractPaymentHashFromRequest(request);
    const amountSats = await extractAmountFromRequest(
      request,
      invoiceString,
      0,
      async () => quote.feeSats
    );

    if (!invoiceString || !paymentHashString) {
      logError(
        new Error("Failed to extract invoice or paymentHash from request"),
        {
          invoiceString,
          paymentHashString,
          giveawayId,
          userId,
        }
      );
      throw new Error(
        "Invalid response from payment provider - missing invoice or paymentHash"
      );
    }

    const planLabel = getPlanDisplayName(
      subscription as UserSubscription | null
    );

    await prisma.payment.create({
      data: {
        id: paymentId,
        userId,
        amount: amountSats,
        amountUsd: null,
        invoice: invoiceString,
        paymentHash: paymentHashString,
        status: "PENDING",
        purpose: "GIVEAWAY_FINALIZATION",
        description: `Giveaway finalization: ${giveawayId}`,
        expiresAt,
      },
    });

    await prisma.giveawayFinalizationPayment.create({
      data: {
        giveawayId,
        userId,
        planName: planLabel,
        feeRateBps: quote.feeRateBps,
        plannedPayoutSats: quote.plannedPayoutSats,
        feeSats: quote.feeSats,
        lockConfigHash: quote.lockConfigHash,
        status: "PENDING",
        paymentId,
      },
    });

    await prisma.giveaway.update({
      where: { id: giveawayId },
      data: {
        activityLog: appendGiveawayActivityLog(g.activityLog, "fee_quoted", {
          feeSats: quote.feeSats,
          feeRateBps: quote.feeRateBps,
          plannedPayoutSats: quote.plannedPayoutSats,
          planName: planLabel,
          lockConfigHash: quote.lockConfigHash,
        }),
      },
    });

    const onPaid = () => {
      void handlePaymentCompleted(paymentId, userId, "");
    };
    const onTimeoutCb = () => {
      void handlePaymentTimeout(paymentId);
    };

    request.onPaid(onPaid).onTimeout(1800, onTimeoutCb);

    return {
      invoice: invoiceString,
      paymentHash: paymentHashString,
      amount: amountSats,
      amountUsd: null,
      expiresAt,
      paymentId,
      lockConfigHash: quote.lockConfigHash,
    };
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      logError(error, {
        giveawayId,
        userId,
        ownerRelays,
        message: "Failed to create giveaway finalization invoice",
      });
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logError(err, {
      giveawayId,
      userId,
      ownerRelays,
      message: "Failed to create giveaway finalization invoice",
    });

    if (isLikelyWebsocketRelayError(err.message)) {
      throw new ExternalServiceError(
        "Payments are temporarily unavailable (cannot reach the Lightning relay). Please try again in a few minutes.",
        503,
        {
          giveawayId,
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
        giveawayId,
        userId,
        ownerRelays,
        originalError: err.message,
      }
    );
  }
}
