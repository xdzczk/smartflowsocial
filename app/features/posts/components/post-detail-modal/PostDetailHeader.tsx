import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { DialogTitle } from "~/components/ui/dialog";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

function PostStatusBadge({
  type,
  publishedLabel = "Posted",
}: {
  type: "draft" | "published" | "scheduled";
  /** Shown when `type` is published (e.g. "Published" for long-form articles). */
  publishedLabel?: string;
}) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium";
  if (type === "draft")
    return (
      <span className={`${base} border-border bg-surface-hover/50 text-text`}>
        Draft
      </span>
    );
  if (type === "scheduled")
    return (
      <span
        className={`${base} border-border bg-surface-hover/50 text-text-secondary`}
      >
        Scheduled
      </span>
    );
  return (
    <span className={`${base} border-success/40 bg-success/10 text-text/90`}>
      {publishedLabel}
    </span>
  );
}

export function PostDetailHeader({
  typeLabel,
  statusType,
  titleId,
  publishedPillLabel = "Posted",
  relationshipChipLabel,
  subtitle,
}: {
  typeLabel: string;
  statusType: "draft" | "published" | "scheduled";
  titleId?: string;
  publishedPillLabel?: string;
  /** Reply / Quote / Repost / Thread item — layered on content type (V2.2). */
  relationshipChipLabel?: string | null;
  subtitle?: string | null;
}) {
  return (
    <div className="border-border/70 bg-surface/95 shrink-0 border-b px-6 py-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <DialogTitle id={titleId} className="text-text text-h2">
              {typeLabel}
            </DialogTitle>
            <PostStatusBadge
              type={statusType}
              publishedLabel={publishedPillLabel}
            />
            {relationshipChipLabel ? (
              <span
                className="border-border bg-surface-hover/40 text-text inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium"
                data-testid="post-detail-relationship-chip"
              >
                {relationshipChipLabel}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-text-secondary mt-1.5 text-xs">{subtitle}</p>
          ) : null}
        </div>
        <DialogPrimitive.Close
          type="button"
          className={cn(
            "ring-offset-canvas focus-visible:ring-focus-ring text-text-secondary hover:text-text rounded-md border border-transparent p-1.5 transition-colors focus-visible:ring-2",
            "focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none",
            "hover:bg-surface-hover/50 shrink-0"
          )}
          aria-label="Close"
        >
          <X className={INLINE_ICON_SIZE_CLASS} aria-hidden />
        </DialogPrimitive.Close>
      </div>
    </div>
  );
}
