import { getBlossomStorageLimitBytes } from "~/features/payments/blossom-storage-limits";
import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import { mapLegacyPlanIdToCommercialPlanType } from "~/features/payments/plan-mapping";
import { getCanonicalPlanPolicy } from "~/features/payments/plan-policy";
import type { PlanUsageSnapshot } from "~/features/payments/plan-usage.types";
import type { UserSubscription } from "~/features/payments/types";
import {
  getUserPlanType,
  isSubscriptionExpiredForUi,
} from "~/features/payments/types";
import { countFutureScheduledItemsForUser } from "~/features/posts/repositories/entitlement-counts.server";
import { getMediaAggregateForUser } from "~/features/upload";
import {
  getConfirmedChildrenForParent,
  getUserBasicInfo,
} from "~/features/user";
import { countQueueTypesForUser } from "~/features/user/repositories/queue-types-data.server";

function toNumberSize(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Loads usage counts and limits for the sidebar Plan usage widget.
 * Uses the same effective plan tier as execution entitlements (expired paid → free).
 */
export async function loadPlanUsageSnapshot(
  userId: string,
  currentSubscription: UserSubscription | null
): Promise<PlanUsageSnapshot> {
  const effectivePlanType = getUserPlanType(currentSubscription);
  const entitlements = getPlanEntitlements(effectivePlanType);
  const commercial = mapLegacyPlanIdToCommercialPlanType(effectivePlanType);
  const policy = getCanonicalPlanPolicy(commercial);
  const accountsLimit = policy.accountsIncluded;

  const storageLimitBytesRaw = getBlossomStorageLimitBytes(effectivePlanType);
  const storageLimitBytes =
    storageLimitBytesRaw > 0 ? storageLimitBytesRaw : null;

  const [basic, scheduledUsed, queuesUsed, mediaAgg] = await Promise.all([
    getUserBasicInfo(userId),
    countFutureScheduledItemsForUser(userId),
    countQueueTypesForUser(userId),
    storageLimitBytes
      ? getMediaAggregateForUser(userId, { provider: "BLOSSOM_SFS" })
      : Promise.resolve({ _sum: { size: null as number | null } }),
  ]);

  const isChild = basic?.isChild === true;
  let accountsUsed: number | null = null;
  if (!isChild && basic?.npub) {
    const children = await getConfirmedChildrenForParent(basic.npub);
    accountsUsed = 1 + children.length;
  }

  const storageUsedBytes = storageLimitBytes
    ? toNumberSize(mediaAgg._sum.size)
    : null;

  return {
    planDisplayName: policy.publicPlanName,
    effectivePlanType,
    scheduledUsed,
    scheduledLimit: entitlements.maxFutureScheduledItems,
    accountsUsed,
    accountsLimit: isChild ? null : accountsLimit,
    queuesUsed,
    queuesLimit: entitlements.maxQueues,
    storageUsedBytes,
    storageLimitBytes,
    subscriptionExpiredForUi: isSubscriptionExpiredForUi(currentSubscription),
  };
}
