/**
 * General settings action handlers
 */

import { json } from "@remix-run/node";

import {
  updateGiveawayBlacklist,
  updateScheduleInterval,
  updateUserPushNotificationPreferences,
  updateUserRelays,
  updateUserTimezone,
  updateUserTimeFormat,
} from "~/features/user";
import {
  updateTimezoneSchema,
  updateRelaysSchema,
  updateBlacklistSchema,
  updateScheduleIntervalsSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

export async function handleGeneralSettingsAction(
  userId: string,
  action: string,
  formData: FormData
) {
  if (action === "update_timezone") {
    const result = validateFormDataOrRespond(formData, updateTimezoneSchema);
    if (!result.success) {
      return result.response;
    }
    await updateUserTimezone(userId, result.data.timezone);
    return json({ success: true });
  }

  if (action === "update_relays") {
    const result = validateFormDataOrRespond(formData, updateRelaysSchema);
    if (!result.success) {
      return result.response;
    }
    await updateUserRelays(userId, result.data.relays);
    return json({ success: true });
  }

  if (action === "update_blacklist") {
    const result = validateFormDataOrRespond(formData, updateBlacklistSchema);
    if (!result.success) {
      return result.response;
    }
    await updateGiveawayBlacklist(userId, result.data.blacklist);
    return json({ success: true });
  }

  if (action === "update_schedule_intervals") {
    const result = validateFormDataOrRespond(
      formData,
      updateScheduleIntervalsSchema
    );
    if (!result.success) {
      return result.response;
    }
    // Convert numbers back to strings for storage
    const intervals = result.data.scheduleIntervals.map((num) =>
      num.toString()
    );
    await updateScheduleInterval(userId, intervals);
    return json({ success: true });
  }

  if (action === "update_notification_preferences") {
    const pushNotificationsEnabled = formData.get("pushNotificationsEnabled");
    const pushNotifyPublishSuccess = formData.get("pushNotifyPublishSuccess");
    const pushNotifyPublishFailure = formData.get("pushNotifyPublishFailure");

    await updateUserPushNotificationPreferences(userId, {
      ...(pushNotificationsEnabled !== null && {
        pushNotificationsEnabled: pushNotificationsEnabled === "true",
      }),
      ...(pushNotifyPublishSuccess !== null && {
        pushNotifyPublishSuccess: pushNotifyPublishSuccess === "true",
      }),
      ...(pushNotifyPublishFailure !== null && {
        pushNotifyPublishFailure: pushNotifyPublishFailure === "true",
      }),
    });

    return json({ success: true });
  }

  if (action === "update_time_format") {
    const timeFormat = formData.get("timeFormat");
    if (timeFormat === "12h" || timeFormat === "24h") {
      await updateUserTimeFormat(userId, timeFormat);
      return json({ success: true });
    }
    return json({ error: "Invalid time format" }, { status: 400 });
  }

  return null;
}
