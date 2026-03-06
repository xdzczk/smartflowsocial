// Polyfill WebSocket for @getalby/sdk in Node.js (production only)
// Using ws package instead of deprecated websocket-polyfill

if (
  process.env.NODE_ENV !== "development" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime polyfill check for Node.js environment
  globalThis.WebSocket === undefined
) {
  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}

import { NWCClient } from "@getalby/sdk";
import { LN, USD } from "@getalby/sdk/lnclient";

import { getBitcoinRate } from "~/features/payments/btc.rate";
import type {
  CreateInvoiceParams,
  InvoiceResponse,
  CreateRenewalPaymentParams,
} from "~/features/payments/types";
import { recordReferralEarningIfAny } from "~/features/referral/record-referral-earning.server";
import { logError } from "~/lib/error-logger.server";
import { ExternalServiceError } from "~/lib/errors";
import { prisma } from "~/lib/prisma.server";

import {
  extractInvoiceFromRequest,
  extractPaymentHashFromRequest,
  extractAmountFromRequest,
} from "./payment-utils.server";

// ============================================================================
// Helper Functions
// ============================================================================

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function isLikelyWebsocketRelayError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to connect to any relay") ||
    m.includes("failed to connect to wss://") ||
    m.includes("network error") ||
    m.includes("received network error") ||
    m.includes("non-101 status code") ||
    m.includes("econnrefused") ||
    m.includes("timeout") ||
    m.includes("nip47networkerror")
  );
}

/**
 * Apply relay overrides to an OWNER_NWC (nostr+walletconnect://...) URL.
 *
 * Supported env vars:
 * - OWNER_NWC_RELAYS: comma-separated list of relay URLs (overrides relays in OWNER_NWC)
 * - OWNER_NWC_RELAY: single relay URL (same as OWNER_NWC_RELAYS with one entry)
 */
export function getOwnerNwcWithRelayOverrides(ownerNwc: string): {
  credentials: string;
  relays: string[];
} {
  const overrideRelays =
    parseCsvEnv(process.env["OWNER_NWC_RELAYS"]).length > 0
      ? parseCsvEnv(process.env["OWNER_NWC_RELAYS"])
      : parseCsvEnv(process.env["OWNER_NWC_RELAY"]);

  if (overrideRelays.length === 0) {
    // Best-effort parse existing relays for logging/debugging
    try {
      const url = new URL(ownerNwc);
      return {
        credentials: ownerNwc,
        relays: url.searchParams.getAll("relay"),
      };
    } catch {
      return { credentials: ownerNwc, relays: [] };
    }
  }

  try {
    const url = new URL(ownerNwc);
    // Remove existing relay params and apply overrides
    url.searchParams.delete("relay");
    for (const relay of overrideRelays) {
      url.searchParams.append("relay", relay);
    }
    return { credentials: url.toString(), relays: overrideRelays };
  } catch {
    // If URL parsing fails (e.g. tests), just return original string
    return { credentials: ownerNwc, relays: overrideRelays };
  }
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
  // Get the plan details from database
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan with ID ${planId} not found`);
  }

  if (!plan.isActive) {
    throw new Error(`Plan ${plan.name} is not currently available`);
  }

  // Skip invoice creation for free plan
  if (Number(plan.price) === 0) {
    return handleFreePlanInvoice(userId, planId, description);
  }

  // Use owner's NWC connection for receiving payments
  const credentials = process.env["OWNER_NWC"];
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
    // Create payment request using Alby SDK - owner receives payment
    const request = (await ln.requestPayment(
      USD(amountUsd) as unknown as { amount: number }
    )) as unknown as {
      onPaid: (callback: () => void) => {
        onTimeout: (seconds: number, callback: () => void) => void;
      };
      onTimeout: (seconds: number, callback: () => void) => void;
    };

    // Generate a unique payment ID
    const paymentId = `${planId}_${Date.now()}_${userId}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    // Extract invoice, paymentHash and amount from the request
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
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive check for request type
            request && typeof request === "object" && !Array.isArray(request)
              ? (request as unknown as Record<string, unknown>)
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
        amount: amountSats, // Amount in sats
        amountUsd,
        invoice: invoiceString,
        paymentHash: paymentHashString,
        status: "PENDING",
        description: description ?? `${plan.name} plan subscription`,
        expiresAt,
      },
    });

    // Set up payment completion handler
    const giveAccess = () => {
      void handlePaymentCompleted(paymentId, userId, planId);
    };

    const showTimeout = () => {
      void handlePaymentTimeout(paymentId);
    };

    request
      .onPaid(giveAccess) // listen for incoming payment and then fire the given method
      .onTimeout(1800, showTimeout); // if they didn't pay within 30 minutes (1800 seconds), mark as expired

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
 * Handles completed payments and updates user subscription.
 * Idempotent: if payment is already COMPLETED, returns without updating.
 */
