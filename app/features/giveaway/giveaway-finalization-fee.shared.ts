/**
 * Pure finalization fee math (client + server). UI: "Finalization fee".
 */

import type { PlanType } from "~/features/payments/types";

/** Free 10%, Basic 5%; Premium, Founder, Pro, Enterprise: 0%. */
export function getFinalizationFeeRateBps(planType: PlanType): number {
  if (planType === "free") {
    return 1000;
  }
  if (planType === "basic") {
    return 500;
  }
  return 0;
}

export function computeFinalizationFeeSats(
  plannedPayoutSats: number,
  feeRateBps: number
): { feeSats: number; waivedByPlan: boolean } {
  if (feeRateBps <= 0) {
    return {
      feeSats: 0,
      waivedByPlan: plannedPayoutSats > 0,
    };
  }
  if (plannedPayoutSats <= 0) {
    return { feeSats: 0, waivedByPlan: false };
  }
  let feeSats = Math.floor((plannedPayoutSats * feeRateBps) / 10000);
  if (feeSats === 0) {
    feeSats = 1;
  }
  return { feeSats, waivedByPlan: false };
}
