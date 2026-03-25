/**
 * Subscription action handlers
 */

import { NWCClient } from "@getalby/sdk";
import { json } from "@remix-run/node";

import {
  createPlanInvoice,
  getPlanById,
  getPlanPriceUsd,
  getUserSubscription,
  manuallyVerifyPayment,
  updateUserSubscription,
} from "~/features/payments/data";
import type { InvoiceResponse } from "~/features/payments/types";
import { getDecryptedUserNWC } from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { ExternalServiceError } from "~/lib/errors";
import {
  cancelAtPeriodEndSchema,
  scheduleDowngradeSchema,
  switchToFreePlanSchema,
  topUpSubscriptionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import {
  updateSubscriptionCancelAtPeriodEnd,
  updateSubscriptionCancelAtPeriodEndAndMetadata,
} from "../repositories/subscription-actions-data.server";

const ERROR_NO_ACTIVE_SUBSCRIPTION = "No active subscription found";
const ERROR_SUBSCRIPTION_PLAN_NOT_FOUND = "Subscription plan not found";
const ERROR_PLAN_NOT_FOUND = "Plan not found";

/** Avoid hanging the request (Cloudflare ~100s → 520) if the wallet never completes pay. */
const TOP_UP_NWC_PAY_TIMEOUT_MS = 55_000;

function nwcWalletTopUpTimeoutError(): ExternalServiceError {
  return new ExternalServiceError(
    "Wallet payment timed out. Pay the Lightning invoice below if it appears.",
    504
  );
}

async function payNwcInvoiceWithTimeout(
  nwcClient: NWCClient,
  bolt11Invoice: string
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(nwcWalletTopUpTimeoutError()),
      TOP_UP_NWC_PAY_TIMEOUT_MS
    );
  });
  try {
    await Promise.race([
      nwcClient.payInvoice({ invoice: bolt11Invoice }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * NWC auto-renew path: pay via wallet, then poll verification. Returns a response
 * when the flow finishes with success or early error; `null` means fall through
 * to returning the Lightning invoice payload.
 */
async function tryNwcAutoRenewTopUpResponse(params: {
  userId: string;
  planId: string;
  invoice: InvoiceResponse;
}): Promise<Response | null> {
  const { userId, planId, invoice } = params;
  const decryptedNwc = await getDecryptedUserNWC(userId);
  if (!decryptedNwc) {
    return json(
      {
        error:
          "Connect a wallet with Nostr Wallet Connect to pay this top-up via NWC.",
      },
      { status: 400 }
    );
  }

  const nwcClient = new NWCClient({
    nostrWalletConnectUrl: decryptedNwc,
  });
  let nwcPayCompleted = false;
  try {
    await payNwcInvoiceWithTimeout(nwcClient, invoice.invoice);
    nwcPayCompleted = true;
  } catch (nwcError) {
    logError(
      nwcError instanceof Error ? nwcError : new Error(String(nwcError)),
      {
        userId,
        planId,
        message:
          "Top-up: NWC payInvoice failed or timed out; returning invoice for manual pay",
      }
    );
  } finally {
    try {
      nwcClient.close();
    } catch {
      /* ignore */
    }
  }

  if (!nwcPayCompleted) {
    return null;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 3; i++) {
    const verification = await manuallyVerifyPayment(invoice.paymentId);
    if (verification.success && verification.paid) {
      return json({
        success: true,
        paid: true,
        message: "Top-up completed successfully.",
      });
    }
    await sleep(500);
  }

  return null;
}

function topUpInvoiceJsonPayload(params: {
  invoice: InvoiceResponse;
  cadence: "monthly" | "yearly";
  durationMonths: number;
  billingPaymentMethod: "nwc_auto_renew" | "lightning_one_time";
  defaultPlanName: string;
  defaultPlanId: string;
}) {
  const {
    invoice,
    cadence,
    durationMonths,
    billingPaymentMethod,
    defaultPlanName,
    defaultPlanId,
  } = params;
  const expiresAt =
    invoice.expiresAt instanceof Date
      ? invoice.expiresAt
      : new Date(invoice.expiresAt);
  return {
    success: true as const,
    invoice: invoice.invoice,
    paymentHash: invoice.paymentHash,
    amount: invoice.amount,
    amountUsd: invoice.amountUsd,
    paymentId: invoice.paymentId,
    expiresAt: expiresAt.toISOString(),
    planName: invoice.planName ?? defaultPlanName,
    planId: invoice.planId ?? defaultPlanId,
    billingCadence: cadence,
    accessDurationMonths: durationMonths,
    billingPaymentMethod,
  };
}

async function handleCancelAtPeriodEnd(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, cancelAtPeriodEndSchema);
  if (!result.success) {
    return result.response;
  }

  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return json({ error: ERROR_NO_ACTIVE_SUBSCRIPTION }, { status: 400 });
  }
  if (!subscription.Plan) {
    return json({ error: ERROR_SUBSCRIPTION_PLAN_NOT_FOUND }, { status: 400 });
  }
  if (Number(subscription.Plan.price) === 0) {
    return json(
      { error: "Free plan cannot be canceled at period end" },
      { status: 400 }
    );
  }
  if (subscription.Plan.enableLifetimeAccess) {
    return json(
      { error: "Lifetime plans cannot be canceled at period end" },
      { status: 400 }
    );
  }
  if (subscription.cancelAtPeriodEnd) {
    return json(
      { error: "Subscription is already set to cancel at period end" },
      { status: 400 }
    );
  }

  await updateSubscriptionCancelAtPeriodEnd(userId, true);

  return json({
    success: true,
    message:
      "Your subscription will cancel at the end of the current billing period. You will keep access until then.",
  });
}

async function handleScheduleDowngrade(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, scheduleDowngradeSchema);
  if (!result.success) {
    return result.response;
  }

  const plan = await getPlanById(result.data.planId);
  if (!plan) {
    return json({ error: ERROR_PLAN_NOT_FOUND }, { status: 400 });
  }

  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return json({ error: ERROR_NO_ACTIVE_SUBSCRIPTION }, { status: 400 });
  }
  if (!subscription.Plan) {
    return json({ error: ERROR_SUBSCRIPTION_PLAN_NOT_FOUND }, { status: 400 });
  }
  if (Number(subscription.Plan.price) === 0) {
    return json({ error: "You are already on the free plan" }, { status: 400 });
  }
  if (subscription.Plan.enableLifetimeAccess) {
    return json(
      { error: "Lifetime plans cannot be downgraded" },
      { status: 400 }
    );
  }
  if (subscription.planId === result.data.planId) {
    return json({ error: "You are already on this plan" }, { status: 400 });
  }

  const metadata = (subscription.metadata ?? {}) as Record<string, unknown>;
  if (subscription.cancelAtPeriodEnd && metadata["scheduledPlanId"]) {
    return json({ error: "A downgrade is already scheduled" }, { status: 400 });
  }

  await updateSubscriptionCancelAtPeriodEndAndMetadata(userId, {
    cancelAtPeriodEnd: true,
    metadata: { ...metadata, scheduledPlanId: result.data.planId },
  });

  return json({
    success: true,
    message: `You will be moved to ${plan.name} at the end of your current billing period. You will keep access until ${subscription.currentPeriodEnd?.toLocaleDateString() ?? "period end"}.`,
  });
}

