/**
 * Single left-column composer surface: dashboard card grammar (elevated surface,
 * restrained border). Sections use soft dividers, not nested form boxes.
 */

import { cn } from "~/lib/utils";

export function ComposerCanvasDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "via-border-subtle/75 dark:via-border-subtle/55 h-px w-full shrink-0 bg-gradient-to-r from-transparent to-transparent",
        className
      )}
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
        "border-border-subtle/80 bg-surface shadow-1 rounded-xl border ring-1 ring-black/[0.03] dark:ring-white/[0.05]",
        className
      )}
    >
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {showHeader ? (
          <div className="mb-5 flex min-h-8 items-center justify-between gap-3 sm:mb-6">
            <div className="text-text-secondary min-w-0 text-xs leading-snug">
              {headerLeading}
            </div>
            <div className="shrink-0">{headerTrailing}</div>
          </div>
        ) : null}
        {/* Direct children should be major blocks (composition vs utilities); use gap-6 for clear rhythm. */}
        <div className="stack-loose sm:gap-7">{children}</div>
      </div>
    </div>
  );
}
