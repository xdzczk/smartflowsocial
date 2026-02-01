import { memo, type ReactNode } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

import type { CombinedContent } from "../types";

function getFlowPreview(item: CombinedContent): string {
  if (item.type === "longform") {
    if (item.title) {
      return item.title.length > 40
        ? item.title.substring(0, 40) + "..."
        : item.title;
    }
    return "Longform post";
  }
  if (item.caption) {
    return item.caption.length > 40
      ? item.caption.substring(0, 40) + "..."
      : item.caption;
  }
  const fileUrl = item.fileUrl;
  if (fileUrl && fileUrl.length > 0) {
    if (item.postType === "VIDEO" || item.postType === "CAROUSEL") {
      return "Media post";
    }
    return "Image post";
  }
  return "Text post";
}

function getFlowDisplayTime(item: CombinedContent): Date {
  const raw = item.postedAt ?? item.scheduledAtUtc ?? item.createdAt;
  return raw instanceof Date ? raw : new Date(raw);
}

function getFirstImageUrl(item: CombinedContent): string | null {
  if (item.type === "longform" && item.image) {
    return item.image;
  }
  const fileUrl = item.fileUrl;
  if (!fileUrl || fileUrl.length === 0) return null;
  const first = fileUrl[0];
  if (typeof first === "string") {
    try {
      const parsed = JSON.parse(first) as string[] | string;
      return Array.isArray(parsed) ? (parsed[0] ?? null) : parsed;
    } catch {
      return first;
    }
  }
  return null;
}

export interface FlowCardProps {
  item: CombinedContent;
  onClick: () => void;
  "aria-label"?: string;
  /** When true, shows a small "Last post" marker (last posted item before upcoming) */
  isLastPosted?: boolean;
  /** Minutes until scheduled (future items only); used for proximity emphasis */
  minutesUntil?: number;
  /** Current time in ms (from parent) for past-post relative labels; avoids Date.now() in render */
  nowMs?: number;
}

function getStatusLabel(
  item: CombinedContent
): "Scheduled" | "Posted" | "Failed" {
  if (item.postedAt) return "Posted";
  const state = (item.currentState ?? item.status).toLowerCase();
  if (state.includes("fail")) return "Failed";
  return "Scheduled";
}

const MINUTES_DAY = 24 * 60;
const MINUTES_WEEK = 7 * MINUTES_DAY;
const MINUTES_48H = 48 * 60;

function getRelativeTimeLabel(
  minutesUntil: number,
  displayTime: Date,
  timezone: string,
  timeFormat: "12h" | "24h"
): string {
  if (minutesUntil < 1) return "in < 1 min";
  if (minutesUntil < 60) return `in ${Math.round(minutesUntil)} min`;
  if (minutesUntil < 120) return "in 1 hour";
  if (minutesUntil < MINUTES_DAY)
    return `in ${Math.round(minutesUntil / 60)} hours`;
  if (minutesUntil < MINUTES_48H) {
    const timeStr = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: timeFormat === "12h",
    }).format(displayTime);
    return `tomorrow at ${timeStr}`;
  }
  return "";
}

function getRelativeTimeLabelForPast(
  minutesAgo: number,
  displayTime: Date,
  timezone: string,
  timeFormat: "12h" | "24h"
): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${Math.round(minutesAgo)} min ago`;
  if (minutesAgo < 120) return "1 hour ago";
  if (minutesAgo < MINUTES_DAY)
    return `${Math.round(minutesAgo / 60)} hours ago`;
  if (minutesAgo < MINUTES_48H) {
    const timeStr = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: timeFormat === "12h",
    }).format(displayTime);
    return `yesterday at ${timeStr}`;
  }
  return "";
}

function FlowCardInner({
  item,
  onClick,
  "aria-label": ariaLabel,
  isLastPosted = false,
  minutesUntil,
  nowMs: nowMsProp,
}: FlowCardProps): ReactNode {
  const { formatDate, userTimezone, userTimeFormat } = useFormattedDate();
  const displayTime = getFlowDisplayTime(item);
  const formattedTime = formatDate(displayTime, {
    timezone: userTimezone,
    timeFormat: userTimeFormat,
  });
  const isScheduled = !item.postedAt;
  const displayTimeMs = displayTime.getTime();
  const minutesAgo =
    nowMsProp != null && nowMsProp > 0
      ? (nowMsProp - displayTimeMs) / 60000
      : -1;

  const timeLabel = isScheduled
    ? minutesUntil != null && minutesUntil >= 0 && minutesUntil < MINUTES_48H
      ? getRelativeTimeLabel(
          minutesUntil,
          displayTime,
          userTimezone,
          userTimeFormat
        )
      : formattedTime
    : minutesAgo >= 0 && minutesAgo < MINUTES_48H
      ? getRelativeTimeLabelForPast(
          minutesAgo,
          displayTime,
          userTimezone,
          userTimeFormat
        )
      : formattedTime;
  const preview = getFlowPreview(item);
  const firstImage = getFirstImageUrl(item);
  const queueColor = item.queueType?.color;
  const queueName = item.queueType?.name ?? "";
  const statusLabel = getStatusLabel(item);
  const defaultAriaLabel = `${item.type === "longform" ? "Longform" : "Post"}: ${preview}, ${statusLabel} ${timeLabel}`;

  const proximityBorder =
    minutesUntil != null
      ? minutesUntil < MINUTES_DAY
        ? "border-primary/40"
        : minutesUntil > MINUTES_WEEK
          ? "border-border/80"
          : ""
      : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-border bg-card hover:border-primary/50 focus:ring-primary flex h-full min-h-[248px] w-[320px] flex-shrink-0 flex-row overflow-hidden rounded-lg border transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${proximityBorder}`}
      style={
        queueColor
          ? {
              borderLeftWidth: 4,
              borderLeftColor: queueColor,
            }
          : undefined
      }
      aria-label={ariaLabel ?? defaultAriaLabel}
      title={`${preview}\n${statusLabel} ${timeLabel}`}
    >
      {/* Media on left */}
      <div className="bg-muted/50 flex h-full w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-l-md">
        {firstImage ? (
          <MediaThumbnail
            src={firstImage}
            alt=""
            className="h-full w-full object-cover"
            forceType={isVideoFile(firstImage) ? "video" : "image"}
            hidePlayButton={true}
            fallback={
              <div className="bg-muted h-full w-full flex-shrink-0 rounded" />
            }
          />
        ) : (
          <span className="text-muted-foreground text-2xl">
            {item.type === "longform" ? "📄" : "📝"}
          </span>
        )}
      </div>
      {/* Text on right */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4 text-left">
        {isLastPosted ? (
          <span className="text-muted-foreground bg-muted/50 mb-1 self-start px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
            Last post
          </span>
        ) : null}
        <span className="text-foreground text-lg leading-tight font-bold">
          {timeLabel}
        </span>
        <span className="text-muted-foreground text-sm">
          {statusLabel}
          {queueName ? ` · ${queueName}` : ""}
        </span>
      </div>
    </button>
  );
}

export const FlowCard = memo(FlowCardInner);
