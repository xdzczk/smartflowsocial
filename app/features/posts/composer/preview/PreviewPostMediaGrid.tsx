import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { cn } from "~/lib/utils";

import type { NormalizedPreviewMedia } from "./normalized-composer-preview.types";

const GRID_TWO_COL = "grid grid-cols-2 gap-1.5";

export function PreviewPostMediaGrid({
  media,
  className,
}: {
  media: NormalizedPreviewMedia[];
  className?: string;
}) {
  if (media.length === 0) return null;

  const n = media.length;

  if (n === 1) {
    const m = media[0]!;
    return (
      <div
        className={cn(
          "border-border/50 mb-3 overflow-hidden rounded-lg border",
          className
        )}
      >
        <div className="bg-muted/30 aspect-video max-h-80 w-full">
          {m.kind === "video" ? (
            <video
              src={m.url}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <MediaThumbnail
              src={m.url}
              alt={m.alt ?? ""}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mb-3", GRID_TWO_COL, className)}>
      {media.map((m, i) => (
        <div
          key={m.id}
          className={cn(
            "border-border/50 bg-muted/20 overflow-hidden rounded-md border",
            n === 3 && i === 0 ? "col-span-2 aspect-video" : "aspect-square"
          )}
        >
          {m.kind === "video" ? (
            <video
              src={m.url}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <MediaThumbnail
              src={m.url}
              alt={m.alt ?? ""}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
}
