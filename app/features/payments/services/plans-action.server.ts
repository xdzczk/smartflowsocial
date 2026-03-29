/**
 * Plans action handlers
 * Centralized action processing for plans page
 */

import { NWCClient } from "@getalby/sdk";

import { requireUser } from "~/features/auth/session.server";
import { isBtcpayConfigured } from "~/features/payments/btcpay.server";
import {
  checkPaymentStatus,
  createPlanInvoice,
  getPlanPriceUsd,
  manuallyVerifyPayment,
} from "~/features/payments/data";
import { getDecryptedUserNWC, updateUserNWC } from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { trackProductEvent } from "~/lib/product-events.server";
import { plansActionSchema, validateFormDataOrRespond } from "~/lib/validation";

async function handleCheckPaymentIntent(paymentId: string) {
  try {
    trackProductEvent("checkout_payment_status_checked", { paymentId });
    const paymentStatus = await checkPaymentStatus(paymentId);

    if (paymentStatus.paid) {
      return {
        success: true,
        paid: true,
        paidAt: paymentStatus.paidAt,
        message: "Payment completed successfully!",
      };
    }

    return { success: true, paid: false, status: paymentStatus.status };
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    const errorResponse = handleActionError(error);
    const errorData: unknown =
      errorResponse instanceof Response ? await errorResponse.json() : null;
    const errorMessage =
      errorData &&
      typeof errorData === "object" &&
      !Array.isArray(errorData) &&
      "message" in errorData &&
      typeof (errorData as { message?: unknown }).message === "string"
        ? (errorData as { message: string }).message
        : "Failed to check payment status";
    return { success: false, error: errorMessage };
  }
}

function resolveDurationMonths(params: {
  billingCadence: "monthly" | "yearly";
  accessDurationMonths?: number;
}): number {
  if (typeof params.accessDurationMonths === "number")
    return params.accessDurationMonths;
  return params.billingCadence === "yearly" ? 12 : 1;
}

async function createInvoiceForSelection(params: {
  planId: string;
  userId: string;
  billingCadence: "monthly" | "yearly";
  accessDurationMonths: number;
  billingPaymentMethod:
    | "nwc_auto_renew"
    | "lightning_one_time"
    | "btc_btcpay_onchain";
  priceUsd: number;
}) {
  return createPlanInvoice({
    planId: params.planId,
    userId: params.userId,
    description: `SmartFlow Social - Plan subscription`,
    amountUsdOverride: params.priceUsd,
    billingCadence: params.billingCadence,
    accessDurationMonths: params.accessDurationMonths,
    billingPaymentMethod: params.billingPaymentMethod,
  });
}

async function attemptImmediateNwcPayment(params: {
  userId: string;
  planId: string;
  nwcString?: string;
  invoice: { invoice: string; paymentId: string };
}) {
  const nwcString = params.nwcString;

  if (nwcString && nwcString.length > 0) {
    trackProductEvent("nwc_connect_attempted", {
      userId: params.userId,
      planId: params.planId,
    });
    await updateUserNWC(params.userId, nwcString, true);
    trackProductEvent("nwc_connect_succeeded", {
      userId: params.userId,
      planId: params.planId,
    });
  }

  const decryptedNwc = nwcString?.length
    ? nwcString
    : await getDecryptedUserNWC(params.userId);
  if (!decryptedNwc) {
    return {
      ok: false as const,
      error:
        "Connect a wallet with Nostr Wallet Connect to enable automatic renewals.",
      status: 400 as const,
    };
  }

  const nwcClient = new NWCClient({ nostrWalletConnectUrl: decryptedNwc });
  try {
    await nwcClient.payInvoice({ invoice: params.invoice.invoice });
  } finally {
    nwcClient.close();
  }

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  for (let i = 0; i < 3; i++) {
    const verification = await manuallyVerifyPayment(params.invoice.paymentId);
    if (verification.success && verification.paid) {
      return { ok: true as const, paid: true as const };
    }
    await sleep(500);
  }

  return { ok: true as const, paid: false as const };
}

