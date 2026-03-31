import type { PlanCheckoutPricing } from "~/features/payments/checkout/checkout-pricing";

/**
 * Normalized plan row for pricing UI + checkout (from plans loader).
 */
export interface LoaderPlanCheckoutPricing extends PlanCheckoutPricing {}

export interface PricingPagePlan {
  id: string;
  name: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  /** Shown under yearly price for Creator/Pro when yearly < 12× monthly. */
  yearlySavingsNote: string | null;
  checkoutPricing: LoaderPlanCheckoutPricing;
  description: string;
  features: Record<string, boolean | string>;
  isPopular: boolean;
  planBillingModel: "free" | "recurring" | "lifetime" | "disabled";
  purchasable: boolean;
  isComingSoon: boolean;
  /** When true, card uses subdued “coming soon” styling and no checkout. */
  isTeamsPlaceholder: boolean;
  /** Bullet list for pricing cards */
  callouts: string[];
}

export interface FounderOfferingPayload {
  id: string;
  name: string;
  description: string;
  oneTimePriceUsd: number;
  seatCap: number;
  seatsClaimed: number;
  seatsRemaining: number;
  /** User can start checkout (seats left and plan purchasable). */
  canPurchase: boolean;
  benefits: string[];
  features: Record<string, boolean | string>;
  checkoutPricing: LoaderPlanCheckoutPricing;
}

export function yearlySavingsLabel(
  monthlyUsd: number,
  yearlyUsd: number
): string | null {
  if (monthlyUsd <= 0 || yearlyUsd <= 0) return null;
  const fullYear = monthlyUsd * 12;
  if (yearlyUsd >= fullYear - 0.01) return null;
  const pct = Math.round((1 - yearlyUsd / fullYear) * 100);
  const monthsFree = Math.round((fullYear - yearlyUsd) / monthlyUsd);
  if (monthsFree >= 2 && monthsFree <= 12) {
    return `${monthsFree} months free`;
  }
  if (pct > 0) {
    return null;
  }
  return null;
}