async function handleSwitchToFreePlan(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, switchToFreePlanSchema);
  if (!result.success) {
    return result.response;
  }

  const plan = await getPlanById(result.data.planId);
  if (!plan) {
    return json({ error: ERROR_PLAN_NOT_FOUND }, { status: 400 });
  }
  if (Number(plan.price) > 0) {
    return json(
      { error: "This action is only allowed for free plans" },
      { status: 400 }
    );
  }

  await updateUserSubscription(
    userId,
    result.data.planId,
    `free_${Date.now()}_${userId}`
  );

  return json({
    success: true,
    message: "Successfully switched to free plan",
  });
}

async function handleTopUpSubscription(
  userId: string,
  formData: FormData
): Promise<Response> {
  try {
    const result = validateFormDataOrRespond(formData, topUpSubscriptionSchema);
    if (!result.success) {
      return result.response;
    }

    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      return json({ error: ERROR_NO_ACTIVE_SUBSCRIPTION }, { status: 400 });
    }
    if (!subscription.Plan) {
      return json(
        { error: ERROR_SUBSCRIPTION_PLAN_NOT_FOUND },
        { status: 400 }
      );
    }
    if (subscription.Plan.enableLifetimeAccess) {
      return json(
        { error: "Lifetime plans cannot be topped up" },
        { status: 400 }
      );
    }

    const plan = await getPlanById(result.data.targetPlanId);
    if (!plan) {
      return json({ error: ERROR_PLAN_NOT_FOUND }, { status: 400 });
    }
    if (!plan.isActive) {
      return json({ error: "Plan is not available" }, { status: 400 });
    }

    const cadence = result.data.billingCadence;
    const durationMonths = result.data.accessDurationMonths;
    const billingPaymentMethod = result.data.paymentLane;

    const priceUsd = await getPlanPriceUsd({
      planId: plan.id,
      billingCadence: cadence,
      accessDurationMonths: durationMonths,
      paymentMethod: billingPaymentMethod,
    });

    if (priceUsd == null) {
      return json(
        {
          error: "This top-up option is not available for the selected plan.",
        },
        { status: 400 }
      );
    }

    const invoice = await createPlanInvoice({
      planId: plan.id,
      userId,
      description: `SmartFlow Social - Subscription top-up`,
      amountUsdOverride: priceUsd,
      billingCadence: cadence,
      accessDurationMonths: durationMonths,
      billingPaymentMethod,
    });

    if (invoice.invoice === "free_plan") {
      return json({ error: "Free plan cannot be topped up" }, { status: 400 });
    }

    if (billingPaymentMethod === "nwc_auto_renew") {
      const nwcOutcome = await tryNwcAutoRenewTopUpResponse({
        userId,
        planId: plan.id,
        invoice,
      });
      if (nwcOutcome) {
        return nwcOutcome;
      }
    }

    return json(
      topUpInvoiceJsonPayload({
        invoice,
        cadence,
        durationMonths,
        billingPaymentMethod,
        defaultPlanName: plan.name,
        defaultPlanId: plan.id,
      })
    );
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      message: "Top-up subscription failed",
    });
    if (error instanceof ExternalServiceError) {
      return json({ error: error.message }, { status: error.statusCode });
    }
    return json(
      {
        error:
          "We could not start this top-up. Check that payments are configured, then try again or contact support.",
      },
      { status: 502 }
    );
  }
}

export async function handleSubscriptionAction(
  userId: string,
  action: string,
  formData: FormData
): Promise<Response | null> {
  if (action === "cancel_at_period_end") {
    return handleCancelAtPeriodEnd(userId, formData);
  }
  if (action === "schedule_downgrade") {
    return handleScheduleDowngrade(userId, formData);
  }
  if (action === "switch_to_free_plan") {
    return handleSwitchToFreePlan(userId, formData);
  }
  if (action === "top_up_subscription") {
    return handleTopUpSubscription(userId, formData);
  }
  return null;
}
