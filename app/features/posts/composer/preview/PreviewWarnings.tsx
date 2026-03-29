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
        "border-border/60 bg-muted/20 mb-3 space-y-1.5 rounded-lg border px-3 py-2.5 text-xs",
        className
      )}
    >
      {warnings.map((w) => (
        <li
          key={w.id}
          className={cn(
            "flex gap-2 leading-snug",
            w.tone === "warn"
              ? "text-amber-800 dark:text-amber-200/90"
              : "text-muted-foreground"
          )}
        >
          {w.tone === "warn" ? (
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          ) : (
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80"
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
