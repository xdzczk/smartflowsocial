/**
 * Subscription action handlers
 */

import { json } from "@remix-run/node";

import { getPlanById, updateUserSubscription } from "~/models/payment.server";
export async function handleSubscriptionAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "switch_to_free_plan") {
    const planId = formData.get("planId") as string;

    if (!planId) {
      return json({ error: "Plan ID is required" }, { status: 400 });
    }

    // Get the plan to verify it's free
    const plan = await getPlanById(planId);

    if (!plan) {
      return json({ error: "Plan not found" }, { status: 400 });
    }

    if (Number(plan.price) > 0) {
      return json(
        { error: "This action is only allowed for free plans" },
        { status: 400 },
      );
    }

    // Update user subscription to free plan immediately
    await updateUserSubscription(
      userId,
      planId,
      `free_${Date.now()}_${userId}`,
    );

    return json({
      success: true,
      message: "Successfully switched to free plan",
    });
  }

  return null;
}

