import type { NormalizedThreadSegmentPreview } from "./normalized-composer-preview.types";
import { PreviewNoteBody } from "./PreviewNoteBody";
import { PreviewPostMediaGrid } from "./PreviewPostMediaGrid";

export function ThreadSegmentPreviewCard({
  segment,
}: {
  segment: NormalizedThreadSegmentPreview;
}) {
  return (
    <div className="border-border/50 bg-card/80 rounded-lg border p-3 shadow-sm">
      <p className="text-muted-foreground/90 mb-2 text-[10px] font-semibold tracking-wide uppercase">
        Segment {segment.index}
      </p>
      <PreviewPostMediaGrid media={segment.media} className="mb-2" />
      <PreviewNoteBody text={segment.text} className="text-[14px]" />
    </div>
  );
}
