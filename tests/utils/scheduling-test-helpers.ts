/**
 * Shared test helpers for scheduling algorithm tests
 *
 * These helpers reduce duplication in large integration tests by providing
 * common setup patterns and test data factories.
 */

import type { QueueType, $Enums } from "@prisma/client";

/**
 * Test constants for scheduling tests
 */
export const TEST_USER_ID = "user-123";
export const BASE_TIME = new Date("2024-01-15T10:00:00Z"); // Monday, Jan 15, 2024, 10:00 UTC

/**
 * Create a QueueType object for testing
 */
export function createQueueType(overrides: Partial<QueueType> = {}): QueueType {
  const scheduleType: $Enums.ScheduleType = "INTERVAL";
  const queueType: QueueType = {
    id: "queue-1",
    name: "posts",
    scheduleType,
    scheduleConfig: { intervalHours: 6 },
    userId: TEST_USER_ID,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    color: null,
    description: null,
    hashTagPresetId: null,
    lastPostTime: null,
    isDefault: false,
    ...overrides,
  };
  return queueType;
}

/**
 * Create an INTERVAL-based queue type
 */
export function createIntervalQueueType(
  intervalHours: number,
  overrides: Partial<QueueType> = {}
): QueueType {
  const scheduleType: $Enums.ScheduleType = "INTERVAL";
  return createQueueType({
    scheduleType,
    scheduleConfig: { intervalHours },
    ...overrides,
  });
}

/**
 * Create a FIXED_SLOTS-based queue type
 *
 * @param slots - Array of slot objects with hour and minute, OR array of time strings like "09:00"
 */
export function createFixedSlotsQueueType(
  slots: Array<{ hour: number; minute: number }> | string[],
  overrides: Partial<QueueType> = {}
): QueueType {
  // Convert to string format that the scheduler expects (e.g., "09:00")
  const slotStrings =
    typeof slots[0] === "string"
      ? (slots as string[])
      : (slots as Array<{ hour: number; minute: number }>).map(
          (slot) =>
            `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`
        );

  return createQueueType({
    scheduleType: "FIXED_SLOTS",
    scheduleConfig: { slots: slotStrings },
    ...overrides,
  });
}

/**
 * Create a date relative to BASE_TIME
 */
export function createTestDate(hoursOffset: number): Date {
  const date = new Date(BASE_TIME);
  date.setHours(date.getHours() + hoursOffset);
  return date;
}

/**
 * Create a date with specific time
 */
export function createDateAtTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}
