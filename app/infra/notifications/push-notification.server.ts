/**
 * Push Notification Service
 * Handles sending push notifications to subscribed users
 */

import type { PushSubscription as WebPushSubscription } from "web-push";

import { getRunwaySettings } from "~/features/user/services/user-settings.server";
import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import { initWebPush } from "./web-push-config.server";

const RUNWAY_LOW_THROTTLE_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  image?: string;
  data?: {
    postId?: string;
    publishAttemptId?: string;
    runwayDays?: number;
    action: "publish_success" | "publish_failure" | "runway_low";
    url?: string;
  };
}

/** Parse nostrProfile JSON and return picture URL and display name (display_name || name || truncated npub). */
function parseNostrProfileForNotification(
  nostrProfile: unknown,
  npub: string
): { picture?: string; displayName: string } {
  let p: { picture?: string; display_name?: string; name?: string } | null =
    null;
  try {
    if (typeof nostrProfile === "string") {
      const parsed: unknown = JSON.parse(nostrProfile);
      p =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as {
              picture?: string;
              display_name?: string;
              name?: string;
            })
          : null;
    } else if (
      nostrProfile &&
      typeof nostrProfile === "object" &&
      !Array.isArray(nostrProfile)
    ) {
      p = nostrProfile as {
        picture?: string;
        display_name?: string;
        name?: string;
      };
    }
  } catch {
    // ignore
  }
  const fromDisplay =
    p && typeof p.display_name === "string"
      ? p.display_name.trim() || null
      : null;
  const fromName =
    p && typeof p.name === "string" ? p.name.trim() || null : null;
  const displayName =
    fromDisplay ??
    fromName ??
    (npub.length > 16 ? `${npub.slice(0, 12)}…` : npub);
  const picture =
    p &&
    typeof p.picture === "string" &&
    p.picture.trim().toLowerCase().startsWith("https://")
      ? p.picture.trim()
      : undefined;
  return { picture, displayName };
}

/**
 * Return a same-origin URL for the given picture so iOS can display it in push
 * notifications. If APP_URL is set, returns /api/notification-asset?url=...
 * otherwise returns the raw picture URL.
 */
function notificationAssetUrl(picture: string): string {
  const base = env.APP_URL;
  if (!base || !picture.startsWith("https://")) {
    return picture;
  }
  try {
    const origin = new URL(base).origin;
    return `${origin}/api/notification-asset?url=${encodeURIComponent(picture)}`;
  } catch {
    return picture;
  }
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
  // Check user preferences and load profile for account name + pfp
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pushNotificationsEnabled: true,
      pushNotifyPublishSuccess: true,
      nostrProfile: true,
      npub: true,
    },
  });

  if (
    !user ||
    !user.pushNotificationsEnabled ||
    !user.pushNotifyPublishSuccess
  ) {
    return; // User has disabled these notifications
  }

  const { picture, displayName } = parseNostrProfileForNotification(
    user.nostrProfile,
    user.npub
  );
  const icon = picture ? notificationAssetUrl(picture) : DEFAULT_ICON;
  const badge = picture ? notificationAssetUrl(picture) : DEFAULT_ICON;

  const payload: NotificationPayload = {
    title: `Post published as ${displayName}`,
    body: "Your post has been published to Nostr",
    icon,
    badge,
    ...(picture && { image: notificationAssetUrl(picture) }),
    data: {
      postId,
      publishAttemptId,
      action: "publish_success",
      url: `/dashboard/published?postId=${postId}`,
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

/**
 * Send runway low notification when scheduled queue has few days left.
 * Respects user preference, threshold (runwayNotifyBelowDays or runway red threshold), and 24h throttle.
 */
export async function sendRunwayLowNotification(
  userId: string,
  runwayDays: number
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pushNotificationsEnabled: true,
      pushNotifyRunwayLow: true,
      runwayNotifyBelowDays: true,
      lastRunwayLowNotificationAt: true,
    },
  });

  if (!user || !user.pushNotificationsEnabled || !user.pushNotifyRunwayLow) {
    return;
  }

  const runwaySettings = await getRunwaySettings(userId);
  const threshold =
    user.runwayNotifyBelowDays ?? runwaySettings.redThresholdDays ?? 3;

  if (runwayDays > threshold) {
    return;
  }

  const now = Date.now();
  const lastAt = user.lastRunwayLowNotificationAt?.getTime();
  if (lastAt != null && now - lastAt < RUNWAY_LOW_THROTTLE_MS) {
    return;
  }

  const payload: NotificationPayload = {
    title: "Queue runway low",
    body: `Your scheduled queue has ${runwayDays} day${runwayDays !== 1 ? "s" : ""} left. Add more posts to keep the flow.`,
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: {
      action: "runway_low",
      url: "/dashboard",
      runwayDays,
    },
  };

  await sendPushNotificationToUser(userId, payload);

  await prisma.user.update({
    where: { id: userId },
    data: { lastRunwayLowNotificationAt: new Date() },
  });
}
