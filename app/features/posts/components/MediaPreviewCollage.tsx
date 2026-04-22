import type { ReactNode } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";

const MAX_PREVIEWS = 4;

function toPosterUrl(url: string): string {
  return url.replace(/\/original$/, "/poster");
}

export interface MediaPreviewCollageProps {
  /** Up to 4 URLs; layouts are count-based (1 full, 2 configurable, 3 one-big-two-small, 4 grid). */
  urls: string[];
  /** Root container className (e.g. size and rounding). */
  className?: string;
  /** ClassName for each thumbnail (e.g. object-cover). */
  thumbnailClassName?: string;
  /** Hide play icon on video thumbnails. */
  hidePlayButton?: boolean;
  /** Fallback when a thumbnail fails or for list-card text placeholder. */
  fallback?: ReactNode;
  /** For 2 items: "horizontal" = side by side, "vertical" = top/bottom. Default "horizontal". */
  twoItemLayout?: "horizontal" | "vertical";
}

/**
 * Count-based collage layouts for 1–4 media previews:
 * - 1: single image fills area
 * - 2: two equal cells (side by side or top/bottom per twoItemLayout)
 * - 3: one large left, two stacked right (no empty cell)
 * - 4: 2×2 grid
 */
export function MediaPreviewCollage({
  urls,
  className = "",
  thumbnailClassName = "h-full w-full object-cover object-center",
  hidePlayButton = false,
  fallback = <div className="bg-surface-hover h-full w-full flex-shrink-0" />,
  twoItemLayout = "horizontal",
}: MediaPreviewCollageProps) {
  const slice = urls.slice(0, MAX_PREVIEWS);
  const count = slice.length;

  if (count === 0) return null;

  const isThree = count === 3;
  const gridClasses =
    count === 1
      ? "grid-cols-1 grid-rows-1"
      : count === 2
        ? twoItemLayout === "vertical"
          ? "grid-cols-1 grid-rows-2"
          : "grid-cols-2 grid-rows-1"
        : "grid-cols-2 grid-rows-2";

  return (
    <div className={`grid gap-px overflow-hidden ${gridClasses} ${className}`}>
      {slice.map((url, i) => (
        <div
          key={url}
          className={`relative min-h-0 min-w-0 overflow-hidden ${
            isThree && i === 0 ? "row-span-2" : ""
          }`}
        >
          <MediaThumbnail
            src={isVideoFile(url) ? toPosterUrl(url) : url}
            alt=""
            className={thumbnailClassName}
            forceType={isVideoFile(url) ? "video" : "image"}
            hidePlayButton={hidePlayButton}
            fallback={fallback}
          />
        </div>
      ))}
    </div>
  );
}
