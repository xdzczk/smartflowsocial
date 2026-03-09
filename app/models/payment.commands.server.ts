/**
 * Payment commands: create invoice, renewal, update subscription, ensure free plan, manual verify.
 */

import { NWCClient } from "@getalby/sdk";
import { LN, USD } from "@getalby/sdk/lnclient";

import { getBitcoinRate } from "~/features/payments/btc.rate";
import type {
  CreateInvoiceParams,
  InvoiceResponse,
  CreateRenewalPaymentParams,
} from "~/features/payments/types";
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

const FREE_PLAN_ID = "free";

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
    throw new Error("Owner NWC credentials not configured");
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
      message: "Owner NWC credentials not configured",
    };
  }

  let planId: string | null = null;
  if (payment.Subscription?.planId) {
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
