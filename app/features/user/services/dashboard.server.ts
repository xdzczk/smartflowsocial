/**
 * Dashboard service layer
 * Handles dashboard loader and action logic
 */

import { json } from "@remix-run/node";

import { updateUserSubscription } from "~/features/payments/data";
import { getUsersByNpubs } from "~/features/user";
import { logWarning } from "~/lib/error-logger.server";

import { respondToChildRequest } from "./parent-child.server";
/**
 * Load dashboard data including pending parent requests
 */
export async function loadDashboardData(
  userId: string,
  userNpub: string,
  pendingParentRequests: string[] = []
) {
  const pendingParentUsers = await getUsersByNpubs(pendingParentRequests);

  return {
    pendingParentUsers,
    childNpub: userNpub,
  };
}

/**
 * Handle dashboard actions (respond to child request)
 */
export async function handleDashboardAction(
  formData: FormData,
  userId: string,
  userNpub: string
) {
  const _action = formData.get("_action") as string;

  if (_action === "respond_child_request") {
    const parentNpub = formData.get("parentNpub") as string;
    const decision = formData.get("decision") as "accept" | "reject";

    const res = await respondToChildRequest(
      userNpub,
      parentNpub,
      decision === "accept"
    );

    if (!res.ok) {
      return json({ error: res.reason }, { status: 400 });
    }

    // Promote child's subscription to creator on accept
    if (decision === "accept") {
      try {
        await updateUserSubscription(
          userId,
          "creator",
          `free_childlink_creator_${Date.now()}_${userId}`
        );
      } catch (e) {
        logWarning("Failed to promote child to creator plan after accept", {
          userId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return json({ success: true });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
