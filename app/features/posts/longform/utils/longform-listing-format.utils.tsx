/**
 * Format helpers for longform listing: date cell, reading time, status badge.
 */

import type React from "react";

import { handleErrorSafely } from "~/lib/error-handler.client";
import { stripMarkdownToPlainText } from "~/lib/markdown-utils";
import {
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
} from "~/lib/temporal";

export function formatDateCell(
  dateInput: string | Date | number | undefined,
  userTimezone: string,
  userTimeFormat: "12h" | "24h",
  dateLocale: string
): string {
  if (!dateInput) return "—";

  try {
    let zonedDateTime;
    if (typeof dateInput === "string") {
      const unixTimestamp = parseInt(dateInput, 10);
      if (!isNaN(unixTimestamp) && dateInput.length <= 13) {
        const timestamp =
          dateInput.length <= 10 ? unixTimestamp : unixTimestamp;
        zonedDateTime = fromUnixTimestamp(
          dateInput.length <= 10 ? timestamp : Math.floor(timestamp / 1000),
          "UTC"
        );
      } else {
        zonedDateTime = fromISOString(String(dateInput), "UTC");
      }
    } else if (typeof dateInput === "number") {
      const timestamp =
        dateInput.toString().length <= 10
          ? dateInput
          : Math.floor(dateInput / 1000);
      zonedDateTime = fromUnixTimestamp(timestamp, "UTC");
    } else {
      zonedDateTime = fromDate(new Date(dateInput), "UTC");
    }

    const userZoned = zonedDateTime.withTimeZone(userTimezone);
    return formatForDisplay(
      userZoned,
      userTimezone,
      {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: userTimeFormat === "12h",
      },
      userTimeFormat,
      dateLocale as "en-GB" | "en-US" | "en-CA"
    );
  } catch (error) {
    handleErrorSafely(error, {
      component: "LongFormListing",
      action: "formatDate",
    });
    try {
      const dateObj =
        typeof dateInput === "string"
          ? new Date(dateInput)
          : typeof dateInput === "number"
            ? new Date(dateInput * 1000)
            : dateInput;
      return dateObj.toLocaleDateString(dateLocale, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: userTimeFormat === "12h",
      });
    } catch {
      return "—";
    }
  }
}

export function getReadingTime(content?: string): string {
  if (!content) return "0 min read";
  try {
    const plain = stripMarkdownToPlainText(content);
    const wordCount = plain.trim().split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200);
    return `${readingTime} min read`;
  } catch {
    return " -  min read";
  }
}

export function getStatusBadge(
  type: "draft" | "scheduled" | "published"
): React.ReactNode {
  if (type === "draft") {
    return (
      <div className="bg-surface-hover text-text inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold">
        Draft
      </div>
    );
  }
  if (type === "scheduled") {
    return (
      <div className="bg-surface-hover text-text dark:border-border/75 dark:bg-brand/90/10 dark:text-text inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold">
        Scheduled
      </div>
    );
  }
  return (
    <div className="bg-success/20 text-success dark:border-success/75 dark:bg-success/10 dark:text-success inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold">
      Published
    </div>
  );
}
