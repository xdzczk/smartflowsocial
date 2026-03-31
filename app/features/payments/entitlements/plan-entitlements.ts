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

const FREE_LIKE_LIMITS: PlanEntitlements = {
  maxFutureScheduledItems: 10,
  maxQueues: 1,
  maxDrafts: 5,
  maxTemplates: 5,
  canSendBroadcast: false,
  canExecuteBulkActions: false,
};

const PAID_LIMITS: PlanEntitlements = {
  maxFutureScheduledItems: null,
  maxQueues: null,
  maxDrafts: null,
  maxTemplates: null,
  canSendBroadcast: true,
  canExecuteBulkActions: true,
};

/**
 * Returns limits and capability flags for a plan tier.
 * Free and teams match browse-all + strict execution caps.
 */
export function getPlanEntitlements(planType: string): PlanEntitlements {
  if (planType === "free" || planType === "teams") {
    return FREE_LIKE_LIMITS;
  }
  return PAID_LIMITS;
}
