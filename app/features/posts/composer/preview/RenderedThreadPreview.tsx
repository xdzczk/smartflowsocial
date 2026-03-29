import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { User } from "~/features/user";

import type { NormalizedThreadPreview } from "./normalized-composer-preview.types";
import { PreviewAccountHeader } from "./PreviewAccountHeader";
import { ThreadSegmentPreviewCard } from "./ThreadSegmentPreviewCard";

const COLLAPSE_THRESHOLD = 5;

export function RenderedThreadPreview({
  data,
  user,
  tags,
  hideTags,
}: {
  data: NormalizedThreadPreview;
  user: User | undefined;
  tags: string[];
  hideTags: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const segs = data.segments;
  const showCollapseUi = segs.length > COLLAPSE_THRESHOLD;
  const visibleSegments =
    showCollapseUi && collapsed ? segs.slice(0, COLLAPSE_THRESHOLD) : segs;

  const duration = Math.max(segs.length - 1, 0) * data.cadenceMinutes;

  return (
    <div>
      <PreviewAccountHeader user={user} className="mb-4" />
      <div className="flex flex-col gap-3 pl-1">
        {visibleSegments.map((seg) => (
          <ThreadSegmentPreviewCard key={seg.id} segment={seg} />
        ))}
      </div>
      {showCollapseUi ? (
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 text-xs"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed
              ? `Expand all (${segs.length} segments)`
              : "Collapse preview"}
          </Button>
        </div>
      ) : null}
      <div className="text-muted-foreground/85 border-border/40 mt-4 space-y-1 border-t pt-3 text-[11px] leading-relaxed">
        <p>
          {segs.length} segment{segs.length === 1 ? "" : "s"} ·{" "}
          {data.cadenceMinutes} minute cadence
        </p>
        <p>Estimated total thread duration: {duration} minutes</p>
      </div>
      {hideTags ? (
        tags.length > 0 ? (
          <p className="text-muted-foreground/85 mt-2 text-xs">
            {tags.length} hidden topic tag{tags.length === 1 ? "" : "s"}{" "}
            included (applied to each note)
          </p>
        ) : null
      ) : tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs font-normal">
              #{t}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
