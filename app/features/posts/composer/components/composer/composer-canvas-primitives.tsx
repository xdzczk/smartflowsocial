/**
 * Shared presentational bits for ComposerLeftCanvas: section labels and stack gaps.
 */

import type { ElementType } from "react";

import { cn } from "~/lib/utils";

export interface ComposerCanvasSectionLabelProps {
  children: React.ReactNode;
  className?: string;
  /** Default h3 for landmarks; use span when nested inside another heading context. */
  as?: ElementType;
  id?: string;
  /** When `as` is `"label"`, associates with a control id. */
  htmlFor?: string;
}

/** Muted caps label for publishing metadata sections (media, tags, poll). */
export function ComposerCanvasSectionLabel({
  children,
  className,
  as: Tag = "h3",
  id,
  htmlFor,
}: ComposerCanvasSectionLabelProps) {
  const labelProps =
    Tag === "label" && htmlFor !== undefined ? { htmlFor } : {};

  return (
    <Tag
      id={id}
      {...labelProps}
      className={cn(
        "text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/** Compact label → control (within a section). */
export const composerCanvasFieldStackClass = "flex flex-col gap-1";

/** Medium stack inside one major block (e.g. several related fields). */
export const composerCanvasBlockStackClass = "flex flex-col gap-3";
