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

function FlowCardInner({
  item,
  onClick,
  "aria-label": ariaLabel,
  isLastPosted = false,
  minutesUntil,
}: FlowCardProps): ReactNode {
  const { formatDate, userTimezone } = useFormattedDate();
  const displayTime = getFlowDisplayTime(item);
  const formattedTime = formatDate(displayTime, {
    timezone: userTimezone,
  });
  const preview = getFlowPreview(item);
  const firstImage = getFirstImageUrl(item);
  const queueColor = item.queueType?.color;
  const queueName = item.queueType?.name ?? "";
  const statusLabel = getStatusLabel(item);
  const defaultAriaLabel = `${item.type === "longform" ? "Longform" : "Post"}: ${preview}, ${statusLabel} ${formattedTime}`;

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
      className={`border-border bg-card hover:border-primary/50 focus:ring-primary flex h-[220px] w-[220px] flex-shrink-0 flex-col overflow-hidden rounded-lg border transition-colors focus:ring-2 focus:outline-none ${proximityBorder}`}
      style={
        queueColor
          ? {
              borderLeftWidth: 4,
              borderLeftColor: queueColor,
            }
          : undefined
      }
      aria-label={ariaLabel ?? defaultAriaLabel}
      title={`${preview}\n${statusLabel} ${formattedTime}`}
    >
      {isLastPosted ? (
        <span className="text-muted-foreground bg-muted/50 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
          Last post
        </span>
      ) : null}
      {/* Time-first: time (primary), status, queue, then media */}
      <div className="flex flex-1 flex-col gap-1 p-3 text-left">
        <span className="text-foreground text-base leading-tight font-bold">
          {formattedTime}
        </span>
        <span className="text-muted-foreground text-xs">
          {statusLabel}
          {queueName ? ` · ${queueName}` : ""}
        </span>
      </div>
      {/* Media preview (secondary, smaller) */}
      <div className="bg-muted/50 flex h-16 w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-b-md">
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
          <span className="text-muted-foreground text-lg">
            {item.type === "longform" ? "📄" : "📝"}
          </span>
        )}
      </div>
    </button>
  );
}

export const FlowCard = memo(FlowCardInner);
