/**
 * Checkout / invoice analytics for the public plans page (keeps PlansPage complexity down).
 */
import { useEffect, useRef } from "react";

import { trackCheckoutEvent } from "~/features/payments/checkout/checkout-analytics.client";

import type { CheckoutPaymentMethodId } from "../checkout/checkout-method-config";
import type { PricingPagePlan } from "../types/plan-loader.types";

export function usePlansPageCheckoutAnalytics(options: {
  billingCadence: "monthly" | "yearly";
  checkoutPaymentMethod: CheckoutPaymentMethodId;
  manualDurationMonths: number;
  showCheckout: boolean;
  resetPaymentActionGuard: () => void;
  checkoutPlanIdForAnalytics: string | null;
  subscriptionCheckoutV2Enabled: boolean;
  isFounderCheckout: boolean;
  selectedRecurringPlan: PricingPagePlan | null;
  showInvoice: boolean;
  invoiceData: {
    planId: string;
    checkoutKind: "lightning" | "btcpay";
  } | null;
  paymentComplete: boolean;
  typedActionData: Record<string, unknown> | null;
}): void {
  const {
    billingCadence,
    checkoutPaymentMethod,
    manualDurationMonths,
    showCheckout,
    resetPaymentActionGuard,
    checkoutPlanIdForAnalytics,
    subscriptionCheckoutV2Enabled,
    isFounderCheckout,
    selectedRecurringPlan,
    showInvoice,
    invoiceData,
    paymentComplete,
    typedActionData,
  } = options;

  useEffect(() => {
    if (!showCheckout) return;
    resetPaymentActionGuard();
  }, [
    billingCadence,
    checkoutPaymentMethod,
    manualDurationMonths,
    resetPaymentActionGuard,
    showCheckout,
  ]);

  const prevCheckoutOpen = useRef(false);
  const prevMethod = useRef(checkoutPaymentMethod);
  const prevDuration = useRef(manualDurationMonths);
  useEffect(() => {
    if (
      showCheckout &&
      !prevCheckoutOpen.current &&
      checkoutPlanIdForAnalytics &&
      subscriptionCheckoutV2Enabled
    ) {
      trackCheckoutEvent("checkout_opened", {
        source: "plans_page",
        plan: checkoutPlanIdForAnalytics,
        cadence: isFounderCheckout ? "yearly" : billingCadence,
      });
      prevMethod.current = checkoutPaymentMethod;
      prevDuration.current = manualDurationMonths;
    }
    prevCheckoutOpen.current = showCheckout;
  }, [
    billingCadence,
    checkoutPaymentMethod,
    checkoutPlanIdForAnalytics,
    isFounderCheckout,
    manualDurationMonths,
    showCheckout,
    subscriptionCheckoutV2Enabled,
  ]);

  useEffect(() => {
    if (!showCheckout || !checkoutPlanIdForAnalytics) return;
    if (prevMethod.current !== checkoutPaymentMethod) {
      trackCheckoutEvent("payment_method_selected", {
        source: "plans_page",
        plan: checkoutPlanIdForAnalytics,
        cadence: billingCadence,
        method: checkoutPaymentMethod,
      });
      prevMethod.current = checkoutPaymentMethod;
    }
  }, [
    billingCadence,
    checkoutPaymentMethod,
    checkoutPlanIdForAnalytics,
    showCheckout,
  ]);

  useEffect(() => {
    if (!showCheckout || !selectedRecurringPlan || billingCadence !== "monthly")
      return;
    if (prevDuration.current !== manualDurationMonths) {
      trackCheckoutEvent("access_period_changed", {
        source: "plans_page",
        plan: selectedRecurringPlan.id,
        cadence: billingCadence,
        accessPeriodMonths: manualDurationMonths,
      });
      prevDuration.current = manualDurationMonths;
    }
  }, [
    billingCadence,
    manualDurationMonths,
    selectedRecurringPlan,
    showCheckout,
  ]);

  const prevInvoiceOpen = useRef(false);
  useEffect(() => {
    if (showInvoice && invoiceData && !prevInvoiceOpen.current) {
      trackCheckoutEvent("payment_modal_opened", {
        source: "plans_page",
        plan: invoiceData.planId,
        cadence: billingCadence,
        method:
          invoiceData.checkoutKind === "btcpay"
            ? "btc_onchain"
            : "lightning_one_time",
      });
      if (invoiceData.checkoutKind !== "btcpay") {
        trackCheckoutEvent("lightning_invoice_generated", {
          source: "plans_page",
          plan: invoiceData.planId,
          cadence: billingCadence,
        });
      }
    }
    prevInvoiceOpen.current = Boolean(showInvoice && invoiceData);
  }, [billingCadence, invoiceData, showInvoice]);

  const prevPaid = useRef(false);
  useEffect(() => {
    if (paymentComplete && !prevPaid.current && checkoutPlanIdForAnalytics) {
      trackCheckoutEvent("payment_completed", {
        source: "plans_page",
        plan: checkoutPlanIdForAnalytics,
        cadence: billingCadence,
      });
    }
    prevPaid.current = paymentComplete;
  }, [billingCadence, checkoutPlanIdForAnalytics, paymentComplete]);

  const prevError = useRef<string | undefined>(undefined);
  useEffect(() => {
    const err =
      typedActionData && "error" in typedActionData
        ? typeof typedActionData["error"] === "string"
          ? typedActionData["error"]
          : String(typedActionData["error"])
        : "";
    if (
      typeof err === "string" &&
      err.length > 0 &&
      err !== prevError.current
    ) {
      prevError.current = err;
      trackCheckoutEvent("payment_failed", {
        source: "plans_page",
        plan: checkoutPlanIdForAnalytics ?? undefined,
        cadence: billingCadence,
        error: err,
      });
    } else if (!err) {
      prevError.current = undefined;
    }
  }, [billingCadence, checkoutPlanIdForAnalytics, typedActionData]);
}
