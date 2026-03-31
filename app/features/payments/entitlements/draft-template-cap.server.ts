import { getUserSubscription } from "~/features/payments/data/payment.queries.server";
import {
  draftCapExceededMessage,
  templateCapExceededMessage,
} from "~/features/payments/entitlements/entitlement-messages";
import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import {
  getUserPlanType,
  type UserSubscription,
} from "~/features/payments/types";
import {
  countDraftItemsForUser,
  countTemplatesForUser,
} from "~/features/posts/repositories/entitlement-counts.server";

function rowToUserSubscription(
  row: Awaited<ReturnType<typeof getUserSubscription>>
): UserSubscription | null {
  if (!row?.planId) return null;
  return {
    planId: row.planId,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd ?? undefined,
    Plan: row.Plan
      ? {
          name: row.Plan.name,
          id: row.Plan.id,
          enableLifetimeAccess: row.Plan.enableLifetimeAccess
            ? true
            : undefined,
        }
      : undefined,
  };
}

export async function countDraftItems(userId: string): Promise<number> {
  return countDraftItemsForUser(userId);
}

/** Returns error message when cap would be exceeded, or null if allowed. */
export async function checkDraftCapacity(
  userId: string,
  additionalDrafts: number
): Promise<string | null> {
  if (additionalDrafts <= 0) return null;
  const row = await getUserSubscription(userId);
  const { maxDrafts } = getPlanEntitlements(
    getUserPlanType(rowToUserSubscription(row))
  );
  if (maxDrafts == null) return null;
  const current = await countDraftItems(userId);
  if (current + additionalDrafts > maxDrafts) {
    return draftCapExceededMessage();
  }
  return null;
}

export class DraftCapExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftCapExceededError";
  }
}

export class TemplateCapExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateCapExceededError";
  }
}

export async function checkTemplateCapacity(
  userId: string,
  additionalTemplates: number
): Promise<string | null> {
  if (additionalTemplates <= 0) return null;
  const row = await getUserSubscription(userId);
  const { maxTemplates } = getPlanEntitlements(
    getUserPlanType(rowToUserSubscription(row))
  );
  if (maxTemplates == null) return null;
  const current = await countTemplatesForUser(userId);
  if (current + additionalTemplates > maxTemplates) {
    return templateCapExceededMessage();
  }
  return null;
}
