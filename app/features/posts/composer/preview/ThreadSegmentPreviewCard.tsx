import { cn } from "~/lib/utils";

import type { NormalizedThreadSegmentPreview } from "./normalized-composer-preview.types";
import { PreviewNoteBody } from "./PreviewNoteBody";
import { PreviewPostMediaGrid } from "./PreviewPostMediaGrid";

export function ThreadSegmentPreviewCard({
  segment,
  className,
}: {
  segment: NormalizedThreadSegmentPreview;
  className?: string;
}) {
  const hasText = segment.text.trim().length > 0;
  return (
    <div
      className={cn(
        "border-border-subtle bg-surface-hover/40 relative rounded-md border px-2.5 pt-2 pb-2.5",
        className
      )}
    >
      <span
        className="text-text-tertiary absolute top-2 right-2 text-[10px] tabular-nums"
        aria-label={`Segment ${segment.index}`}
      >
        {segment.index}
      </span>
      <div className={cn("pr-5", hasText ? "" : "pt-0.5")}>
        <PreviewNoteBody text={segment.text} className="text-[14px]" />
        <PreviewPostMediaGrid
          media={segment.media}
          className={hasText ? "mt-2" : undefined}
        />
      </div>
    </div>
  );
}
