/**
 * Pure helpers for the reschedule modal (parse file URL, media, date format, validation, labels).
 */

import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  formatForDateTimeLocal,
  formatForDisplay,
  fromDate,
  isAfter,
  nowInTimezone,
} from "~/lib/temporal";

import type { CalendarPost } from "../PostBlock.types";

export interface RescheduleData {
  post: CalendarPost;
  newDateTime: Date;
  wasAutoScheduled: boolean;
  queueName: string | null;
  isEdit: boolean;
  isLongform: boolean;
}

export function parseFileUrl(firstFileUrl: unknown): string | null {
  if (typeof firstFileUrl !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(firstFileUrl) as string[] | string;
    return Array.isArray(parsed) ? (parsed[0] ?? null) : firstFileUrl;
  } catch {
    return firstFileUrl;
  }
}

export function getFirstMediaFromFileUrl(post: CalendarPost): string | null {
  if (post.fileUrl.length === 0) {
    return null;
  }
  try {
    const firstFileUrl = post.fileUrl[0];
    return parseFileUrl(firstFileUrl);
  } catch (error) {
    handleErrorSafely(error, {
      component: "RescheduleModal",
      action: "getFirstMedia",
    });
    return null;
  }
}

export function getFirstMedia(data: RescheduleData): string | null {
  const { post, isLongform } = data;
  if (isLongform && post.image) {
    return post.image;
  }
  return getFirstMediaFromFileUrl(post);
}

export function formatDateTime(
  date: Date,
  userTimezone: string,
  userTimeFormat: "12h" | "24h" = "12h",
  dateLocale: "en-GB" | "en-US" | "en-CA" = "en-GB"
): string {
  const zonedDateTime = fromDate(date, userTimezone);
  return formatForDisplay(
    zonedDateTime,
    userTimezone,
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    userTimeFormat,
    dateLocale
  );
}

export function validateDateTime(
  dateTime: Date | null,
  userTimezone: string,
  setValidationError: (error: string | null) => void
): boolean {
  if (!dateTime) return false;

  try {
    const now = nowInTimezone(userTimezone);
    const dateTimeZoned = fromDate(dateTime, userTimezone);

    if (!isAfter(dateTimeZoned, now)) {
      setValidationError("Cannot schedule posts in the past");
      return false;
    }

    setValidationError(null);
    return true;
  } catch {
    setValidationError("Invalid date/time");
    return false;
  }
}

export function formatDateTimeForInput(
  date: Date,
  userTimezone: string
): string {
  const zonedDateTime = fromDate(date, userTimezone);
  return formatForDateTimeLocal(zonedDateTime, userTimezone);
}

export function getRescheduleHeaderTitle(
  isEdit: boolean,
  wasAutoScheduled: boolean
): string {
  if (isEdit) return "Edit Post Schedule";
  if (wasAutoScheduled) return "Override Queue Logic?";
  return "Update Post Time?";
}

export function getConfirmButtonLabel(
  isEdit: boolean,
  wasAutoScheduled: boolean,
  isSigningEvent: boolean,
  fetcherState: string
): string {
  if (isSigningEvent) return "Signing Event...";
  if (fetcherState === "submitting") return "Updating...";
  if (isEdit) return "Save Changes";
  if (wasAutoScheduled) return "Convert to Manual";
  return "Confirm";
}