export async function handlePaymentCompleted(
  paymentId: string,
  userId: string,
  planId: string
): Promise<void> {
  try {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    if (existing?.status === "COMPLETED") {
      return;
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
      },
    });

    // Update user subscription
    await updateUserSubscription(userId, planId, paymentId);

    // Referral: record earning if payer was referred (idempotent)
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { amount: true },
    });
    if (payment?.amount != null && payment.amount > 0) {
      await recordReferralEarningIfAny(userId, paymentId, payment.amount);
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      planId,
      paymentId,
      message: "Error handling completed payment",
    });
    throw error;
  }
}

/**
 * Handles payment timeout
 */
export async function handlePaymentTimeout(paymentId: string): Promise<void> {
  try {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "EXPIRED",
        failedAt: new Date(),
        failureReason: "Payment timeout",
      },
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      paymentId,
      message: "Error handling payment timeout",
    });
  }
}

/**
 * Updates user subscription and account status
 */
export async function updateUserSubscription(
  userId: string,
  planId: string,
  paymentId: string
): Promise<void> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // Get the payment to extract the sats amount (if payment exists)
  let satsAmount = 0;
  let payment = null;

  // For free plans or direct subscription updates, payment might not exist
  if (paymentId && !paymentId.startsWith("free_")) {
    payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { amount: true },
    });
    satsAmount = payment?.amount ?? 0;
  }

  const now = new Date();
  const isLifetime = plan.enableLifetimeAccess;

  // Billing period: 30 days for monthly plans. When Plan has billingIntervalMonths
  // (e.g. for yearly plans), derive period from plan: plan.billingIntervalMonths * 30.
  const BILLING_PERIOD_DAYS = 30;

  // Calculate subscription period
  const currentPeriodStart = now;
  let currentPeriodEnd: Date | null = null;
  let nextPaymentDue: Date | null = null;

  if (!isLifetime) {
    const periodMs = BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    currentPeriodEnd = new Date(now.getTime() + periodMs);
    nextPaymentDue = currentPeriodEnd;
  }

  // Use a transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    // Create or update subscription
    const subscriptionId = `sub_${userId}_${planId}_${Date.now()}`;

    const subscription = await tx.subscription.upsert({
      where: { userId },
      create: {
        id: subscriptionId,
        userId,
        planId,
        status: "ACTIVE",
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDue,
        startDate: now,
        lastPaymentDate: now,
        plan: planId,
        amountSats: BigInt(satsAmount),
        amountUsd: plan.price,
      },
      update: {
        planId,
        status: "ACTIVE",
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDue,
        lastPaymentDate: now,
        plan: planId,
        amountSats: BigInt(satsAmount),
        amountUsd: plan.price,
        cancelAtPeriodEnd: false,
      },
      select: { id: true },
    });

    // Update payment record with the actual subscription ID (if payment exists)
    if (payment && paymentId && !paymentId.startsWith("free_")) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          subscriptionId: subscription.id,
        },
      });
    }

    // Enable user account
    await tx.user.update({
      where: { id: userId },
      data: {
        isEnabled: true,
      },
    });
  });
}

