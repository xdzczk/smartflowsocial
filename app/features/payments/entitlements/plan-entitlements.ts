import { parseCommercialPlanType } from "~/features/payments/plan-mapping";
import {
  getCanonicalPlanPolicy,
  toExecutionEntitlements,
} from "~/features/payments/plan-policy";

/**
 * Capability and numeric limits derived from plan tier.
 * Surface/browse uses PLAN_FEATURES; scale and paid execution use this.
 */
export interface PlanEntitlements {
  /** Max future scheduled items (posts + longform); null = unlimited */
  maxFutureScheduledItems: number | null;
  /** Max queue types; null = unlimited */
  maxQueues: number | null;
  maxDrafts: number | null;
  maxTemplates: number | null;
  canSendBroadcast: boolean;
  canExecuteBulkActions: boolean;
}

/**
 * Returns limits and capability flags for a plan tier.
 * Free (and legacy teams mapping) match browse-all + strict execution caps.
 */
export function getPlanEntitlements(planType: string): PlanEntitlements {
  const commercialPlanType = parseCommercialPlanType(planType);
  if (!commercialPlanType) {
    throw new Error(`Invalid plan type: ${planType}`);
  }
  const policy = getCanonicalPlanPolicy(commercialPlanType);
  return toExecutionEntitlements(policy);
}
