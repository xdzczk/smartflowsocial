/**
 * Subscription action handlers
 */

import { json } from "@remix-run/node";

import { prisma } from "~/lib/prisma.server";
import {
  cancelAtPeriodEndSchema,
  scheduleDowngradeSchema,
  switchToFreePlanSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  getPlanById,
  getUserSubscription,
  updateUserSubscription,
} from "~/models/payment.server";

async function handleCancelAtPeriodEnd(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, cancelAtPeriodEndSchema);
  if (!result.success) {
    return result.response;
  }

  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return json({ error: "No active subscription found" }, { status: 400 });
  }
  if (!subscription.Plan) {
    return json({ error: "Subscription plan not found" }, { status: 400 });
  }
  if (Number(subscription.Plan.price) === 0) {
    return json(
      { error: "Free plan cannot be canceled at period end" },
      { status: 400 }
    );
  }
  if (subscription.Plan.enableLifetimeAccess) {
    return json(
      { error: "Lifetime plans cannot be canceled at period end" },
      { status: 400 }
    );
  }
  if (subscription.cancelAtPeriodEnd) {
    return json(
      { error: "Subscription is already set to cancel at period end" },
      { status: 400 }
    );
  }

  await prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true },
  });

  return json({
    success: true,
    message:
      "Your subscription will cancel at the end of the current billing period. You will keep access until then.",
  });
}

async function handleScheduleDowngrade(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, scheduleDowngradeSchema);
  if (!result.success) {
    return result.response;
  }

  const plan = await getPlanById(result.data.planId);
  if (!plan) {
    return json({ error: "Plan not found" }, { status: 400 });
  }

  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return json({ error: "No active subscription found" }, { status: 400 });
  }
  if (!subscription.Plan) {
    return json({ error: "Subscription plan not found" }, { status: 400 });
  }
  if (Number(subscription.Plan.price) === 0) {
    return json({ error: "You are already on the free plan" }, { status: 400 });
  }
  if (subscription.Plan.enableLifetimeAccess) {
    return json(
      { error: "Lifetime plans cannot be downgraded" },
      { status: 400 }
    );
  }
  if (subscription.planId === result.data.planId) {
    return json({ error: "You are already on this plan" }, { status: 400 });
  }

  const metadata = (subscription.metadata ?? {}) as Record<string, unknown>;
  if (subscription.cancelAtPeriodEnd && metadata["scheduledPlanId"]) {
    return json({ error: "A downgrade is already scheduled" }, { status: 400 });
  }

  await prisma.subscription.update({
    where: { userId },
    data: {
      cancelAtPeriodEnd: true,
      metadata: { ...metadata, scheduledPlanId: result.data.planId },
    },
  });

  return json({
    success: true,
    message: `You will be moved to ${plan.name} at the end of your current billing period. You will keep access until ${subscription.currentPeriodEnd?.toLocaleDateString() ?? "period end"}.`,
  });
}

async function handleSwitchToFreePlan(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, switchToFreePlanSchema);
  if (!result.success) {
    return result.response;
  }

  const plan = await getPlanById(result.data.planId);
  if (!plan) {
    return json({ error: "Plan not found" }, { status: 400 });
  }
  if (Number(plan.price) > 0) {
    return json(
      { error: "This action is only allowed for free plans" },
      { status: 400 }
    );
  }

  await updateUserSubscription(
    userId,
    result.data.planId,
    `free_${Date.now()}_${userId}`
  );

  return json({
    success: true,
    message: "Successfully switched to free plan",
  });
}

export async function handleSubscriptionAction(
  userId: string,
  action: string,
  formData: FormData
): Promise<Response | null> {
  if (action === "cancel_at_period_end") {
    return handleCancelAtPeriodEnd(userId, formData);
  }
  if (action === "schedule_downgrade") {
    return handleScheduleDowngrade(userId, formData);
  }
  if (action === "switch_to_free_plan") {
    return handleSwitchToFreePlan(userId, formData);
  }
  return null;
}
