import type { CheckoutPaymentMethodId } from "../checkout/checkout-method-config";
import type { PricingPagePlan } from "../types/plan-loader.types";

export interface UsePlansPageCheckoutAnalyticsOptions {
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
}

/**
 * Server-safe no-op. The real implementation lives in
 * `use-plans-page-checkout-analytics.client.ts`.
 */
export function usePlansPageCheckoutAnalytics(
  _options: UsePlansPageCheckoutAnalyticsOptions
): void {
  // no-op on server
}
