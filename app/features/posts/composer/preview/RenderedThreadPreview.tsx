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

  return (
    <div>
      <PreviewAccountHeader user={user} className="mb-2" />
      <div className="relative pl-3">
        <div
          className="bg-border/45 absolute top-2 bottom-2 left-[0.45rem] w-px"
          aria-hidden
        />
        <div className="relative z-[1] flex flex-col gap-2 pl-4">
          {visibleSegments.map((seg) => (
            <ThreadSegmentPreviewCard key={seg.id} segment={seg} />
          ))}
        </div>
      </div>
      {showCollapseUi ? (
        <div className="mt-2 flex justify-center pl-1">
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
      {hideTags ? (
        tags.length > 0 ? (
          <p className="text-muted-foreground/75 mt-2.5 text-xs">
            {tags.length} hidden topic tag{tags.length === 1 ? "" : "s"}{" "}
            included (applied to each note)
          </p>
        ) : null
      ) : tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
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
