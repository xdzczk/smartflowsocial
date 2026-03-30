import { AlertTriangle, Info } from "lucide-react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import type { PreviewWarning } from "./normalized-composer-preview.types";

export function PreviewWarnings({
  warnings,
  className,
}: {
  warnings: PreviewWarning[];
  className?: string;
}) {
  if (warnings.length === 0) return null;
  return (
    <ul
      className={cn(
        "border-border/40 bg-muted/10 mb-2 space-y-1 rounded-md border px-2.5 py-2 text-xs",
        className
      )}
    >
      {warnings.map((w) => (
        <li
          key={w.id}
          className={cn(
            "flex items-start gap-2 leading-snug",
            w.tone === "warn"
              ? "text-amber-800/95 dark:text-amber-200/85"
              : "text-muted-foreground/90"
          )}
        >
          {w.tone === "warn" ? (
            <AlertTriangle
              className="mt-px h-3.5 w-3.5 shrink-0"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          ) : (
            <Info
              className="text-muted-foreground/70 mt-px h-3.5 w-3.5 shrink-0"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          )}
          <span>{w.message}</span>
        </li>
      ))}
    </ul>
  );
}
