/**
 * Plan usage snapshot for dashboard sidebar (loader → client).
 * Numeric limits use null for unlimited / not applicable.
 */
export interface PlanUsageSnapshot {
  /** Display name after expiry/downgrade rules (e.g. Free, Pro). */
  planDisplayName: string;
  /** Plan tier used for limits (getUserPlanType). */
  effectivePlanType: string;
  scheduledUsed: number;
  scheduledLimit: number | null;
  /** Linked identities (self + children); null when row is omitted (child account). */
  accountsUsed: number | null;
  accountsLimit: number | null;
  queuesUsed: number;
  queuesLimit: number | null;
  storageUsedBytes: number | null;
  storageLimitBytes: number | null;
  /** Post-paid lapse: show quiet expired line and Restore plan in Plan usage. */
  subscriptionExpiredForUi: boolean;
}
