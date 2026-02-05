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

/** Text for content summary (right column) and text-as-surface (left column). Prefer real content; fallback to getFlowPreview. */
function getContentSummaryText(item: CombinedContent): string {
  if (item.type === "longform") {
    if (item.title?.trim()) return item.title;
    if (item.summary?.trim()) return item.summary;
    return getFlowPreview(item);
  }
  if (item.caption?.trim()) return item.caption;
  if (item.content?.trim()) return item.content;
  return getFlowPreview(item);
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
  /** When true, this is the single next scheduled card; shows subtle glow (speed from minutesUntil) */
  isNextScheduled?: boolean;
  /** Minutes until scheduled (future items only); used for relative time and glow speed */
  minutesUntil?: number;
  /** Current time in ms (from parent) for past-post relative labels; avoids Date.now() in render */
  nowMs?: number;
  /** When -1, card is skipped in tab order (e.g. when off-screen in Flow section). */
  tabIndex?: number;
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
const MINUTES_MONTH = 30 * MINUTES_DAY;
const MINUTES_YEAR = 365 * MINUTES_DAY;

function getRelativeTimeLabel(
  minutesUntil: number,
  _displayTime: Date,
  _timezone: string,
  _timeFormat: "12h" | "24h"
): string {
  if (minutesUntil < 1) return "in < 1 min";
  if (minutesUntil < 60) return `in ${Math.round(minutesUntil)} min`;
  if (minutesUntil < 120) return "in 1 hour";
  if (minutesUntil < MINUTES_DAY)
    return `in ${Math.round(minutesUntil / 60)} hours`;
  if (minutesUntil < MINUTES_MONTH) {
    const days = Math.round(minutesUntil / MINUTES_DAY);
    return days === 1 ? "in 1 day" : `in ${days} days`;
  }
  if (minutesUntil < MINUTES_YEAR) {
    const months = Math.round(minutesUntil / MINUTES_MONTH);
    return months === 1 ? "in 1 month" : `in ${months} months`;
  }
  const years = Math.round(minutesUntil / MINUTES_YEAR);
  return years === 1 ? "in 1 year" : `in ${years} years`;
}

function getRelativeTimeLabelForPast(
  minutesAgo: number,
  _displayTime: Date,
  _timezone: string,
  _timeFormat: "12h" | "24h"
): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${Math.round(minutesAgo)} min ago`;
  if (minutesAgo < 120) return "1 hour ago";
  if (minutesAgo < MINUTES_DAY)
    return `${Math.round(minutesAgo / 60)} hours ago`;
  if (minutesAgo < MINUTES_MONTH) {
    const days = Math.round(minutesAgo / MINUTES_DAY);
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (minutesAgo < MINUTES_YEAR) {
    const months = Math.round(minutesAgo / MINUTES_MONTH);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.round(minutesAgo / MINUTES_YEAR);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/** Glow duration: 4s when 24+ h away, ~2s at 1h, 1s only right before publish (last ~15 min) */
function getNextGlowDurationMs(minutesUntil: number): number {
  const imminentMs = 1000;
  const oneHourMs = 2000;
  const maxMs = 4000;
  const imminentThreshold = 15; // minutes; only then does glow reach fastest (1s)
  if (minutesUntil >= MINUTES_DAY) return maxMs;
  if (minutesUntil <= imminentThreshold)
    return Math.round(
      imminentMs + (oneHourMs - imminentMs) * (minutesUntil / imminentThreshold)
    );
  const t =
    (minutesUntil - imminentThreshold) / (MINUTES_DAY - imminentThreshold);
  return Math.round(oneHourMs + (maxMs - oneHourMs) * t);
}

function FlowCardInner({
  item,
  onClick,
  "aria-label": ariaLabel,
  isLastPosted = false,
  isNextScheduled = false,
  minutesUntil,
  nowMs: nowMsProp,
  tabIndex,
}: FlowCardProps): ReactNode {
  const { formatDate, userTimezone, userTimeFormat } = useFormattedDate();
  const displayTime = getFlowDisplayTime(item);
  const formattedTime = formatDate(displayTime, {
    timezone: userTimezone,
    timeFormat: userTimeFormat,
  });
  const isScheduled = !item.postedAt;
  const displayTimeMs = displayTime.getTime();
  // Use parent-provided nowMs to stay pure; fallback to displayTime so relative label is neutral ("just now" / "in < 1 min")
  const nowMs = nowMsProp != null && nowMsProp > 0 ? nowMsProp : displayTimeMs;
  const minutesAgo = (nowMs - displayTimeMs) / 60000;
  const minutesUntilComputed =
    displayTimeMs > nowMs ? (displayTimeMs - nowMs) / 60000 : 0;
  const effectiveMinutesUntil =
    minutesUntil != null && minutesUntil >= 0
      ? minutesUntil
      : minutesUntilComputed;

  const timeLabel = isScheduled
    ? getRelativeTimeLabel(
        effectiveMinutesUntil,
        displayTime,
        userTimezone,
        userTimeFormat
      )
    : getRelativeTimeLabelForPast(
        minutesAgo,
        displayTime,
        userTimezone,
        userTimeFormat
      );
  const preview = getFlowPreview(item);
  const contentSummaryText = getContentSummaryText(item);
  const firstImage = getFirstImageUrl(item);
  const queueColor = item.queueType?.color;
  const queueName = item.queueType?.name ?? "";
  const statusLabel = getStatusLabel(item);
  const defaultAriaLabel = `${item.type === "longform" ? "Longform" : "Post"}: ${preview}, ${statusLabel} ${timeLabel}`;

  // Only the next scheduled (first future) post glows; stop glowing as soon as it's posted
  const isNextScheduledAndFuture =
    isNextScheduled &&
    !item.postedAt &&
    minutesUntil != null &&
    minutesUntil >= 0;
  const glowStyle = isNextScheduledAndFuture
    ? {
        ["--flow-glow-duration" as string]: `${getNextGlowDurationMs(minutesUntil)}ms`,
        ["--flow-glow-color" as string]: queueColor ?? "hsl(var(--primary))",
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={tabIndex}
      className={`card-lift border-border-subtle bg-card focus:ring-primary relative flex h-[200px] w-[280px] flex-shrink-0 flex-row overflow-hidden rounded-xl border shadow-sm focus:ring-2 focus:outline-none md:h-[232px] md:w-[352px] ${queueColor ? "hover:border-[color:var(--queue-color)]" : "hover:border-primary/50"} ${isNextScheduledAndFuture && glowStyle ? "animate-flow-next-glow" : ""}`}
      style={
        queueColor || glowStyle
          ? {
              ...(queueColor
                ? { ["--queue-color" as string]: queueColor }
                : {}),
              ...(glowStyle ?? {}),
            }
          : undefined
      }
      aria-label={ariaLabel ?? defaultAriaLabel}
      title={`${preview}\n${statusLabel} ${timeLabel}`}
    >
      {/* Queue tint overlay: 2% light / 3% dark */}
      {queueColor ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-lg bg-[color-mix(in_srgb,var(--queue-color)_2%,transparent)] dark:bg-[color-mix(in_srgb,var(--queue-color)_3%,transparent)]"
          aria-hidden
        />
      ) : null}
      {/* Visual anchor: image with intentional crop (object-center), rounded mask; narrower on mobile */}
      {firstImage ? (
        <div className="relative z-10 flex h-full w-24 min-w-[96px] flex-shrink-0 overflow-hidden rounded-l-xl md:w-32 md:min-w-[128px]">
          <MediaThumbnail
            src={firstImage}
            alt=""
            className="h-full min-h-full w-full object-cover object-center"
            forceType={isVideoFile(firstImage) ? "video" : "image"}
            hidePlayButton={true}
            fallback={<div className="bg-muted h-full w-full flex-shrink-0" />}
          />
        </div>
      ) : (
        <div className="bg-muted/50 relative z-10 flex h-full w-24 min-w-[96px] flex-shrink-0 flex-col justify-center overflow-hidden rounded-l-xl p-2 md:w-32 md:min-w-[128px] md:p-3">
          <span className="text-muted-foreground line-clamp-4 text-sm">
            {contentSummaryText}
          </span>
        </div>
      )}
      {/* Text on right: tighter padding on mobile so next card peeks; clearer hierarchy */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1 p-3 text-left md:gap-1.5 md:p-5">
        {isLastPosted ? (
          <span className="text-muted-foreground bg-muted/50 mb-0.5 self-start rounded px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            Last post
          </span>
        ) : null}
        <span className="text-foreground text-xl leading-tight font-bold tabular-nums">
          {timeLabel}
        </span>
        {firstImage ? (
          <span className="text-muted-foreground/90 line-clamp-2 text-sm">
            {contentSummaryText}
          </span>
        ) : null}
        <span className="text-muted-foreground/90 mt-0.5 text-[11px] leading-snug">
          {formattedTime}
        </span>
        <span className="text-muted-foreground/90 text-xs leading-snug">
          {statusLabel}
          {queueName ? ` · ${queueName}` : ""}
        </span>
      </div>
    </button>
  );
}

export const FlowCard = memo(FlowCardInner);
