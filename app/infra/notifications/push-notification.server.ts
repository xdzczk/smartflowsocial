/**
 * Push Notification Service
 * Handles sending push notifications to subscribed users
 */

import type { PushSubscription as WebPushSubscription } from "web-push";

import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import { initWebPush } from "./web-push-config.server";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- web-push uses CommonJS
const webpush = require("web-push");

const DEFAULT_ICON = "/icon-192.png";

// Initialize web push on module load
initWebPush();

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    postId?: string;
    publishAttemptId?: string;
    action: "publish_success" | "publish_failure";
    url?: string;
  };
}

export type SendPushResult = { sent: true } | { sent: false; expired: boolean };

/**
 * Send push notification to a single subscription.
 * Returns whether it was sent and, if not, whether the subscription is expired (should be removed).
 */
export async function sendPushNotification(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: NotificationPayload
): Promise<SendPushResult> {
  try {
    const webPushSubscription: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- web-push is a CommonJS module without proper TypeScript types
    await webpush.sendNotification(
      webPushSubscription,
      JSON.stringify(payload),
      {
        TTL: 86400, // 24 hours
        urgency: payload.data?.action === "publish_failure" ? "high" : "normal",
      }
    );

    return { sent: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isExpired =
      errorMessage.includes("410") ||
      errorMessage.includes("Gone") ||
      errorMessage.includes("expired");

    if (isExpired) {
      logError(error instanceof Error ? error : new Error(errorMessage), {
        message: "Push notification failed: subscription expired",
        endpoint: subscription.endpoint,
      });
      return { sent: false, expired: true };
    }

    logError(error instanceof Error ? error : new Error(errorMessage), {
      message: "Push notification failed",
      endpoint: subscription.endpoint,
      action: payload.data?.action,
    });
    return { sent: false, expired: false };
  }
}

/**
 * Send push notification to all subscriptions for a user
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendPushNotification(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        payload
      )
    )
  );

  let sent = 0;
  let failed = 0;
  const expiredSubscriptions: string[] = [];

  results.forEach(
    (result: PromiseSettledResult<SendPushResult>, index: number) => {
      if (result.status === "rejected") {
        failed++;
        return;
      }
      const value = result.value;
      if (value.sent) {
        sent++;
      } else {
        failed++;
        // Only remove subscription if it is actually expired (410 Gone), not on transient failures
        if (value.expired) {
          const sub = subscriptions[index];
          if (sub) {
            expiredSubscriptions.push(sub.id);
          }
        }
      }
    }
  );

  // Clean up expired subscriptions
  if (expiredSubscriptions.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: {
        id: { in: expiredSubscriptions.filter(Boolean) },
      },
    });
  }

  return { sent, failed };
}

/**
 * Send publish success notification
 */
export async function sendPublishSuccessNotification(
  userId: string,
  postId: string,
  publishAttemptId: string
): Promise<void> {
  // Check user preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pushNotificationsEnabled: true,
      pushNotifyPublishSuccess: true,
    },
  });

  if (
    !user ||
    !user.pushNotificationsEnabled ||
    !user.pushNotifyPublishSuccess
  ) {
    return; // User has disabled these notifications
  }

  const payload: NotificationPayload = {
    title: "Post published successfully",
    body: "Your post has been published to Nostr",
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: {
      postId,
      publishAttemptId,
      action: "publish_success",
      url: `/dashboard/posted?postId=${postId}`,
    },
  };

  await sendPushNotificationToUser(userId, payload);
}

/**
 * Send publish failure notification
 */
export async function sendPublishFailureNotification(
  userId: string,
  postId: string,
  publishAttemptId: string,
  errorMessage?: string
): Promise<void> {
  // Check user preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pushNotificationsEnabled: true,
      pushNotifyPublishFailure: true,
    },
  });

  if (
    !user ||
    !user.pushNotificationsEnabled ||
    !user.pushNotifyPublishFailure
  ) {
    return; // User has disabled these notifications
  }

  const payload: NotificationPayload = {
    title: "Post publish failed",
    body:
      errorMessage ?? "Your post failed to publish. Please check and retry.",
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: {
      postId,
      publishAttemptId,
      action: "publish_failure",
      url: `/dashboard/scheduled?postId=${postId}`,
    },
  };

  await sendPushNotificationToUser(userId, payload);
}
