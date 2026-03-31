/**
 * Checkout payment method ids and availability rules (UI decision layer).
 */

export type CheckoutPaymentMethodId =
  | "auto_renew"
  | "lightning_one_time"
  | "btc_onchain";

export function defaultCheckoutPaymentMethod(): CheckoutPaymentMethodId {
  return "auto_renew";
}

export function getAvailableCheckoutMethods(params: {
  planId: string;
  billingCadence: "monthly" | "yearly";
  btcpayYearlyOnChainEnabled: boolean;
  /** Lifetime / Founder one-time checkout: no NWC auto-renew. */
  isLifetimePlan?: boolean;
}): CheckoutPaymentMethodId[] {
  if (params.isLifetimePlan || params.planId === "founder") {
    const base: CheckoutPaymentMethodId[] = ["lightning_one_time"];
    if (params.btcpayYearlyOnChainEnabled) {
      base.push("btc_onchain");
    }
    return base;
  }

  const base: CheckoutPaymentMethodId[] = ["auto_renew", "lightning_one_time"];
  if (
    params.billingCadence === "yearly" &&
    params.planId !== "free" &&
    params.btcpayYearlyOnChainEnabled
  ) {
    base.push("btc_onchain");
  }
  return base;
}

export function isRecommendedMethod(method: CheckoutPaymentMethodId): boolean {
  return method === "auto_renew";
}
