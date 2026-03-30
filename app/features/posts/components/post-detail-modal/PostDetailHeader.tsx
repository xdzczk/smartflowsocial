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
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium";
  if (type === "draft")
    return (
      <span className={`${base} border-border bg-muted/50 text-foreground`}>
        Draft
      </span>
    );
  if (type === "scheduled")
    return (
      <span
        className={`${base} border-border bg-muted/50 text-muted-foreground`}
      >
        Scheduled
      </span>
    );
  return (
    <span className={`${base} border-success bg-success/10 text-success`}>
      {publishedLabel}
    </span>
  );
}

export function PostDetailHeader({
  typeLabel,
  statusType,
  titleId,
  publishedPillLabel = "Posted",
}: {
  typeLabel: string;
  statusType: "draft" | "published" | "scheduled";
  titleId?: string;
  publishedPillLabel?: string;
}) {
  return (
    <div className="border-border/60 bg-card/95 shrink-0 border-b px-5 py-3.5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <DialogTitle
            id={titleId}
            className="text-foreground text-lg font-semibold tracking-tight"
          >
            {typeLabel}
          </DialogTitle>
          <PostStatusBadge
            type={statusType}
            publishedLabel={publishedPillLabel}
          />
        </div>
        <DialogPrimitive.Close
          type="button"
          className={cn(
            "ring-offset-background focus:ring-ring rounded-sm opacity-70 transition-opacity hover:opacity-100",
            "focus:ring-2 focus:ring-offset-0 focus:outline-none",
            "text-foreground shrink-0 p-1"
          )}
          aria-label="Close"
        >
          <X className={INLINE_ICON_SIZE_CLASS} aria-hidden />
        </DialogPrimitive.Close>
      </div>
    </div>
  );
}
