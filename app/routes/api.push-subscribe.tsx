import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { upsertPushSubscription } from "~/features/notifications";
import { getVapidPublicKey } from "~/infra/notifications/web-push-config.server";

/**
 * GET /api/push-subscribe - Get VAPID public key
 */
export async function loader() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return json(
      { error: "Push notifications not configured" },
      { status: 503 }
    );
  }
  return json({ publicKey });
}

/**
 * POST /api/push-subscribe - Subscribe to push notifications
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);

    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys.auth) {
      return json(
        { error: "Missing required fields: endpoint, keys.p256dh, keys.auth" },
        { status: 400 }
      );
    }

    await upsertPushSubscription({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });

    return json({ success: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
