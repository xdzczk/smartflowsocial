/**
 * General settings action handlers
 */

import { json } from "@remix-run/node";
import {
  updateUserTimezone,
  updateUserRelays,
  updateGiveawayBlacklist,
  updateScheduleInterval,
} from "~/models/user.server";

export async function handleGeneralSettingsAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "update_timezone") {
    const timezone = formData.get("timezone") as string;
    await updateUserTimezone(userId, timezone);
    return json({ success: true });
  }

  if (action === "update_relays") {
    const relays = (formData.get("relays") as string)
      .split("\n")
      .filter((relay) => relay.trim());
    await updateUserRelays(userId, relays);
    return json({ success: true });
  }

  if (action === "update_blacklist") {
    const blacklistItems = (formData.get("blacklist") as string)
      .split("\n")
      .filter((item) => item.trim());

    const invalidItems = blacklistItems.filter(
      (item) => !item.startsWith("npub"),
    );
    if (invalidItems.length > 0) {
      return json(
        { error: "All blacklist items must start with npub" },
        { status: 400 },
      );
    }

    await updateGiveawayBlacklist(userId, blacklistItems);
    return json({ success: true });
  }

  if (action === "update_schedule_intervals") {
    const intervals = (formData.get("scheduleIntervals") as string)
      .split("\n")
      .filter((interval) => interval.trim());

    const invalidIntervals = intervals.filter((interval) => {
      const num = parseInt(interval, 10);
      return isNaN(num) || num <= 0 || num.toString() !== interval.trim();
    });

    if (invalidIntervals.length > 0) {
      return json(
        { error: "All schedule intervals must be positive whole numbers" },
        { status: 400 },
      );
    }

    await updateScheduleInterval(userId, intervals);
    return json({ success: true });
  }

  return null;
}




