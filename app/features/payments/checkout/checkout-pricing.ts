import type { CheckoutPaymentMethodId } from "./checkout-method-config";

export interface PlanCheckoutPricing {
  nwcAutoRenewMonthlyUsd: number;
  nwcAutoRenewYearlyUsd: number;
  lightningOneTimeMonthlyUsd: Record<number, number>;
  lightningOneTimeYearlyUsd: number;
  btcOnchainYearlyUsd: number | null;
}

export function computeCheckoutDueUsd(params: {
  method: CheckoutPaymentMethodId;
  billingCadence: "monthly" | "yearly";
  accessDurationMonths: number;
  pricing: PlanCheckoutPricing;
}): number | null {
  const { method, billingCadence, accessDurationMonths, pricing } = params;

  switch (method) {
    case "auto_renew":
      return billingCadence === "yearly"
        ? pricing.nwcAutoRenewYearlyUsd
        : pricing.nwcAutoRenewMonthlyUsd;
    case "lightning_one_time":
      if (billingCadence === "yearly") {
        return pricing.lightningOneTimeYearlyUsd;
      }
      {
        const v = pricing.lightningOneTimeMonthlyUsd[accessDurationMonths];
        return typeof v === "number" ? v : null;
      }
    case "btc_onchain":
      return pricing.btcOnchainYearlyUsd;
    default:
      return null;
  }
}

export function renewalSummaryLine(params: {
  method: CheckoutPaymentMethodId;
  billingCadence: "monthly" | "yearly";
  accessDurationMonths: number;
}): string {
  switch (params.method) {
    case "auto_renew":
      return params.billingCadence === "yearly"
        ? "Renews yearly until you cancel"
        : "Renews monthly until you cancel";
    case "lightning_one_time":
      return "No auto-renew  -  pay again to extend";
    case "btc_onchain":
      return "One year prepaid (no auto-renew)";
    default:
      return "";
  }
}