async function handleSelectPlanIntent(
  selectData: Extract<
    (typeof plansActionSchema)["_output"],
    { intent: "select_plan" }
  >,
  request: Request
) {
  const user = await requireUser(request);

  trackProductEvent("checkout_lane_selected", {
    userId: user.id,
    planId: selectData.planId,
    paymentMode: selectData.paymentMode,
  });

  if (selectData.paymentMode === "btc_onchain") {
    if (selectData.planId === "free") {
      return {
        success: false,
        error: "Bitcoin on-chain checkout is not available for the free plan.",
        status: 400,
      };
    }
    if (!isBtcpayConfigured()) {
      return {
        success: false,
        error: "Bitcoin on-chain checkout is not available right now.",
        status: 503,
      };
    }

    const cadence = "yearly" as const;
    const durationMonths = resolveDurationMonths({
      billingCadence: cadence,
      accessDurationMonths:
        typeof selectData.accessDurationMonths === "number"
          ? selectData.accessDurationMonths
          : undefined,
    });
    const billingPaymentMethod = "btc_btcpay_onchain" as const;
    const priceUsd = await getPlanPriceUsd({
      planId: selectData.planId,
      billingCadence: cadence,
      accessDurationMonths: durationMonths,
      paymentMethod: billingPaymentMethod,
    });

    if (priceUsd == null) {
      return {
        success: false,
        error:
          "Bitcoin on-chain price is not configured for this plan (yearly).",
        status: 400,
      };
    }

    const invoice = await createInvoiceForSelection({
      planId: selectData.planId,
      userId: user.id,
      billingCadence: cadence,
      accessDurationMonths: durationMonths,
      billingPaymentMethod,
      priceUsd,
    });

    trackProductEvent("checkout_btcpay_invoice_created", {
      userId: user.id,
      planId: selectData.planId,
      paymentId: invoice.paymentId,
    });

    return {
      success: true,
      paymentMode: selectData.paymentMode,
      invoice: invoice.invoice,
      paymentHash: invoice.paymentHash,
      amount: invoice.amount,
      amountUsd: invoice.amountUsd,
      paymentId: invoice.paymentId,
      expiresAt: invoice.expiresAt.toISOString(),
      planName: invoice.planName,
      planId: invoice.planId,
      checkoutKind: invoice.checkoutKind ?? "btcpay",
    };
  }

  if (selectData.planId === "free") {
    const invoice = await createInvoiceForSelection({
      planId: "free",
      userId: user.id,
      billingCadence: "monthly",
      accessDurationMonths: 1,
      billingPaymentMethod: "lightning_one_time",
      priceUsd: 0,
    });
    if (invoice.invoice === "free_plan") {
      return {
        redirect:
          "/dashboard?planActivated=true&message=" +
          encodeURIComponent("Free plan activated successfully!"),
      };
    }
    return {
      success: false,
      error: "Could not activate the free plan.",
      status: 500,
    };
  }

  const cadence = selectData.billingCadence;
  const durationMonths = resolveDurationMonths({
    billingCadence: cadence,
    accessDurationMonths:
      typeof selectData.accessDurationMonths === "number"
        ? selectData.accessDurationMonths
        : undefined,
  });

  const billingPaymentMethod =
    selectData.paymentMode === "auto_renew"
      ? "nwc_auto_renew"
      : "lightning_one_time";

  const priceUsd = await getPlanPriceUsd({
    planId: selectData.planId,
    billingCadence: cadence,
    accessDurationMonths: durationMonths,
    paymentMethod: billingPaymentMethod,
  });

  if (priceUsd == null) {
    return {
      success: false,
      error: "This billing option is not available for the selected plan.",
      status: 400,
    };
  }

  const invoice = await createInvoiceForSelection({
    planId: selectData.planId,
    userId: user.id,
    billingCadence: cadence,
    accessDurationMonths: durationMonths,
    billingPaymentMethod,
    priceUsd,
  });

  if (selectData.paymentMode === "auto_renew") {
    const immediate = await attemptImmediateNwcPayment({
      userId: user.id,
      planId: selectData.planId,
      nwcString: selectData.nwcString,
      invoice: { invoice: invoice.invoice, paymentId: invoice.paymentId },
    });

    if (!immediate.ok) {
      return {
        success: false,
        error: immediate.error,
        status: immediate.status,
      };
    }

    if (immediate.paid) {
      trackProductEvent("first_payment_succeeded", {
        userId: user.id,
        planId: selectData.planId,
        paymentMode: "auto_renew",
      });
      return {
        success: true,
        paid: true,
        message: "Subscription started with auto-renew enabled.",
      };
    }

    trackProductEvent("first_payment_pending", {
      userId: user.id,
      planId: selectData.planId,
      paymentId: invoice.paymentId,
      paymentMode: "auto_renew",
    });
  }

  return {
    success: true,
    paymentMode: selectData.paymentMode,
    invoice: invoice.invoice,
    paymentHash: invoice.paymentHash,
    amount: invoice.amount,
    amountUsd: invoice.amountUsd,
    paymentId: invoice.paymentId,
    expiresAt: invoice.expiresAt.toISOString(),
    planName: invoice.planName,
    planId: invoice.planId,
    checkoutKind: invoice.checkoutKind ?? "lightning",
  };
}

export async function handlePlansAction(formData: FormData, request: Request) {
  const result = validateFormDataOrRespond(formData, plansActionSchema);
  if (!result.success) {
    return result.response;
  }

  try {
    if (result.data.intent === "check_payment") {
      return await handleCheckPaymentIntent(result.data.paymentId);
    }

    return await handleSelectPlanIntent(result.data, request);
  } catch (error) {
    const userForLog = await (async () => {
      try {
        return await requireUser(request);
      } catch {
        return null;
      }
    })();

    logError(error instanceof Error ? error : new Error(String(error)), {
      userId: userForLog?.id,
      planId:
        result.data.intent === "select_plan" ? result.data.planId : undefined,
      message: "Error creating plan invoice",
    });
    const status =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create payment invoice",
      status,
    };
  }
}
