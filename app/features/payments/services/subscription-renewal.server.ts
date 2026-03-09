/**
 * Subscription renewal service layer
 * Handles subscription checking and automatic renewal for cron jobs
 */

import { NWCClient } from "@getalby/sdk";
import { LN, USD } from "@getalby/sdk/lnclient";

import { recordReferralEarningIfAny } from "~/features/referral/record-referral-earning.server";
import {
  disableUserAccount,
  getEnabledUsersWithSubscriptions,
} from "~/features/user";
import { decrypt } from "~/lib/encryption.server";
import { env } from "~/lib/env.server";
import { createErrorResponse } from "~/lib/error-handler.server";
import { logError } from "~/lib/error-logger.server";
import { normalizeError } from "~/lib/errors";
import { sendNostrDirectMessage } from "~/lib/nostr.messenger.server";
import {
  createRenewalPayment,
  getOwnerNwcWithRelayOverrides,
  updateUserSubscription,
} from "~/models/payment.server";

import { getBitcoinRate } from "../btc.rate";
import {
  findPlanById,
  updateSubscriptionCancelAtPeriodEndAndMetadata,
  updateSubscriptionToCanceled,
} from "../repositories/subscription-renewal-data.server";

// ============================================================================
// Helper Functions
// ============================================================================

interface InvoiceDetails {
  invoice: string;
  paymentHash: string;
  amountSats: number;
}

async function handleFreePlanRenewal(
  user: { id: string; npub: string },
  planId: string,
  planName: string
): Promise<void> {
  const paymentId = `free_renewal_${Date.now()}_${user.id}`;
  await createRenewalPayment({
    paymentId,
    userId: user.id,
    amount: 0,
    amountUsd: 0,
    invoice: "free_plan_renewal",
    paymentHash: "free_plan_renewal",
    description: `Free plan renewal`,
  });
  await updateUserSubscription(user.id, planId, paymentId);
  await sendRenewalNotification(
    user.npub,
    true,
    planName,
    "Free plan renewed successfully"
  );
}

function extractInvoiceString(invoiceRequest: unknown): string {
  const requestAny: Record<string, unknown> =
    typeof invoiceRequest === "object" && !Array.isArray(invoiceRequest)
      ? (invoiceRequest as unknown as Record<string, unknown>)
      : {};
  const invoiceValue = requestAny["invoice"];

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

function extractPaymentHash(
  invoiceRequest: unknown,
  invoiceValue: unknown
): string {
  const requestAny: Record<string, unknown> =
    typeof invoiceRequest === "object" && !Array.isArray(invoiceRequest)
      ? (invoiceRequest as unknown as Record<string, unknown>)
      : {};

  if (typeof requestAny["paymentHash"] === "string") {
    return requestAny["paymentHash"];
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

async function extractAmountInSats(
  invoiceRequest: unknown,
  invoiceString: string,
  amountUsd: number
): Promise<number> {
  const parseLnInvoiceAmountToSats = (invoice: string): number | null => {
    if (typeof invoice !== "string") return null;
    const invoiceStr = invoice.toLowerCase();
    if (!invoiceStr.startsWith("lnbc")) return null;

    const amountMatch = invoiceStr.match(/lnbc([0-9]+)([munp]?)/);
    if (!amountMatch) return null;

    const amountPart = amountMatch[1];
    if (!amountPart) return null;

    const baseAmount = parseInt(amountPart, 10);
    if (Number.isNaN(baseAmount)) return null;

    const unit = amountMatch[2];
    // https://github.com/lightning/bolts/blob/master/11-payment-encoding.md
    // lnbc<milli-btc><u|n|p?>
    if (unit === "m") return baseAmount * 100000;
    if (unit === "u") return baseAmount * 100;
    if (unit === "n") return Math.round(baseAmount * 0.1);
    if (unit === "p") return Math.round(baseAmount * 0.0001);
    return baseAmount * 100000000;
  };

  const requestAny: Record<string, unknown> =
    typeof invoiceRequest === "object" && !Array.isArray(invoiceRequest)
      ? (invoiceRequest as unknown as Record<string, unknown>)
      : {};

  // Try direct amount property
  if (requestAny["amount"] && typeof requestAny["amount"] === "number") {
    return requestAny["amount"];
  }

  // Try invoice object
  const invoiceValue = requestAny["invoice"];
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

  // Try requestAny satoshi
  if (requestAny["satoshi"] && typeof requestAny["satoshi"] === "number") {
    return requestAny["satoshi"];
  }

  // Parse from Lightning invoice string
  try {
    const parsed = parseLnInvoiceAmountToSats(invoiceString);
    if (typeof parsed === "number") return parsed;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "[CRON] Error parsing Lightning invoice amount",
      amountUsd,
    });
  }

  // Fallback: use live Bitcoin rate
  try {
    return await getBitcoinRate(amountUsd);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "[CRON] Failed to fetch Bitcoin rate, using fallback",
      amountUsd,
    });
    // Fallback approximation: $1 ≈ 2,500 sats (at $40,000 per BTC)
    return Math.round(amountUsd * 2500);
  }
}

