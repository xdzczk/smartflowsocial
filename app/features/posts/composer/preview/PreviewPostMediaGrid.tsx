import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { cn } from "~/lib/utils";

import type { NormalizedPreviewMedia } from "./normalized-composer-preview.types";

const GRID_TWO_COL = "grid grid-cols-2 gap-1";

function PreviewMediaItem({
  m,
  className,
}: {
  m: NormalizedPreviewMedia;
  className?: string;
}) {
  if (m.phase === "uploading") {
    return (
      <div
        className={cn(
          "flex min-h-[4rem] flex-col items-center justify-center gap-1 px-3 text-center",
          className
        )}
      >
        <span className="text-text-secondary text-xs font-medium">
          Uploading…
        </span>
        {m.fileLabel ? (
          <span className="text-text-tertiary line-clamp-2 text-[11px]">
            {m.fileLabel}
          </span>
        ) : null}
      </div>
    );
  }
  if (m.phase === "failed") {
    return (
      <div
        className={cn(
          "flex min-h-[4rem] flex-col items-center justify-center gap-1 px-3 text-center",
          className
        )}
      >
        <span className="text-danger-text text-xs font-medium">
          Upload failed
        </span>
        {m.failureMessage ? (
          <span className="text-text-secondary line-clamp-3 text-[11px]">
            {m.failureMessage}
          </span>
        ) : null}
        {m.fileLabel ? (
          <span className="text-text-tertiary text-[10px]">{m.fileLabel}</span>
        ) : null}
      </div>
    );
  }
  return m.kind === "video" ? (
    <video
      src={m.url}
      className={cn("h-full w-full object-cover", className)}
      muted
      playsInline
      preload="metadata"
    />
  ) : (
    <MediaThumbnail
      src={m.url}
      alt={m.alt ?? ""}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

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
          "border-border-subtle overflow-hidden rounded-lg border",
          className
        )}
      >
        <div className="bg-surface-hover/50 aspect-video max-h-64 min-h-[7.5rem] w-full">
          <PreviewMediaItem m={m} className="h-full w-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border-subtle overflow-hidden rounded-lg border",
        className
      )}
    >
      <div className={cn(GRID_TWO_COL, "bg-surface-hover/40")}>
        {media.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              "bg-surface-hover/60 overflow-hidden",
              n === 3 && i === 0 ? "col-span-2 aspect-video" : "aspect-square"
            )}
          >
            <PreviewMediaItem m={m} className="h-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