/**
 * Manually verify and complete a payment if it was received but not detected
 * This is useful when onPaid callback didn't fire (e.g., self-payments)
 * Only verifies payments created within the last hour to avoid completing old/stale payments
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

  // Only verify payments created within the last 30 minutes (invoice expiration time)
  // This prevents accidentally completing old/stale payments
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  // createdAt is always defined in Payment model (has @default(now()))
  const isRecent = payment.createdAt > thirtyMinutesAgo;

  if (!isRecent) {
    return {
      success: false,
      paid: false,
      message: "Payment is too old to auto-verify. Please contact support.",
    };
  }

  const ownerNwc = process.env["OWNER_NWC"];
  if (!ownerNwc) {
    return {
      success: false,
      paid: false,
      message: "Owner NWC credentials not configured",
    };
  }

  // Get planId from subscription or extract from paymentId
  // PaymentId format is: `${planId}_${Date.now()}_${userId}`
  let planId: string | null = null;
  if (payment.Subscription?.planId) {
    planId = payment.Subscription.planId;
  } else {
    // Extract planId from paymentId (format: `${planId}_${timestamp}_${userId}`)
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

  // Verify against owner's wallet (NIP-47 lookup_invoice) using the stored payment_hash.
  // This makes payment detection resilient even if websocket notifications drop.
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

    // Best-effort store preimage (optional)
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

/**
 * Returns the userId that owns the payment, or null if not found.
 * Used by API routes to enforce ownership without importing prisma.
 */
export async function getPaymentUserId(
  paymentId: string
): Promise<string | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { userId: true },
  });
  return payment?.userId ?? null;
}

/**
 * Checks the status of a payment
 */
export async function checkPaymentStatus(paymentId: string): Promise<{
  status: string;
  paid: boolean;
  paidAt?: Date;
}> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      status: true,
      paidAt: true,
    },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  return {
    status: payment.status,
    paid: payment.status === "COMPLETED",
    paidAt: payment.paidAt ?? undefined,
  };
}

/**
 * Gets user's current subscription info
 */
export async function getUserSubscription(userId: string) {
  return await prisma.subscription.findUnique({
    where: { userId },
    include: {
      Plan: true,
    },
  });
}

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

/** Ensures the free plan exists in DB (idempotent). Call before assigning free subscription. */
async function ensureFreePlanExists(): Promise<void> {
  await prisma.plan.upsert({
    where: { id: FREE_PLAN_ID },
    create: { ...FREE_PLAN_SEED, updatedAt: new Date() },
    update: {},
  });
}

/**
 * Ensures the user has a free plan subscription (and is enabled).
 * - No subscription: create free + enable user.
 * - Existing free subscription but INACTIVE: set status ACTIVE + enable user.
 * Used so new and existing users can land on dashboard first; plans CTA is shown there for upgrades.
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
 * Gets all plans from database
 */
export async function getAllPlans() {
  return await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });
}

/**
 * Gets user's payment history
 */
export async function getUserPaymentHistory(userId: string) {
  return await prisma.payment.findMany({
    where: {
      userId,
      status: "COMPLETED",
    },
    orderBy: { paidAt: "desc" },
    take: 20, // Limit to last 20 payments
    select: {
      id: true,
      amount: true,
      amountUsd: true,
      description: true,
      paidAt: true,
      paymentMethod: true,
      paymentHash: true,
      Subscription: {
        select: {
          Plan: {
            select: {
              name: true,
              price: true,
            },
          },
        },
      },
    },
  });
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
 * Gets a plan by its ID
 */
export async function getPlanById(planId: string) {
  return prisma.plan.findUnique({
    where: { id: planId },
  });
}
