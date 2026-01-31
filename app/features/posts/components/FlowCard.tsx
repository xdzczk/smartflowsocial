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
}

function FlowCardInner({
  item,
  onClick,
  "aria-label": ariaLabel,
}: FlowCardProps): ReactNode {
  const { formatDate, userTimezone } = useFormattedDate();
  const isPast = Boolean(item.postedAt);
  const displayTime = getFlowDisplayTime(item);
  const formattedTime = formatDate(displayTime, {
    timezone: userTimezone,
  });
  const preview = getFlowPreview(item);
  const firstImage = getFirstImageUrl(item);
  const queueColor = item.queueType?.color;

  const statusLabel = isPast ? "Posted" : "Scheduled";
  const defaultAriaLabel = `${item.type === "longform" ? "Longform" : "Post"}: ${preview}, ${statusLabel} ${formattedTime}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border bg-card hover:border-primary/50 focus:ring-primary flex h-[140px] w-[200px] flex-shrink-0 flex-col overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md focus:ring-2 focus:outline-none"
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
      {/* Thumbnail or icon area */}
      <div className="bg-muted/50 flex h-16 w-full flex-shrink-0 items-center justify-center overflow-hidden">
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
      {/* Preview and time */}
      <div className="flex flex-1 flex-col gap-1 p-2 text-left">
        <span
          className="text-foreground line-clamp-2 text-xs font-medium"
          title={preview}
        >
          {preview}
        </span>
        <span className="text-muted-foreground text-xs">
          {statusLabel} · {formattedTime}
        </span>
      </div>
    </button>
  );
}

export const FlowCard = memo(FlowCardInner);
