import type { QueueType } from "@prisma/client";

import { getLastPostTimeForQueue } from "~/models/post.server";
import { getScheduleInterval } from "~/models/user.server";
import type { QueueType as TypedQueueType } from "~/features/posts/types";

interface CalculateNextScheduleTimeParams {
  queueType: QueueType | TypedQueueType;
  userId: string;
  userTimezone?: string;
  baseTime?: Date;
}

export async function calculateNextScheduleTime({
  queueType,
  userId,
  userTimezone = "UTC",
  baseTime,
}: CalculateNextScheduleTimeParams): Promise<Date> {
  const now = baseTime || new Date();

  // Get last post time for this queue
  const lastPostTime = await getLastPostTimeForQueue({
    userId,
    queueTypeId: queueType.id,
    queueTypeName: queueType.name, // Keep for backward compatibility
  });

  if (queueType.scheduleType === "INTERVAL") {
    const config = queueType.scheduleConfig;

    // Handle missing scheduleConfig
    if (!config) {
      // Default to 4 hours if no config
      if (lastPostTime) {
        const nextTime = new Date(lastPostTime);
        nextTime.setUTCHours(nextTime.getUTCHours() + 4);
        return nextTime > now ? nextTime : now;
      }
      return new Date(Date.now() + 4 * 60 * 60 * 1000);
    }

    // Use global interval if configured
    if (config.useGlobalInterval) {
      const scheduleIntervals = await getScheduleInterval(userId);
      // Convert string to number if needed (scheduleIntervals is array of strings)
      const interval = scheduleIntervals?.[0] ? Number(scheduleIntervals[0]) : 4; // Default to 4 hours

      if (lastPostTime) {
        // Add interval to last post time
        const nextTime = new Date(lastPostTime);
        nextTime.setUTCHours(nextTime.getUTCHours() + interval);
        return nextTime > now ? nextTime : now;
      } else {
        // No previous posts, schedule for now
        return now;
      }
    } else {
      // Use queue-specific interval
      const intervalHours = config.intervalHours || 4;

      if (lastPostTime) {
        // Add interval to last post time
        const nextTime = new Date(lastPostTime);
        nextTime.setUTCHours(nextTime.getUTCHours() + intervalHours);
        return nextTime > now ? nextTime : now;
      } else {
        // No previous posts, schedule for now
        return now;
      }
    }
  } else if (queueType.scheduleType === "FIXED_SLOTS") {
    const config = queueType.scheduleConfig;
    const slots = config.slots || [];

    if (slots.length === 0) {
      // No slots configured, fallback to immediate
      return now;
    }

    // Sort slots to ensure consistent ordering
    const sortedSlots = slots
      .map((slot: string) => {
        const [hours, minutes] = slot.split(":").map(Number);
        return { slot, hours, minutes, totalMinutes: hours * 60 + minutes };
      })
      .sort((a, b) => a.totalMinutes - b.totalMinutes);

    // Create slot times in user's timezone and convert to UTC
    const createSlotInUserTimezone = (
      hours: number,
      minutes: number,
      baseDate: Date = now,
    ) => {
      try {
        // For UTC/GMT timezones, no conversion needed
        if (userTimezone === "UTC" || userTimezone === "Etc/GMT") {
          const utcSlot = new Date(baseDate);
          utcSlot.setUTCHours(hours, minutes, 0, 0);
          return utcSlot;
        }

        // Get the date string in the user's timezone (YYYY-MM-DD format)
        const userDateStr = baseDate.toLocaleDateString('en-CA', {
          timeZone: userTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });

        // Create a datetime string representing the desired time in user's timezone
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        const dateTimeStr = `${userDateStr}T${timeStr}`;

        // Simpler and more reliable approach using inverse timezone conversion

        // Start with a UTC date for the desired time
        const [year, month, day] = userDateStr.split('-').map(Number);
        let testUTC = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

        // Check what this UTC time looks like in the user's timezone
        let attempts = 0;
        const maxAttempts = 24; // Max 24 hours adjustment

        while (attempts < maxAttempts) {
          const testInUserTz = testUTC.toLocaleString('en-US', {
            timeZone: userTimezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });

          const [testHours, testMinutes] = testInUserTz.split(':').map(Number);

          // Check if we got the desired time
          if (testHours === hours && testMinutes === minutes) {
            return testUTC;
          }

          // Calculate the difference and adjust
          const hourDiff = hours - testHours;
          const minuteDiff = minutes - testMinutes;
          const totalMinuteDiff = hourDiff * 60 + minuteDiff;

          // Adjust by the difference
          testUTC = new Date(testUTC.getTime() + totalMinuteDiff * 60 * 1000);
          attempts++;

          // Handle day boundary crossing
          if (Math.abs(hourDiff) > 12) {
            // Likely crossed midnight, adjust by 24 hours in the opposite direction
            const dayAdjust = hourDiff > 0 ? -24 : 24;
            testUTC = new Date(testUTC.getTime() + dayAdjust * 60 * 60 * 1000);
          }
        }

        return testUTC;
      } catch (error) {
        console.error("Error in createSlotInUserTimezone:", error, {
          hours,
          minutes,
          userTimezone,
        });
        // Fallback to UTC
        const utcSlot = new Date(baseDate);
        utcSlot.setUTCHours(hours, minutes, 0, 0);
        return utcSlot;
      }
    };

    // Convert slots to today's dates in user's timezone
    const todaySlots = sortedSlots
      .map((slotInfo) => {
        const slotTime = createSlotInUserTimezone(
          slotInfo.hours,
          slotInfo.minutes,
        );
        return slotTime;
      })
      .filter((slot) => !isNaN(slot.getTime())); // Filter out invalid dates

    // If there's a last post time, find the next chronological slot after it
    if (lastPostTime) {
      // Instead of using today/tomorrow, start from the day of the last post
      // and create slots for that day and the next day to find the next available slot
      const lastPostDate = new Date(lastPostTime);
      const dayAfterLastPost = new Date(lastPostDate);
      dayAfterLastPost.setDate(dayAfterLastPost.getDate() + 1);

      // Create slots for the day of the last post
      const lastPostDateSlots = sortedSlots.map((slotInfo) => {
        const lastPostDateSlot = createSlotInUserTimezone(
          slotInfo.hours,
          slotInfo.minutes,
          lastPostDate,
        );
        return lastPostDateSlot;
      });

      // Create slots for the day after the last post
      const dayAfterLastPostSlots = sortedSlots.map((slotInfo) => {
        const dayAfterSlot = createSlotInUserTimezone(
          slotInfo.hours,
          slotInfo.minutes,
          dayAfterLastPost,
        );
        return dayAfterSlot;
      });

      // Combine last post date and day after slots for chronological searching
      const allSlots = [
        ...lastPostDateSlots
          .filter((slot) => !isNaN(slot.getTime()))
          .map((slot) => ({ slot, day: "lastPostDate" })),
        ...dayAfterLastPostSlots
          .filter((slot) => !isNaN(slot.getTime()))
          .map((slot) => ({ slot, day: "dayAfterLastPost" })),
      ].sort((a, b) => a.slot.getTime() - b.slot.getTime());

      // Find the next slot after the last post time that's also in the future
      for (const { slot: slotTime } of allSlots) {
        try {
          if (slotTime > lastPostTime && slotTime > now) {
            return slotTime;
          }
        } catch (_error) {
          continue;
        }
      }

      // Fallback: if no slots found, return first slot of the day after the day after last post
      const twoDaysAfterLastPost = new Date(lastPostDate);
      twoDaysAfterLastPost.setDate(twoDaysAfterLastPost.getDate() + 2);
      return createSlotInUserTimezone(
        sortedSlots[0].hours,
        sortedSlots[0].minutes,
        twoDaysAfterLastPost,
      );
    } else {
      // No previous posts, find next available slot today
      for (const slotTime of todaySlots) {
        if (slotTime > now) {
          return slotTime;
        }
      }

      // If no slots today work, get first slot of tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return createSlotInUserTimezone(
        sortedSlots[0].hours,
        sortedSlots[0].minutes,
        tomorrow,
      );
    }
  }

  // Fallback to immediate scheduling
  return now;
}

// Re-export from pure utility file (no server-side dependencies)
export { formatScheduleTimeForInput } from "~/lib/schedule-formatting";