async function createInvoice(
  ownerNwc: string,
  amountUsd: number
): Promise<unknown> {
  const { credentials: ownerNwcCredentials } =
    getOwnerNwcWithRelayOverrides(ownerNwc);
  const ownerLn = new LN(ownerNwcCredentials) as unknown as {
    requestPayment: (amount: { amount: number }) => Promise<unknown>;
  };
  try {
    return await ownerLn.requestPayment(USD(amountUsd) as { amount: number });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "[CRON] Failed to request make_invoice",
      amountUsd,
    });
    throw new Error(
      `Failed to create invoice: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function payInvoice(
  decryptedNwc: string,
  invoiceString: string
): Promise<string> {
  const nwcClient = new NWCClient({
    nostrWalletConnectUrl: decryptedNwc,
  });

  const paymentResult = await nwcClient.payInvoice({
    invoice: invoiceString,
  });

  const paymentResultObj =
    typeof paymentResult === "object" && !Array.isArray(paymentResult)
      ? (paymentResult as Record<string, unknown>)
      : {};
  const preimageValue = paymentResultObj["preimage"];

  return typeof preimageValue === "string"
    ? preimageValue
    : `payment_${Date.now()}`;
}

async function completePaidRenewal(
  user: { id: string; npub: string },
  planId: string,
  planName: string,
  invoiceDetails: InvoiceDetails,
  amountUsd: number
): Promise<void> {
  const paymentId = `renewal_${planId}_${Date.now()}_${user.id}`;
  await createRenewalPayment({
    paymentId,
    userId: user.id,
    amount: invoiceDetails.amountSats,
    amountUsd,
    invoice: invoiceDetails.invoice,
    paymentHash: invoiceDetails.paymentHash,
    description: `${planName} plan renewal`,
  });

  await updateUserSubscription(user.id, planId, paymentId);

  if (invoiceDetails.amountSats > 0) {
    await recordReferralEarningIfAny(
      user.id,
      paymentId,
      invoiceDetails.amountSats
    );
  }

  await sendRenewalNotification(
    user.npub,
    true,
    planName,
    `Your ${planName} subscription has been renewed successfully. Thank you!`
  );
}

interface RenewalResults {
  checked: number;
  expired: number;
  disabled: number;
  renewalAttempted: number;
  renewalSuccess: number;
  renewalFailed: number;
  errors: string[];
}

// ============================================================================
// Subscription Renewal Helper Functions
// ============================================================================

function isSubscriptionExpired(subscription: {
  currentPeriodEnd: Date | null;
}): boolean {
  if (!subscription.currentPeriodEnd) {
    return false;
  }
  const now = new Date();
  return new Date(subscription.currentPeriodEnd) < now;
}

function getPlanName(subscription: { Plan?: { name: string } | null }): string {
  return subscription.Plan?.name ?? "subscription";
}

async function handleRenewalWithNWC(
  user: { id: string; npub: string; encryptedNwc: string | null },
  subscription: {
    planId: string | null;
    plan: string | null;
    currentPeriodEnd: Date | null;
    Plan?: {
      name: string;
      price: string;
      enableLifetimeAccess?: boolean;
    } | null;
  },
  results: RenewalResults
): Promise<void> {
  results.renewalAttempted++;

  try {
    if (!user.encryptedNwc) {
      throw new Error("User NWC credentials not available");
    }
    await attemptRenewal(
      { ...user, encryptedNwc: user.encryptedNwc },
      {
        planId: subscription.planId,
        plan: subscription.plan,
        Plan:
          subscription.Plan &&
          "name" in subscription.Plan &&
          "price" in subscription.Plan
            ? {
                name: String(subscription.Plan.name),
                price: String(subscription.Plan.price),
              }
            : null,
      }
    );
    results.renewalSuccess++;
  } catch (renewalError: unknown) {
    results.renewalFailed++;
    const errorMsg = `Failed to renew subscription for user ${user.id}: ${
      renewalError instanceof Error
        ? renewalError.message
        : String(renewalError)
    }`;
    results.errors.push(errorMsg);
    logError(
      renewalError instanceof Error
        ? renewalError
        : new Error(String(renewalError)),
      {
        message: `[CRON] ${errorMsg}`,
        userId: user.id,
      }
    );

    await disableUserAccount(user.id);
    results.disabled++;

    const planName = getPlanName(subscription);
    await sendRenewalNotification(
      user.npub,
      false,
      planName,
      `Your ${planName} subscription renewal failed. Please update your payment method to continue using the service.`
    );
  }
}

async function handleRenewalWithoutNWC(
  user: { id: string; npub: string },
  subscription: {
    Plan?: { name: string } | null;
  },
  results: RenewalResults
): Promise<void> {
  await disableUserAccount(user.id);
  results.disabled++;

  const planName = getPlanName(subscription);
  await sendRenewalNotification(
    user.npub,
    false,
    planName,
    `Your ${planName} subscription has expired. Please renew to continue using the service.`
  );
}

function getScheduledPlanId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const scheduled = (metadata as Record<string, unknown>)["scheduledPlanId"];
  return typeof scheduled === "string" && scheduled.length > 0
    ? scheduled
    : null;
}

async function processUserSubscription(
  user: {
    id: string;
    npub: string;
    nwcEnabled: boolean;
    encryptedNwc: string | null;
    Subscription: {
      planId: string | null;
      plan: string | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd?: boolean;
      metadata?: unknown;
      Plan?: {
        name: string;
        price: string;
        enableLifetimeAccess?: boolean;
      } | null;
    } | null;
  } & Record<string, unknown>,
  results: RenewalResults
): Promise<void> {
  const subscription = user.Subscription;

  if (!subscription) {
    return;
  }

  if (subscription.Plan?.enableLifetimeAccess) {
    return;
  }

  if (!isSubscriptionExpired(subscription)) {
    return;
  }

  results.expired++;

  if (subscription.cancelAtPeriodEnd) {
    const scheduledPlanId = getScheduledPlanId(subscription.metadata);

    if (scheduledPlanId) {
      const plan = await findPlanById(scheduledPlanId);
      if (plan?.isActive) {
        const paymentId = `downgrade_${Date.now()}_${user.id}`;
        await updateUserSubscription(user.id, scheduledPlanId, paymentId);
        await updateSubscriptionCancelAtPeriodEndAndMetadata(user.id, {
          cancelAtPeriodEnd: false,
          metadata: {},
        });
        return;
      }
    }

    await updateSubscriptionToCanceled(user.id, {
      status: "CANCELED",
      endDate: new Date(),
      cancelAtPeriodEnd: false,
    });
    await disableUserAccount(user.id);
    results.disabled++;
    return;
  }

  if (user.nwcEnabled && user.encryptedNwc) {
    await handleRenewalWithNWC(user, subscription, results);
  } else {
    await handleRenewalWithoutNWC(user, subscription, results);
  }
}

/**
 * Check and renew subscriptions for all users
 */
export async function checkAndRenewSubscriptions(): Promise<
  {
    success: boolean;
    timestamp: string;
  } & RenewalResults
> {
  const results: RenewalResults = {
    checked: 0,
    expired: 0,
    disabled: 0,
    renewalAttempted: 0,
    renewalSuccess: 0,
    renewalFailed: 0,
    errors: [],
  };

  try {
    const users = await getEnabledUsersWithSubscriptions();
    results.checked = users.length;

    for (const user of users) {
      try {
        await processUserSubscription(
          user as Record<string, unknown> & {
            id: string;
            npub: string;
            nwcEnabled: boolean;
            encryptedNwc: string | null;
            Subscription: {
              planId: string | null;
              plan: string | null;
              currentPeriodEnd: Date | null;
              Plan?: {
                name: string;
                price: string;
                enableLifetimeAccess?: boolean;
              } | null;
            } | null;
          },
          results
        );
      } catch (userError: unknown) {
        const errorMsg = `Error processing user ${user.id}: ${
          userError instanceof Error ? userError.message : String(userError)
        }`;
        results.errors.push(errorMsg);
        logError(
          userError instanceof Error ? userError : new Error(String(userError)),
          {
            message: errorMsg,
            userId: user.id,
          }
        );
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    };
  } catch (error: unknown) {
    // Use centralized error handling but preserve results
    const normalizedError = normalizeError(error);
    const [errorResponse] = createErrorResponse(normalizedError);

    return {
      success: false,
      timestamp: new Date().toISOString(),
      ...results,
      errors: [
        ...results.errors,
        typeof errorResponse.error === "string"
          ? errorResponse.error
          : errorResponse.error.message,
      ],
    };
  }
}

/**
 * Attempt to renew a user's subscription
 */
async function attemptRenewal(
  user: { id: string; npub: string; encryptedNwc: string | null },
  subscription: {
    planId: string | null;
    plan: string | null;
    Plan: { name: string; price: string } | null;
  }
): Promise<void> {
  // Decrypt user's NWC credentials
  if (!user.encryptedNwc) {
    throw new Error("User NWC credentials not available");
  }
  const decryptedNwc = decrypt(user.encryptedNwc);

  // Get user's current plan
  const planId = subscription.planId ?? subscription.plan;
  if (!planId) {
    throw new Error("No plan ID found for subscription");
  }

  const plan = subscription.Plan;
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // Handle free plans
  if (Number(plan.price) === 0) {
    await handleFreePlanRenewal(user, planId, plan.name);
    return;
  }

  // Create invoice using owner's NWC (to receive payment)
  const ownerNwc = env.OWNER_NWC;
  if (!ownerNwc) {
    throw new Error("Owner NWC credentials not configured");
  }

  const amountUsd = Number(plan.price);
  const invoiceRequest = await createInvoice(ownerNwc, amountUsd);

  if (!invoiceRequest) {
    throw new Error("Failed to create invoice");
  }

  // Extract invoice details
  const invoiceValue =
    typeof invoiceRequest === "object" &&
    !Array.isArray(invoiceRequest) &&
    "invoice" in invoiceRequest
      ? (invoiceRequest as Record<string, unknown>)["invoice"]
      : null;
  const invoiceString = extractInvoiceString(invoiceRequest);
  const paymentHashString = extractPaymentHash(invoiceRequest, invoiceValue);

  if (!invoiceString || !paymentHashString) {
    logError(new Error("Missing invoiceString or paymentHashString"), {
      message: "[CRON] Failed to extract invoice or paymentHash from request",
      invoiceString,
      paymentHashString,
      requestStructure: Object.keys(
        invoiceRequest as unknown as Record<string, unknown>
      ),
    });
    throw new Error(
      "Invalid response from payment provider - missing invoice or paymentHash"
    );
  }

  // Extract amount in sats
  const amountSats = await extractAmountInSats(
    invoiceRequest,
    invoiceString,
    amountUsd
  );

  // Pay the invoice using user's NWC
  const paymentHash = await payInvoice(decryptedNwc, invoiceString);

  // Complete the renewal process
  await completePaidRenewal(
    user,
    planId,
    plan.name,
    {
      invoice: invoiceString,
      paymentHash: paymentHash || paymentHashString,
      amountSats,
    },
    amountUsd
  );
}

/**
 * Send renewal notification via Nostr DM
 */
async function sendRenewalNotification(
  pubkeyHex: string,
  _success: boolean,
  _planName: string,
  message: string
): Promise<void> {
  try {
    await sendNostrDirectMessage(pubkeyHex, message);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "[CRON] Failed to send renewal notification",
      pubkeyHex,
    });
    // Don't throw - notification failure shouldn't break the cron job
  }
}
