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
  // Wrapper to ensure we always return a valid Date
  try {
    const result = await calculateNextScheduleTimeInternal({
      queueType,
      userId,
      userTimezone,
      baseTime,
    });
    // Validate that result is a valid Date object
    if (!result || !(result instanceof Date) || isNaN(result.getTime())) {
      console.error("Invalid date returned from calculateNextScheduleTimeInternal:", result);
      return new Date();
    }
    return result;
  } catch (error) {
    console.error("Error in calculateNextScheduleTime wrapper:", error);
    return new Date();
  }
}

async function calculateNextScheduleTimeInternal({
  queueType,
  userId,
  userTimezone = "UTC",
  baseTime,
}: CalculateNextScheduleTimeParams): Promise<Date> {
  try {
    // Ensure baseTime is valid, or use current time
    let now: Date;
    if (baseTime && baseTime instanceof Date && !isNaN(baseTime.getTime())) {
      now = baseTime;
    } else {
      now = new Date();
    }

    // Get last post time for this queue - handle errors gracefully
    let lastPostTime: Date | null = null;
    try {
      lastPostTime = await getLastPostTimeForQueue({
        userId,
        queueTypeId: queueType.id,
        queueTypeName: queueType.name, // Keep for backward compatibility
      });
    } catch (error) {
      console.error("Error getting last post time:", error);
      lastPostTime = null;
    }

    // Validate queueType structure
    if (!queueType || !queueType.scheduleType) {
      console.error("Invalid queueType:", queueType);
      return new Date();
    }

    if (queueType.scheduleType === "INTERVAL") {
      const config = queueType.scheduleConfig || {};

      // Handle missing scheduleConfig
      if (!config || typeof config !== "object") {
        // Default to 4 hours if no config
        if (lastPostTime && lastPostTime instanceof Date && !isNaN(lastPostTime.getTime())) {
          // Add 4 hours using milliseconds to avoid date calculation issues
          const nextTime = new Date(lastPostTime.getTime() + 4 * 60 * 60 * 1000);
          // Ensure the date is valid
          if (!(nextTime instanceof Date) || isNaN(nextTime.getTime())) {
            return new Date();
          }
          // Always ensure the returned time is in the future or present
          // Check against current time (not captured 'now') to handle any delays
          const currentTime = new Date();
          return nextTime >= currentTime ? nextTime : currentTime;
        }
        const futureTime = new Date(Date.now() + 4 * 60 * 60 * 1000);
        // Ensure the date is valid
        if (!(futureTime instanceof Date) || isNaN(futureTime.getTime())) {
          return new Date();
        }
        return futureTime;
      }

      // Use global interval if configured
      if (config && typeof config === "object" && config.useGlobalInterval) {
        let scheduleIntervals;
        try {
          scheduleIntervals = await getScheduleInterval(userId);
        } catch (error) {
          console.error("Error getting schedule interval:", error);
          scheduleIntervals = null;
        }
        // Convert string to number if needed (scheduleIntervals is array of strings)
        const interval = scheduleIntervals?.[0] ? Number(scheduleIntervals[0]) : 4; // Default to 4 hours

        if (lastPostTime && lastPostTime instanceof Date && !isNaN(lastPostTime.getTime())) {
          // Add interval to last post time using milliseconds to avoid date calculation issues
          const nextTime = new Date(lastPostTime.getTime() + interval * 60 * 60 * 1000);
          // Ensure the date is valid
          if (!(nextTime instanceof Date) || isNaN(nextTime.getTime())) {
            return new Date();
          }
          // Always ensure the returned time is in the future or present
          // Check against current time (not captured 'now') to handle any delays
          const currentTime = new Date();
          return nextTime >= currentTime ? nextTime : currentTime;
        } else {
          // No previous posts or invalid lastPostTime, schedule for now (use current time to avoid timing issues)
          return new Date();
        }
      } else {
        // Use queue-specific interval
        const intervalHours = (config && typeof config === "object" && typeof config.intervalHours === "number") 
          ? config.intervalHours 
          : 4;

        if (lastPostTime && lastPostTime instanceof Date && !isNaN(lastPostTime.getTime())) {
          // Add interval to last post time using milliseconds to avoid date calculation issues
          const nextTime = new Date(lastPostTime.getTime() + intervalHours * 60 * 60 * 1000);
          // Ensure the date is valid
          if (!(nextTime instanceof Date) || isNaN(nextTime.getTime())) {
            return new Date();
          }
          // Always ensure the returned time is in the future or present
          // Check against current time (not captured 'now') to handle any delays
          const currentTime = new Date();
          return nextTime >= currentTime ? nextTime : currentTime;
        } else {
          // No previous posts or invalid lastPostTime, schedule for now (use current time to avoid timing issues)
          return new Date();
        }
      }
    } else if (queueType.scheduleType === "FIXED_SLOTS") {
      const config = queueType.scheduleConfig || {};
      const slots = (config && typeof config === "object" && Array.isArray(config.slots)) 
        ? config.slots 
        : [];

      if (slots.length === 0) {
        // No slots configured, fallback to immediate (use current time to avoid timing issues)
        return new Date();
      }

      // Sort slots to ensure consistent ordering
      const sortedSlots = slots
      .map((slot: string) => {
        try {
          if (typeof slot !== "string" || !slot.includes(":")) {
            return null;
          }
          const parts = slot.split(":");
          if (parts.length !== 2) {
            return null;
          }
          const hours = Number(parts[0]);
          const minutes = Number(parts[1]);
          if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
          }
          return { slot, hours, minutes, totalMinutes: hours * 60 + minutes };
        } catch (error) {
          console.error("Error parsing slot:", error, { slot });
          return null;
        }
      })
      .filter((slot): slot is NonNullable<typeof slot> => slot !== null)
      .sort((a, b) => a.totalMinutes - b.totalMinutes);

      // Create slot times in user's timezone and convert to UTC
      const createSlotInUserTimezone = (
      hours: number,
      minutes: number,
      baseDate?: Date,
    ): Date => {
      // Use provided baseDate or current time (not captured 'now' to avoid stale time)
      const actualBaseDate = baseDate || new Date();
      try {
        // For UTC/GMT timezones, no conversion needed
        if (userTimezone === "UTC" || userTimezone === "Etc/GMT") {
          const utcSlot = new Date(actualBaseDate);
          utcSlot.setUTCHours(hours, minutes, 0, 0);
          // Ensure the date is valid
          if (isNaN(utcSlot.getTime())) {
            return new Date();
          }
          return utcSlot;
        }

        // Get the date string in the user's timezone (YYYY-MM-DD format)
        const userDateStr = actualBaseDate.toLocaleDateString('en-CA', {
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
            // Ensure the date is valid
            if (isNaN(testUTC.getTime())) {
              return new Date();
            }
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

        // Ensure the date is valid before returning
        if (isNaN(testUTC.getTime())) {
          return new Date();
        }
        return testUTC;
      } catch (error) {
        console.error("Error in createSlotInUserTimezone:", error, {
          hours,
          minutes,
          userTimezone,
        });
        // Fallback to UTC
        const utcSlot = new Date(actualBaseDate);
        utcSlot.setUTCHours(hours, minutes, 0, 0);
        // Ensure the date is valid
        if (isNaN(utcSlot.getTime())) {
          return new Date();
        }
        return utcSlot;
      }
    };

      // Convert slots to today's dates in user's timezone
      // If a slot is in the past, automatically move it to tomorrow
      const currentTime = new Date(); // Get current time for comparison
      const todaySlots = sortedSlots
      .map((slotInfo) => {
        const slotTime = createSlotInUserTimezone(
          slotInfo.hours,
          slotInfo.minutes,
          currentTime,
        );
        // If the slot is in the past, move it to tomorrow
        if (slotTime instanceof Date && !isNaN(slotTime.getTime()) && slotTime < currentTime) {
          const tomorrow = new Date(currentTime);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return createSlotInUserTimezone(
            slotInfo.hours,
            slotInfo.minutes,
            tomorrow,
          );
        }
        return slotTime;
      })
      .filter((slot) => slot instanceof Date && !isNaN(slot.getTime()) && slot >= currentTime); // Filter out invalid dates and ensure future or present dates

      // If there's a last post time, find the next chronological slot after it
      if (lastPostTime && lastPostTime instanceof Date && !isNaN(lastPostTime.getTime())) {
        // If lastPostTime is in the past (more than 1 day ago), start from today instead
        // to avoid creating slots in the distant past
        const currentTimeForBase = new Date(); // Use current time for base date calculation
        const oneDayAgo = new Date(currentTimeForBase);
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const lastPostDate = new Date(lastPostTime);
        // If last post was more than 1 day ago, use today as the base date
        const baseDate = lastPostTime < oneDayAgo ? currentTimeForBase : lastPostDate;
        const dayAfterBase = new Date(baseDate);
        dayAfterBase.setDate(dayAfterBase.getDate() + 1);

        // Create slots for the base date (last post date or today)
        const baseDateSlots = sortedSlots.map((slotInfo) => {
          const baseDateSlot = createSlotInUserTimezone(
            slotInfo.hours,
            slotInfo.minutes,
            baseDate,
          );
          return baseDateSlot;
        });

        // Create slots for the day after the base date
        const dayAfterBaseSlots = sortedSlots.map((slotInfo) => {
          const dayAfterSlot = createSlotInUserTimezone(
            slotInfo.hours,
            slotInfo.minutes,
            dayAfterBase,
          );
          return dayAfterSlot;
        });

        // Combine base date and day after slots for chronological searching
        const allSlots = [
          ...baseDateSlots
            .filter((slot) => !isNaN(slot.getTime()))
            .map((slot) => ({ slot, day: "baseDate" })),
          ...dayAfterBaseSlots
            .filter((slot) => !isNaN(slot.getTime()))
            .map((slot) => ({ slot, day: "dayAfterBase" })),
        ].sort((a, b) => a.slot.getTime() - b.slot.getTime());

        // Find the next slot after the last post time that's also in the future
        const currentTime = new Date(); // Get current time for comparison
        for (const { slot: slotTime } of allSlots) {
          try {
            // Ensure slotTime is valid, after lastPostTime, and in the future or present
            if (
              slotTime instanceof Date &&
              !isNaN(slotTime.getTime()) &&
              slotTime > lastPostTime &&
              slotTime >= currentTime
            ) {
              return slotTime;
            }
          } catch (_error) {
            continue;
          }
        }

        // Fallback: if no slots found, return first slot of the day after the day after base date
        if (sortedSlots.length > 0) {
          const twoDaysAfterBase = new Date(baseDate);
          twoDaysAfterBase.setDate(twoDaysAfterBase.getDate() + 2);
          const fallbackSlot = createSlotInUserTimezone(
            sortedSlots[0].hours,
            sortedSlots[0].minutes,
            twoDaysAfterBase,
          );
          // Ensure the fallback slot is valid and in the future or present
          // Check against current time to handle any delays
          if (!(fallbackSlot instanceof Date) || isNaN(fallbackSlot.getTime()) || fallbackSlot < currentTime) {
            return new Date();
          }
          return fallbackSlot;
        }
        // If all slots were invalid, fallback to now (use current time to avoid timing issues)
        return new Date();
      } else {
        // No previous posts, find next available slot today
        const currentTime = new Date(); // Get current time for comparison
        // todaySlots already filters for future dates, so just return the first one
        if (todaySlots.length > 0) {
          const firstFutureSlot = todaySlots[0];
          // Double-check it's valid and in the future or present
          // Check against current time to handle any delays
          if (firstFutureSlot instanceof Date && !isNaN(firstFutureSlot.getTime()) && firstFutureSlot >= currentTime) {
            return firstFutureSlot;
          }
        }

        // If no slots today work, get first slot of tomorrow
        if (sortedSlots.length > 0) {
          const tomorrow = new Date(currentTime);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowSlot = createSlotInUserTimezone(
            sortedSlots[0].hours,
            sortedSlots[0].minutes,
            tomorrow,
          );
          // Ensure the tomorrow slot is valid and in the future or present
          // Check against current time to handle any delays
          if (tomorrowSlot instanceof Date && !isNaN(tomorrowSlot.getTime()) && tomorrowSlot >= currentTime) {
            return tomorrowSlot;
          }
        }
        // If all slots were invalid, fallback to now (use current time to avoid timing issues)
        return new Date();
      }
    }

    // Fallback to immediate scheduling (use current time to avoid timing issues)
    // This should never be reached, but ensures we always return a Date
    const fallbackDate = new Date();
    if (!(fallbackDate instanceof Date) || isNaN(fallbackDate.getTime())) {
      // Last resort: create a new Date object
      return new Date(Date.now());
    }
    return fallbackDate;
  } catch (error) {
    // Ensure we always return a valid Date, even if there's an error
    console.error("Error in calculateNextScheduleTime:", error, {
      queueType: queueType?.id,
      userId,
      userTimezone,
    });
    const errorFallback = new Date();
    if (!(errorFallback instanceof Date) || isNaN(errorFallback.getTime())) {
      return new Date(Date.now());
    }
    return errorFallback;
  }
}

// Re-export from pure utility file (no server-side dependencies)
export { formatScheduleTimeForInput } from "~/lib/schedule-formatting";
