import { Repeat } from "lucide-react";
import { memo, type CSSProperties, type ReactNode } from "react";

import { isPollPostItem } from "~/features/polls";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { SMALL_ICON_SIZE_CLASS } from "~/lib/icon-constants";

import { getQueueAccentHex } from "../queue-colors";
import type { CombinedContent } from "../types";
import { getMediaPreviewUrls, isRepostContent } from "../utils/content-helpers";

import { MediaPreviewCollage } from "./MediaPreviewCollage";

function getFlowPreview(item: CombinedContent): string {
  if (item.type === "post" && isPollPostItem(item)) {
    const q =
      item.signedEvent &&
      typeof item.signedEvent.content === "string" &&
      item.signedEvent.content.trim()
        ? item.signedEvent.content.trim()
        : (item.content?.trim() ?? item.caption?.trim() ?? "Poll");
    const short = q.length > 36 ? `${q.slice(0, 36)}…` : q;
    return `Poll: ${short}`;
  }
  if (item.type === "longform") {
    if (item.title) {
      return item.title.length > 40
        ? item.title.substring(0, 40) + "..."
        : item.title;
    }
    return "Article";
  }
  if (item.caption) {
    return item.caption.length > 40
      ? item.caption.substring(0, 40) + "..."
      : item.caption;
  }
  const fileUrl = item.fileUrl;
  if (fileUrl && fileUrl.length > 0) {
    if (item.postType === "VIDEO" || item.postType === "CAROUSEL") {
      return isRepostContent(item) ? "Repost (media)" : "Media post";
    }
    return isRepostContent(item) ? "Repost (image)" : "Image post";
  }
  return isRepostContent(item) ? "Repost" : "Text post";
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
  const raw = item.publishedAt ?? item.scheduledAtUtc ?? item.createdAt;
  return raw instanceof Date ? raw : new Date(raw);
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
): "Scheduled" | "Published" | "Failed" {
  if (item.publishedAt) return "Published";
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
  const isScheduled = !item.publishedAt;
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

  // When this card is the next scheduled slot with a future time, always show it as scheduled
  // (avoids showing "Published · just now" when item incorrectly has publishedAt or due to stale/race data)
  const displayAsScheduled =
    Boolean(isNextScheduled) && minutesUntil != null && minutesUntil >= 0;

  const timeLabel =
    isScheduled || displayAsScheduled
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
  const mediaUrls = getMediaPreviewUrls(item, 4);
  const hasMedia = mediaUrls.length > 0;
  const queueColor =
    item.queueType?.colorToken != null
      ? getQueueAccentHex(item.queueType.colorToken)
      : undefined;
  const queueName = item.queueType?.name ?? "";
  const statusLabel = displayAsScheduled ? "Scheduled" : getStatusLabel(item);
  const postKindLabel =
    item.type === "post" && item.postKind && item.postKind !== "POST"
      ? item.postKind.charAt(0) + item.postKind.slice(1).toLowerCase()
      : null;
  const defaultAriaLabel = `${item.type === "longform" ? "Article" : (postKindLabel ?? "Post")}: ${preview}, ${statusLabel} ${timeLabel}`;

  // Only the next scheduled (first future) post glows; stop glowing as soon as it's posted.
  // Use displayAsScheduled so we still show glow when we're forcing scheduled display (stale/wrong publishedAt).
  const isNextScheduledAndFuture =
    (isNextScheduled &&
      !item.publishedAt &&
      minutesUntil != null &&
      minutesUntil >= 0) ||
    displayAsScheduled;
  const glowStyle = isNextScheduledAndFuture
    ? {
        ["--flow-glow-duration" as string]: `${getNextGlowDurationMs(minutesUntil)}ms`,
      }
    : undefined;

  // --queue-color: next-scheduled shadow pulse + subtle hover tint overlay (low mix).
  const shadowColor = queueColor ?? "hsl(var(--brand-strong) / 0.72)";

  const isPublished = Boolean(item.publishedAt);
  /** Past cards (published or the "Last posted" boundary) use reduced opacity; isLastPosted covers motion-fast when publishedAt may not have updated yet */
  const isPastCard = isPublished || Boolean(isLastPosted);
  const nextCardClass = isNextScheduledAndFuture
    ? "border-transparent bg-surface shadow-none"
    : "border-transparent bg-surface-raised shadow-1 hover:shadow-2";

  const glowLayerStyle: CSSProperties | undefined = isNextScheduledAndFuture
    ? {
        ["--queue-color" as string]: shadowColor,
        ...(glowStyle ?? {}),
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={tabIndex}
      className={`focus-ring card-lift flow-card-queue-shadow group motion-base relative flex h-[200px] w-[280px] flex-shrink-0 flex-row rounded-lg border md:h-[var(--flow-card-h,232px)] md:w-[352px] ${nextCardClass} ${isPastCard ? "opacity-70 hover:opacity-100 focus:opacity-100 active:opacity-100" : ""}`}
      style={{
        ["--queue-color" as string]: shadowColor,
      }}
      aria-label={ariaLabel ?? defaultAriaLabel}
      title={`${preview}\n${statusLabel} ${timeLabel}`}
    >
      {/* Queue-tinted pulse on its own layer so the button can still take neutral hover elevation (box-shadow). */}
      {isNextScheduledAndFuture ? (
        <span
          className="animate-flow-next-shadow-glow pointer-events-none absolute inset-0 z-0 rounded-lg"
          style={glowLayerStyle}
          aria-hidden
        />
      ) : null}
      {/* overflow-hidden on an inner layer so box-shadow / glow on the button are not clipped */}
      <div className="relative z-10 flex h-full min-h-0 w-full min-w-0 flex-row overflow-hidden rounded-lg">
        {/* Subtle queue wash on hover (behind z-10 content; shows through open areas / edges; lower mix than legacy 8%/12%) */}
        <div
          className="pointer-events-none absolute inset-0 rounded-lg bg-[color-mix(in_srgb,var(--queue-color)_4%,transparent)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-active:opacity-100 dark:bg-[color-mix(in_srgb,var(--queue-color)_6%,transparent)]"
          aria-hidden
        />
        {/* Visual anchor: count-based collage (1 full, 2 side-by-side, 3 one-big-two-small, 4 grid) */}
        {hasMedia ? (
          <div className="bg-surface-hover/36 relative z-10 h-full w-24 min-w-[96px] flex-shrink-0 rounded-l-lg md:w-32 md:min-w-[128px]">
            <MediaPreviewCollage
              urls={mediaUrls}
              className="h-full w-full rounded-l-lg"
              thumbnailClassName="h-full min-h-full w-full object-cover object-center"
              hidePlayButton
              twoItemLayout="vertical"
              fallback={
                <div className="bg-surface-hover h-full w-full flex-shrink-0" />
              }
            />
            {isRepostContent(item) ? (
              <div className="bg-brand absolute top-1 right-1 rounded-full p-1">
                <Repeat
                  className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="bg-surface-hover/58 dark:bg-surface-hover/42 relative z-10 flex h-full w-24 min-w-[96px] flex-shrink-0 flex-col justify-center overflow-hidden rounded-l-lg p-2.5 md:w-32 md:min-w-[128px] md:p-3.5">
            {isRepostContent(item) ? (
              <div className="bg-brand absolute top-1 right-1 rounded-full p-1">
                <Repeat
                  className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
            ) : null}
            <span className="text-text-secondary line-clamp-4 text-sm leading-snug">
              {contentSummaryText}
            </span>
          </div>
        )}
        {/* Text on right: tighter padding on mobile so next card peeks; clearer hierarchy */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-3.5 text-left md:gap-2 md:p-5">
          {isLastPosted ? (
            <span className="text-text-secondary bg-surface-hover/50 mb-0.5 self-start rounded-xs px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              Last post
            </span>
          ) : isNextScheduledAndFuture ? (
            <span className="bg-surface-selected text-surface-selected-foreground mb-0.5 self-start rounded-xs px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              Next
            </span>
          ) : null}
          <span
            className={`text-text leading-tight font-semibold tracking-tight tabular-nums ${isNextScheduledAndFuture ? "text-[1.55rem]" : "text-[1.4rem]"}`}
          >
            {timeLabel}
          </span>
          {hasMedia ? (
            <span className="text-text-secondary line-clamp-2 text-sm leading-snug">
              {contentSummaryText}
            </span>
          ) : null}
          <span className="text-text-secondary text-[11px] leading-snug">
            {formattedTime}
          </span>
          <span className="text-text-secondary/90 text-xs leading-snug">
            {statusLabel}
            {postKindLabel ? ` · ${postKindLabel}` : ""}
            {queueName ? ` · ${queueName}` : ""}
          </span>
        </div>
      </div>
    </button>
  );
}

export const FlowCard = memo(FlowCardInner);
