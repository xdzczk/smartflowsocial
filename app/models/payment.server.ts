if (process.env.NODE_ENV !== "development") {
   
  require("websocket-polyfill");
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
    // For free plan, create a completed payment record immediately
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
        description: description || `Free plan subscription`,
        paidAt: new Date(),
      },
    });

    // Update user subscription for free plan
    await updateUserSubscription(userId, planId, paymentId);

    return {
      invoice: "free_plan",
      paymentHash: "free_plan",
      amount: 0,
      amountUsd: 0,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes (not relevant for free)
      paymentId,
    };
  }

  // Use owner's NWC connection for receiving payments
  const credentials = process.env.OWNER_NWC;
  if (!credentials) {
    throw new Error("Owner NWC credentials not configured");
  }

  const amountUsd = Number(plan.price);
  const ln = new LN(credentials);
  try {
    // Create payment request using Alby SDK - owner receives payment
    const request = await ln.requestPayment(USD(amountUsd));

    // Generate a unique payment ID
    const paymentId = `${planId}_${Date.now()}_${userId}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    // Store payment record in database
    // Extract invoice, paymentHash and amount from the request
    const requestAny: unknown = request;
    const requestRecord = requestAny && typeof requestAny === "object" && !Array.isArray(requestAny) ? requestAny as Record<string, unknown> : {};
    const invoiceValue = requestRecord.invoice;
    const invoiceString =
      typeof invoiceValue === "string"
        ? invoiceValue
        : (invoiceValue && typeof invoiceValue === "object" && !Array.isArray(invoiceValue) && "paymentRequest" in invoiceValue && typeof invoiceValue.paymentRequest === "string"
            ? invoiceValue.paymentRequest
            : "");
    const invoiceObj = invoiceValue && typeof invoiceValue === "object" && !Array.isArray(invoiceValue) ? invoiceValue as Record<string, unknown> : null;
    const paymentHashValue = requestRecord.paymentHash;
    const paymentHashString =
      typeof paymentHashValue === "string"
        ? paymentHashValue
        : (invoiceObj && "paymentHash" in invoiceObj
            ? String(invoiceObj.paymentHash)
            : "");

    // Extract amount in sats - try multiple possible locations
    let amountSats = 0;
    const amountValue = requestRecord.amount;
    if (amountValue && typeof amountValue === "number") {
      amountSats = amountValue;
    } else if (invoiceObj && "satoshi" in invoiceObj) {
      amountSats = Number(invoiceObj.satoshi) || 0;
    } else if (requestAny.satoshi && typeof requestAny.satoshi === "number") {
      amountSats = requestAny.satoshi;
    } else {
      // Parse the Lightning invoice to get the exact amount
      // Lightning invoices encode the amount in the invoice string
      try {
        if (typeof invoiceString !== "string") {
          throw new Error("Invoice string is not a string");
        }
        const invoiceStr = invoiceString.toLowerCase();
        if (invoiceStr.startsWith("lnbc")) {
          // Extract amount from Lightning invoice - amounts are encoded after 'lnbc'
          const amountMatch = invoiceStr.match(/lnbc([0-9]+)([munp]?)/);
          if (amountMatch && amountMatch[1]) {
            const baseAmount = parseInt(amountMatch[1], 10);
            const unit = amountMatch[2];

            // Convert to satoshis based on unit
            if (unit === "m") {
              // milli-bitcoin (0.001 BTC)
              amountSats = baseAmount * 100000; // 1 mBTC = 100,000 sats
            } else if (unit === "u") {
              // micro-bitcoin (0.000001 BTC)
              amountSats = baseAmount * 100; // 1 µBTC = 100 sats
            } else if (unit === "n") {
              // nano-bitcoin (0.000000001 BTC)
              amountSats = Math.round(baseAmount * 0.1); // 1 nBTC = 0.1 sats
            } else if (unit === "p") {
              // pico-bitcoin (0.000000000001 BTC)
              amountSats = Math.round(baseAmount * 0.0001); // 1 pBTC = 0.0001 sats
            } else {
              // No unit means the amount is in BTC
              amountSats = baseAmount * 100000000; // 1 BTC = 100,000,000 sats
            }
          }
        }
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          invoiceString,
          message: "Error parsing Lightning invoice amount",
        });
      }

      // If we still don't have an amount, use live Bitcoin rate as fallback
      if (amountSats === 0) {
        try {
          amountSats = await getBitcoinRate(amountUsd);
        } catch (error) {
          logError(error instanceof Error ? error : new Error(String(error)), {
            amountUsd,
            message: "Failed to fetch Bitcoin rate, using fallback",
          });
          // Fallback approximation: $1 ≈ 2,500 sats (at $40,000 per BTC)
          amountSats = Math.round(amountUsd * 2500);
        }
      }
    }

    if (!invoiceString || !paymentHashString) {
      logError(new Error("Failed to extract invoice or paymentHash from request"), {
        invoiceString,
        paymentHashString,
        requestStructure: Object.keys(request),
      });
      throw new Error(
        "Invalid response from payment provider - missing invoice or paymentHash",
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
        description: description || `${plan.name} plan subscription`,
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
  planId: string,
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
  paymentId: string,
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
    paidAt: payment.paidAt || undefined,
  };
}

/**
 * Gets user's current subscription info
 */
export async function getUserSubscription(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      Plan: true,
    },
  });

  return subscription;
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
  const payments = await prisma.payment.findMany({
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

  return payments;
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
