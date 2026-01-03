/**
 * Subscription action handlers
 */

import { json } from "@remix-run/node";

import {
  switchToFreePlanSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { getPlanById, updateUserSubscription } from "~/models/payment.server";

export async function handleSubscriptionAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "switch_to_free_plan") {
    const result = validateFormDataOrRespond(formData, switchToFreePlanSchema);
    if (!result.success) {
      return result.response;
    }

    // Get the plan to verify it's free
    const plan = await getPlanById(result.data.planId);

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
      result.data.planId,
      `free_${Date.now()}_${userId}`,
    );

    return json({
      success: true,
      message: "Successfully switched to free plan",
    });
  }

  return null;
}

