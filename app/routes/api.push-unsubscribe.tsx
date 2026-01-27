import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  deletePushSubscription,
  getUserPushSubscriptions,
} from "~/features/notifications";

/**
 * POST /api/push-unsubscribe - Unsubscribe from push notifications
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);

    const body = (await request.json()) as { endpoint?: string };
    const { endpoint } = body;

    if (!endpoint) {
      return json({ error: "Missing endpoint" }, { status: 400 });
    }

    // Verify the subscription belongs to the user
    const subscriptions = await getUserPushSubscriptions(userId);
    const subscription = subscriptions.find((sub) => sub.endpoint === endpoint);

    if (!subscription) {
      return json({ error: "Subscription not found" }, { status: 404 });
    }

    await deletePushSubscription(endpoint);

    return json({ success: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
