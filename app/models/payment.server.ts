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

import { LN, USD } from "@getalby/sdk/lnclient";

import { getBitcoinRate } from "~/features/payments/btc.rate";
import type {
  CreateInvoiceParams,
  InvoiceResponse,
  CreateRenewalPaymentParams,
} from "~/features/payments/types";
import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

// ============================================================================
// Helper Functions
// ============================================================================

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

function extractInvoiceFromRequest(request: unknown): string {
  const requestRecord =
    request && typeof request === "object" && !Array.isArray(request)
      ? (request as Record<string, unknown>)
      : {};
  const invoiceValue = requestRecord["invoice"];

  if (typeof invoiceValue === "string") {
    return invoiceValue;
  }

  if (
    invoiceValue &&
    typeof invoiceValue === "object" &&
    !Array.isArray(invoiceValue) &&
    "paymentRequest" in invoiceValue &&
    typeof (invoiceValue as { paymentRequest?: unknown }).paymentRequest ===
      "string"
  ) {
    return (invoiceValue as { paymentRequest: string }).paymentRequest;
  }

  return "";
}

function extractPaymentHashFromRequest(request: unknown): string {
  const requestRecord =
    request && typeof request === "object" && !Array.isArray(request)
      ? (request as Record<string, unknown>)
      : {};
  const invoiceValue = requestRecord["invoice"];
  const paymentHashValue = requestRecord["paymentHash"];

  if (typeof paymentHashValue === "string") {
    return paymentHashValue;
  }

  const invoiceObj =
    invoiceValue &&
    typeof invoiceValue === "object" &&
    !Array.isArray(invoiceValue)
      ? (invoiceValue as Record<string, unknown>)
      : null;

  if (invoiceObj && "paymentHash" in invoiceObj) {
    return String(invoiceObj["paymentHash"]);
  }

  return "";
}

// ============================================================================
// Helper Functions
// ============================================================================

function getRequestRecord(request: unknown): Record<string, unknown> {
  return request && typeof request === "object" && !Array.isArray(request)
    ? (request as Record<string, unknown>)
    : {};
}

function getAmountFromDirectProperty(
  requestRecord: Record<string, unknown>
): number | null {
  const amountValue = requestRecord["amount"];
  if (amountValue && typeof amountValue === "number") {
    return amountValue;
  }
  return null;
}

function getAmountFromInvoiceObject(
  requestRecord: Record<string, unknown>
): number | null {
  const invoiceValue = requestRecord["invoice"];
  const invoiceObj =
    invoiceValue &&
    typeof invoiceValue === "object" &&
    !Array.isArray(invoiceValue)
      ? (invoiceValue as Record<string, unknown>)
      : null;

  if (invoiceObj && "satoshi" in invoiceObj) {
    const satoshiValue = Number(invoiceObj["satoshi"]);
    if (!Number.isNaN(satoshiValue)) {
      return satoshiValue;
    }
  }
  return null;
}

function getAmountFromRequestSatoshi(request: unknown): number | null {
  if (
    request &&
    typeof request === "object" &&
    "satoshi" in request &&
    typeof (request as { satoshi?: unknown }).satoshi === "number"
  ) {
    return (request as { satoshi: number }).satoshi;
  }
  return null;
}

function parseLightningInvoiceAmount(invoiceString: string): number | null {
  try {
    const invoiceStr = invoiceString.toLowerCase();
    if (!invoiceStr.startsWith("lnbc")) {
      return null;
    }

    const amountMatch = invoiceStr.match(/lnbc([0-9]+)([munp]?)/);
    if (!amountMatch?.[1]) {
      return null;
    }

    const baseAmount = parseInt(amountMatch[1], 10);
    const unit = amountMatch[2];

    if (unit === "m") {
      return baseAmount * 100000;
    }
    if (unit === "u") {
      return baseAmount * 100;
    }
    if (unit === "n") {
      return Math.round(baseAmount * 0.1);
    }
    if (unit === "p") {
      return Math.round(baseAmount * 0.0001);
    }
    return baseAmount * 100000000;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      invoiceString,
      message: "Error parsing Lightning invoice amount",
    });
    return null;
  }
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

async function extractAmountFromRequest(
  request: unknown,
  invoiceString: string,
  amountUsd: number
): Promise<number> {
  const requestRecord = getRequestRecord(request);

  const directAmount = getAmountFromDirectProperty(requestRecord);
  if (directAmount !== null) {
    return directAmount;
  }

  const invoiceAmount = getAmountFromInvoiceObject(requestRecord);
  if (invoiceAmount !== null) {
    return invoiceAmount;
  }

  const requestSatoshi = getAmountFromRequestSatoshi(request);
  if (requestSatoshi !== null) {
    return requestSatoshi;
  }

  if (typeof invoiceString === "string") {
    const lightningAmount = parseLightningInvoiceAmount(invoiceString);
    if (lightningAmount !== null) {
      return lightningAmount;
    }
  }

  return getFallbackAmount(amountUsd);
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
  const ln = new LN(credentials) as unknown as {
    requestPayment: (amount: {
      amount: number;
    }) => Promise<{
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
      amountUsd
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
    logError(error instanceof Error ? error : new Error(String(error)), {
      planId,
      userId,
      message: "Failed to create invoice",
    });
    throw new Error("Failed to create payment invoice");
  }
}

/**
 * Handles completed payments and updates user subscription
 */
export async function handlePaymentCompleted(
  paymentId: string,
  userId: string,
  planId: string
): Promise<void> {
  try {
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

  // Calculate subscription period
  const currentPeriodStart = now;
  let currentPeriodEnd: Date | null = null;
  let nextPaymentDue: Date | null = null;

  if (!isLifetime) {
    // For non-lifetime plans, set monthly billing
    currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
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

  // If payment is still PENDING and recent, manually mark it as completed
  // This assumes the payment was actually received (user confirms they paid)
  // Note: This is a workaround for cases where onPaid callback didn't fire
  if (payment.status === "PENDING" && payment.userId && planId) {
    try {
      await handlePaymentCompleted(paymentId, payment.userId, planId);
      return {
        success: true,
        paid: true,
        message: "Payment verified and completed",
      };
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        paymentId,
        message: "Failed to manually verify payment",
      });
      return {
        success: false,
        paid: false,
        message: "Failed to verify payment",
      };
    }
  }

  return {
    success: false,
    paid: false,
    message: "Payment cannot be verified",
  };
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
