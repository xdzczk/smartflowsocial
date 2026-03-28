/**
 * Single left-column composer surface: matches publishing rail card grammar
 * (rounded-xl border bg-card shadow-sm). Sections use dividers, not nested cards.
 */

import { cn } from "~/lib/utils";

export function ComposerCanvasDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-border/50 h-px w-full shrink-0", className)}
      role="separator"
    />
  );
}

export interface ComposerLeftCanvasProps {
  children: React.ReactNode;
  /** Right side of header row inside the canvas (e.g. embed draft/template actions). */
  headerTrailing?: React.ReactNode;
  /** Optional muted context on the left of the header row. */
  headerLeading?: React.ReactNode;
  className?: string;
}

export function ComposerLeftCanvas({
  children,
  headerTrailing,
  headerLeading,
  className,
}: ComposerLeftCanvasProps) {
  const showHeader = headerLeading != null || headerTrailing != null;

  return (
    <div
      className={cn(
        "border-border bg-card rounded-xl border shadow-sm",
        className
      )}
    >
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {showHeader ? (
          <div className="mb-5 flex min-h-8 items-center justify-between gap-3 sm:mb-6">
            <div className="text-muted-foreground min-w-0 text-xs leading-snug">
              {headerLeading}
            </div>
            <div className="shrink-0">{headerTrailing}</div>
          </div>
        ) : null}
        <div className="flex flex-col gap-5 sm:gap-6">{children}</div>
      </div>
    </div>
  );
}
