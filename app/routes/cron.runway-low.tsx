/**
 * Cron job to send "runway low" push notifications to users who have opted in.
 * Call periodically (e.g. daily) to notify users whose scheduled queue has few days left.
 */

import { json } from "@remix-run/node";

import { getRunwayLastScheduledAtUtcMs } from "~/features/posts";
import {
  getRunwaySettings,
  getUserIdWithRunwayLowNotificationEnabled,
} from "~/features/user";
import { sendRunwayLowNotification } from "~/infra/notifications/push-notification.server";
import { logError, logInfo } from "~/lib/error-logger.server";

export async function loader() {
  const now = new Date();
  const nowMs = now.getTime();

  const userIds = await getUserIdWithRunwayLowNotificationEnabled();

  let processed = 0;
  let errors = 0;

  for (const userId of userIds) {
    try {
      const runwaySettings = await getRunwaySettings(userId);
      const thenMs = await getRunwayLastScheduledAtUtcMs(
        userId,
        now,
        runwaySettings
      );
      const runwayDays =
        thenMs == null || thenMs <= nowMs
          ? 0
          : Math.ceil((thenMs - nowMs) / (24 * 60 * 60 * 1000));

      await sendRunwayLowNotification(userId, runwayDays);
      // sendRunwayLowNotification may no-op if above threshold or throttled
      processed++;
    } catch (err) {
      errors++;
      logError(err instanceof Error ? err : new Error(String(err)), {
        message: "Cron runway-low: failed for user",
        userId,
      });
    }
  }

  logInfo("Cron runway-low completed", {
    usersChecked: userIds.length,
    processed,
    errors,
  });

  return json(
    { success: true, usersChecked: userIds.length, processed, errors },
    { status: 200 }
  );
}
