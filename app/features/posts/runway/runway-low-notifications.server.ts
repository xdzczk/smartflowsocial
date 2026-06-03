/**
 * Core "runway low" notification sweep, decoupled from the HTTP cron route so it
 * can run from the worker's internal scheduler as well as via `/cron/runway-low`.
 *
 * Iterates users who opted into runway-low push notifications, computes each
 * user's remaining runway (in days), and asks the notification service to send
 * (the service no-ops when above threshold or within the 24h throttle).
 */

import {
  getRunwaySettings,
  getUserIdWithRunwayLowNotificationEnabled,
} from "~/features/user";
import { sendRunwayLowNotification } from "~/infra/notifications/push-notification.server";
import { logError } from "~/lib/error-logger.server";

import { getRunwayLastScheduledAtUtcMs } from "./runway.server";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RunwayLowSweepResult {
  usersChecked: number;
  processed: number;
  errors: number;
}

/**
 * Run a single runway-low notification sweep across all opted-in users.
 * Per-user failures are logged and counted but never abort the sweep.
 */
export async function runRunwayLowNotifications(
  now: Date = new Date()
): Promise<RunwayLowSweepResult> {
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
          : Math.ceil((thenMs - nowMs) / DAY_MS);

      // sendRunwayLowNotification may no-op if above threshold or throttled.
      await sendRunwayLowNotification(userId, runwayDays);
      processed++;
    } catch (err) {
      errors++;
      logError(err instanceof Error ? err : new Error(String(err)), {
        message: "Runway-low sweep: failed for user",
        userId,
      });
    }
  }

  return { usersChecked: userIds.length, processed, errors };
}
