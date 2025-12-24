if (process.env.NODE_ENV !== "development") {
  require("websocket-polyfill");
}

import { NWCClient } from "@getalby/sdk";
import { LN, USD } from "@getalby/sdk/lnclient";
import { json } from "@remix-run/node";

import { getBitcoinRate } from "~/features/payments/btc.rate";
import { decrypt } from "~/lib/encryption.server";
import { sendNostrDirectMessage } from "~/lib/nostr.messenger.server";
import {
  createRenewalPayment,
  updateUserSubscription,
} from "~/models/payment.server";
import {
  disableUserAccount,
  getEnabledUsersWithSubscriptions,
} from "~/models/user.server";

/**
 * Cron job to check user subscriptions and handle renewals
 * This should be called periodically (e.g., daily) to:
 * 1. Check subscription expiration
 * 2. Disable accounts with expired subscriptions
 * 3. Attempt automatic renewal for users with NWC enabled
 */
export async function loader() {
  const results = {
    checked: 0,
    expired: 0,
    disabled: 0,
    renewalAttempted: 0,
    renewalSuccess: 0,
    renewalFailed: 0,
    errors: [] as string[],
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
              // Decrypt user's NWC credentials
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

                results.renewalSuccess++;
                continue;
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
              // This matches the extraction logic from payment.server.ts
              const invoiceString =
                typeof invoiceRequest.invoice === "string"
                  ? invoiceRequest.invoice
                  : invoiceRequest.invoice?.paymentRequest || "";
              const paymentHashString =
                typeof invoiceRequest.paymentHash === "string"
                  ? invoiceRequest.paymentHash
                  : invoiceRequest.invoice?.paymentHash || "";

              // Extract amount in sats - try multiple possible locations
              let amountSats = 0;
              if (invoiceRequest.amount) {
                amountSats = invoiceRequest.amount;
              } else if (invoiceRequest.invoice?.satoshi) {
                amountSats = invoiceRequest.invoice.satoshi;
              } else if (invoiceRequest.satoshi) {
                amountSats = invoiceRequest.satoshi;
              } else {
                // Parse the Lightning invoice to get the exact amount
                // Lightning invoices encode the amount in the invoice string
                try {
                  const invoiceStr = invoiceString.toLowerCase();
                  if (invoiceStr.startsWith("lnbc")) {
                    // Extract amount from Lightning invoice - amounts are encoded after 'lnbc'
                    const amountMatch = invoiceStr.match(
                      /lnbc([0-9]+)([munp]?)/,
                    );
                    if (amountMatch) {
                      const baseAmount = parseInt(amountMatch[1]);
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
              // Nip47PayResponse has preimage and fees_paid
              const paymentHash =
                paymentResult.preimage ||
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
              const planName = subscription.Plan?.name || "subscription";
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
            const planName = subscription.Plan?.name || "subscription";
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

    return json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error: unknown) {
    console.error("[CRON] Cron job error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        ...results,
      },
      { status: 500 },
    );
  }
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
