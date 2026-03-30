import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { cn } from "~/lib/utils";

import type { NormalizedPreviewMedia } from "./normalized-composer-preview.types";

const GRID_TWO_COL = "grid grid-cols-2 gap-1";

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
          "border-border/50 overflow-hidden rounded-lg border",
          className
        )}
      >
        <div className="bg-muted/30 aspect-video max-h-64 min-h-[7.5rem] w-full">
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
    <div
      className={cn(
        "border-border/50 overflow-hidden rounded-lg border",
        className
      )}
    >
      <div className={cn(GRID_TWO_COL, "bg-muted/25")}>
        {media.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              "bg-muted/40 overflow-hidden",
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
    </div>
  );
}
