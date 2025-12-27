/**
 * Subscription renewal service layer
 * Handles subscription checking and automatic renewal for cron jobs
 */

import { NWCClient } from "@getalby/sdk";
import { LN, USD } from "@getalby/sdk/lnclient";

import { getBitcoinRate } from "~/features/payments/btc.rate";
import { decrypt } from "~/lib/encryption.server";
import { createErrorResponse } from "~/lib/error-handler.server";
import { normalizeError } from "~/lib/errors";
import { sendNostrDirectMessage } from "~/lib/nostr.messenger.server";
import {
  createRenewalPayment,
  updateUserSubscription,
} from "~/models/payment.server";
import {
  disableUserAccount,
  getEnabledUsersWithSubscriptions,
} from "~/models/user.server";

interface RenewalResults {
  checked: number;
  expired: number;
  disabled: number;
  renewalAttempted: number;
  renewalSuccess: number;
  renewalFailed: number;
  errors: string[];
}

/**
 * Check and renew subscriptions for all users
 */
export function checkAndRenewSubscriptions(): Promise<{
  success: boolean;
  timestamp: string;
} & RenewalResults> {
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
    // Get all enabled users with their subscriptions
    const users = await getEnabledUsersWithSubscriptions();

    results.checked = users.length;

    for (const user of users) {
      try {
        const subscription = user.Subscription;

        // Skip if user has no subscription
        if (!subscription) {
          continue;
        }

        // Skip lifetime plans
        if (subscription.Plan?.enableLifetimeAccess) {
          continue;
        }

        const now = new Date();
        const isExpired =
          subscription.currentPeriodEnd &&
          new Date(subscription.currentPeriodEnd) < now;

        if (isExpired) {
          results.expired++;

          // If user has NWC enabled, attempt automatic renewal
          if (user.nwcEnabled && user.encryptedNwc) {
            results.renewalAttempted++;

            try {
              if (!user.encryptedNwc) {
                throw new Error("User NWC credentials not available");
              }
              await attemptRenewal({ ...user, encryptedNwc: user.encryptedNwc }, {
                planId: subscription.planId,
                plan: subscription.plan,
                Plan: subscription.Plan ? {
                  name: subscription.Plan.name,
                  price: String(subscription.Plan.price),
                } : null,
              });
              results.renewalSuccess++;
            } catch (renewalError: unknown) {
              results.renewalFailed++;
              const errorMsg = `Failed to renew subscription for user ${user.id}: ${renewalError instanceof Error
                ? renewalError.message
                : String(renewalError)
                }`;
              results.errors.push(errorMsg);
              console.error(`[CRON] ${errorMsg}`, renewalError);

              // Disable account due to failed renewal
              await disableUserAccount(user.id);
              results.disabled++;

              // Send failure notification
              const planName = subscription.Plan?.name ?? "subscription";
              await sendRenewalNotification(
                user.npub,
                false,
                planName,
                `Your ${planName} subscription renewal failed. Please update your payment method to continue using the service.`,
              );
            }
          } else {
            // No NWC enabled, disable account
            await disableUserAccount(user.id);
            results.disabled++;

            // Send notification about expiration
            const planName = subscription.Plan?.name ?? "subscription";
            await sendRenewalNotification(
              user.npub,
              false,
              planName,
              `Your ${planName} subscription has expired. Please renew to continue using the service.`,
            );
          }
        }
      } catch (userError: unknown) {
        const errorMsg = `Error processing user ${user.id}: ${userError instanceof Error ? userError.message : String(userError)
          }`;
        results.errors.push(errorMsg);
        console.error(errorMsg, userError);
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
      errors: [...results.errors, typeof errorResponse.error === "string" ? errorResponse.error : errorResponse.error.message || String(errorResponse.error)],
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
  },
): Promise<void> {
  // Decrypt user's NWC credentials
  if (!user.encryptedNwc) {
    throw new Error("User NWC credentials not available");
  }
  const decryptedNwc = decrypt(user.encryptedNwc);

  // Get user's current plan
  const planId = subscription.planId || subscription.plan;
  if (!planId) {
    throw new Error("No plan ID found for subscription");
  }

  const plan = subscription.Plan;
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // Skip free plans
  if (Number(plan.price) === 0) {
    // Renew free plan automatically
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

    // Send success message
    await sendRenewalNotification(
      user.npub,
      true,
      plan.name,
      "Free plan renewed successfully",
    );

    return;
  }

  // Create invoice using owner's NWC (to receive payment)
  const ownerNwc = process.env.OWNER_NWC;
  if (!ownerNwc) {
    throw new Error("Owner NWC credentials not configured");
  }

  const amountUsd = Number(plan.price);

  const ownerLn = new LN(ownerNwc);
  let invoiceRequest;
  try {
    // Create payment request using Alby SDK - owner receives payment
    invoiceRequest = await ownerLn.requestPayment(USD(amountUsd));
  } catch (error) {
    console.error("[CRON] Failed to request make_invoice", error);
    throw new Error(
      `Failed to create invoice: ${error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  // Extract invoice, paymentHash and amount from the request object structure
  // Cast to unknown then to Record to access properties that may exist on ReceiveInvoice
  const requestAny: Record<string, unknown> = invoiceRequest && typeof invoiceRequest === "object" && !Array.isArray(invoiceRequest) ? invoiceRequest as Record<string, unknown> : {};
  const invoiceValue = requestAny.invoice;
  const invoiceString =
    typeof invoiceValue === "string"
      ? invoiceValue
      : (invoiceValue && typeof invoiceValue === "object" && !Array.isArray(invoiceValue) && "paymentRequest" in invoiceValue && typeof invoiceValue.paymentRequest === "string"
          ? invoiceValue.paymentRequest
          : "");
  const invoiceObj = invoiceValue && typeof invoiceValue === "object" && !Array.isArray(invoiceValue) ? invoiceValue as Record<string, unknown> : null;
  const paymentHashString =
    typeof requestAny.paymentHash === "string"
      ? requestAny.paymentHash
      : (invoiceObj && "paymentHash" in invoiceObj
          ? String(invoiceObj.paymentHash)
          : "");

  // Extract amount in sats - try multiple possible locations
  let amountSats = 0;
  if (requestAny.amount && typeof requestAny.amount === "number") {
    amountSats = requestAny.amount;
  } else if (invoiceObj && "satoshi" in invoiceObj) {
    amountSats = Number(invoiceObj.satoshi) || 0;
  } else if (requestAny.satoshi && typeof requestAny.satoshi === "number") {
    amountSats = requestAny.satoshi;
  } else {
    // Parse the Lightning invoice to get the exact amount
    try {
      if (typeof invoiceString !== "string") {
        throw new Error("Invoice string is not a string");
      }
      const invoiceStr = invoiceString.toLowerCase();
      if (invoiceStr.startsWith("lnbc")) {
        // Extract amount from Lightning invoice - amounts are encoded after 'lnbc'
        const amountMatch = invoiceStr.match(
          /lnbc([0-9]+)([munp]?)/,
        );
        if (amountMatch && amountMatch[1]) {
          const baseAmount = parseInt(amountMatch[1], 10);
          const unit = amountMatch[2];

          // Convert to satoshis based on unit
          if (unit === "m") {
            amountSats = baseAmount * 100000; // 1 mBTC = 100,000 sats
          } else if (unit === "u") {
            amountSats = baseAmount * 100; // 1 µBTC = 100 sats
          } else if (unit === "n") {
            amountSats = Math.round(baseAmount * 0.1); // 1 nBTC = 0.1 sats
          } else if (unit === "p") {
            amountSats = Math.round(baseAmount * 0.0001); // 1 pBTC = 0.0001 sats
          } else {
            amountSats = baseAmount * 100000000; // 1 BTC = 100,000,000 sats
          }
        }
      }
    } catch (error) {
      console.error(
        "[CRON] Error parsing Lightning invoice amount:",
        error,
      );
    }

    // If we still don't have an amount, use live Bitcoin rate as fallback
    if (amountSats === 0) {
      try {
        amountSats = await getBitcoinRate(amountUsd);
      } catch (error) {
        console.error(
          "[CRON] Failed to fetch Bitcoin rate, using fallback:",
          error,
        );
        // Fallback approximation: $1 ≈ 2,500 sats (at $40,000 per BTC)
        amountSats = Math.round(amountUsd * 2500);
      }
    }
  }

  if (!invoiceString || !paymentHashString) {
    console.error(
      "[CRON] Failed to extract invoice or paymentHash from request:",
      {
        invoiceString,
        paymentHashString,
        requestStructure: Object.keys(invoiceRequest),
      },
    );
    throw new Error(
      "Invalid response from payment provider - missing invoice or paymentHash",
    );
  }

  // Use user's NWC to pay the invoice
  const nwcClient = new NWCClient({
    nostrWalletConnectUrl: decryptedNwc,
  });

  // Pay the invoice using user's NWC
  const paymentResult = await nwcClient.payInvoice({
    invoice: invoiceString,
  });

  // Extract payment hash from result
  const paymentResultObj = paymentResult && typeof paymentResult === "object" && !Array.isArray(paymentResult) ? paymentResult as Record<string, unknown> : {};
  const preimageValue = paymentResultObj.preimage;
  const paymentHash =
    (typeof preimageValue === "string" ? preimageValue : null) ||
    paymentHashString ||
    `payment_${Date.now()}`;

  // Create payment record
  const paymentId = `renewal_${planId}_${Date.now()}_${user.id}`;
  await createRenewalPayment({
    paymentId,
    userId: user.id,
    amount: amountSats,
    amountUsd,
    invoice: invoiceString,
    paymentHash: paymentHash,
    description: `${plan.name} plan renewal`,
  });

  // Update subscription
  await updateUserSubscription(user.id, planId, paymentId);

  // Send success notification
  await sendRenewalNotification(
    user.npub,
    true,
    plan.name,
    `Your ${plan.name} subscription has been renewed successfully. Thank you!`,
  );
}

/**
 * Send renewal notification via Nostr DM
 */
async function sendRenewalNotification(
  pubkeyHex: string,
  _success: boolean,
  _planName: string,
  message: string,
): Promise<void> {
  try {
    await sendNostrDirectMessage(pubkeyHex, message);
  } catch (error) {
    console.error(`[CRON] Failed to send notification to ${pubkeyHex}:`, error);
    // Don't throw - notification failure shouldn't break the cron job
  }
}

