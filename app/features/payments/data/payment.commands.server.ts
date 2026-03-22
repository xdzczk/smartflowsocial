/**
 * Payment commands: create invoice, renewal, update subscription, ensure free plan, manual verify.
 */

import { NWCClient } from "@getalby/sdk";
import { LN, SATS, USD } from "@getalby/sdk/lnclient";

import { appendGiveawayActivityLog } from "~/features/giveaway/giveaway-activity-log.server";
import { quoteGiveawayFinalization } from "~/features/giveaway/giveaway-finalization-fee.server";
import { findGiveawayByIdAndUser } from "~/features/giveaway/repositories/giveaway-actions-data.server";
import { expireStaleFinalizationPaymentsForGiveaway } from "~/features/giveaway/repositories/giveaway-finalization-payment.server";
import { getBitcoinRate } from "~/features/payments/btc.rate";
import { FREE_PLAN_ID } from "~/features/payments/plan-ids";
import type {
  CreateInvoiceParams,
  CreateRenewalPaymentParams,
  InvoiceResponse,
  UserSubscription,
} from "~/features/payments/types";
import { getPlanDisplayName, getUserPlanType } from "~/features/payments/types";
import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { ExternalServiceError } from "~/lib/errors";
import { prisma } from "~/lib/prisma.server";

import {
  getOwnerNwcWithRelayOverrides,
  isLikelyWebsocketRelayError,
} from "./payment-shared.server";
import { updateUserSubscription } from "./payment-subscription.server";
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

export { updateUserSubscription } from "./payment-subscription.server";

const OWNER_NWC_MISSING = "Owner NWC credentials not configured";

/** Minimal free plan data so dashboard can assign new users even if seed wasn't run. */
const FREE_PLAN_SEED = {
  id: FREE_PLAN_ID,
  name: "Free",
  price: 0,
  description: "Perfect for getting started",
  features: {
    basicScheduling: true,
    multipleQueues: false,
    bulkScheduling: false,
    repostsAndQuotes: false,
    engagementFeed: true,
    giveaways: true,
    commissions: "High",
    leaderboards: false,
    advancedAnalytics: false,
    multiAccountSwitching: false,
    wolfFilteringAndVortex: false,
    nativeS3BlossomStorage: false,
    relayBlast: false,
    visualPerks: false,
    lifetimeAccess: false,
  },
  maxPostsPerMonth: 10,
  maxQueueTypes: 1,
  maxTemplates: 3,
  maxLongFormPosts: 2,
  enableBasicScheduling: true,
  enableMultipleQueues: false,
  enableBulkScheduling: false,
  enableRepostsAndQuotes: false,
  enableEngagementFeed: true,
  enableGiveaways: true,
  enableCommissions: false,
  enableLeaderboards: false,
  enableAdvancedAnalytics: false,
  enableMultiAccountSwitching: false,
  enableWolfFilteringAndVortex: false,
  enableNativeS3BlossomStorage: false,
  enableRelayBlast: false,
  enableVisualPerks: false,
  enableLifetimeAccess: false,
};

async function ensureFreePlanExists(): Promise<void> {
  await prisma.plan.upsert({
    where: { id: FREE_PLAN_ID },
    create: { ...FREE_PLAN_SEED, updatedAt: new Date() },
    update: {},
  });
}

async function handleFreePlanInvoice(
  userId: string,
  planId: string,
  description: string | undefined
): Promise<InvoiceResponse> {
  const paymentId = `free_${Date.now()}_${userId}`;
  await prisma.payment.create({
    data: {
      id: paymentId,
      userId,
      amount: 0,
      amountUsd: 0,
      invoice: "free_plan",
      paymentHash: "free_plan",
      status: "COMPLETED",
      description: description ?? `Free plan subscription`,
      paidAt: new Date(),
    },
  });

  await updateUserSubscription(userId, planId, paymentId);

  return {
    invoice: "free_plan",
    paymentHash: "free_plan",
    amount: 0,
    amountUsd: 0,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    paymentId,
  };
}

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

  const credentials = env.OWNER_NWC;
  if (!credentials) {
    throw new Error(OWNER_NWC_MISSING);
  }

  const amountUsd = Number(plan.price);
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
    const request = (await ln.requestPayment(
      USD(amountUsd) as unknown as { amount: number }
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

    const request = (await ln.requestPayment(
      SATS(quote.feeSats) as unknown as { amount: number }
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

    if (error instanceof ExternalServiceError) {
      throw error;
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

/**
 * Creates a renewal payment record
 */
export async function createRenewalPayment({
  paymentId,
  userId,
  amount,
  amountUsd,
  invoice,
  paymentHash,
  description,
}: CreateRenewalPaymentParams) {
  return await prisma.payment.create({
    data: {
      id: paymentId,
      userId,
      amount,
      amountUsd,
      invoice,
      paymentHash,
      status: "COMPLETED",
      description,
      paidAt: new Date(),
    },
  });
}

/**
 * Ensures the user has a free plan subscription (and is enabled).
 */
export async function ensureUserHasFreePlan(userId: string): Promise<void> {
  await ensureFreePlanExists();

  const [user, subscription, freePlan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isEnabled: true },
    }),
    getUserSubscription(userId),
    prisma.plan.findUnique({
      where: { id: FREE_PLAN_ID },
      select: { id: true, price: true },
    }),
  ]);

  if (!user || !freePlan) {
    return;
  }

  const isFreeInactive =
    subscription &&
    subscription.planId === FREE_PLAN_ID &&
    subscription.status !== "ACTIVE";

  if (subscription && !isFreeInactive) {
    return;
  }

  const now = new Date();

  if (isFreeInactive) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { userId },
        data: {
          status: "ACTIVE",
          lastPaymentDate: now,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { isEnabled: true },
      });
    });
    return;
  }

  const subscriptionId = `sub_${userId}_${FREE_PLAN_ID}_${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.create({
      data: {
        id: subscriptionId,
        userId,
        planId: FREE_PLAN_ID,
        status: "ACTIVE",
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        lastPaymentDate: now,
        plan: FREE_PLAN_ID,
        amountSats: BigInt(0),
        amountUsd: freePlan.price,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { isEnabled: true },
    });
  });
}

/**
 * Manually verify and complete a payment if it was received but not detected
 */
export async function manuallyVerifyPayment(paymentId: string): Promise<{
  success: boolean;
  paid: boolean;
  message: string;
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

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const isRecent = payment.createdAt > thirtyMinutesAgo;

  if (!isRecent) {
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

  let planId: string | null = null;
  if (payment.purpose === "GIVEAWAY_FINALIZATION") {
    planId = "__giveaway_finalization__";
  } else if (payment.Subscription?.planId) {
    planId = payment.Subscription.planId;
  } else {
    const parts = paymentId.split("_");
    if (parts.length >= 3) {
      planId = parts[0] ?? null;
    }
  }

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

  const { credentials: ownerNwcCredentials, relays: ownerRelays } =
    getOwnerNwcWithRelayOverrides(ownerNwc);

  const nwcClient = new NWCClient({
    nostrWalletConnectUrl: ownerNwcCredentials,
  });

  try {
    const tx = (await nwcClient.lookupInvoice({
      payment_hash: payment.paymentHash,
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

    await handlePaymentCompleted(paymentId, payment.userId, planId);

    if (preimage) {
      await prisma.payment.update({
        where: { id: paymentId },
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
      paymentId,
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
