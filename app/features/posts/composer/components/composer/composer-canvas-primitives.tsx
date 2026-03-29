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
  /**
   * `default` — utility caps label (poll, media, shortform).
   * `article` — restrained sentence case for longform editorial hierarchy.
   */
  tone?: "default" | "article";
}

/** Muted caps label for publishing metadata sections (media, tags, poll). */
export function ComposerCanvasSectionLabel({
  children,
  className,
  as: Tag = "h3",
  id,
  htmlFor,
  tone = "default",
}: ComposerCanvasSectionLabelProps) {
  const labelProps =
    Tag === "label" && htmlFor !== undefined ? { htmlFor } : {};

  return (
    <Tag
      id={id}
      {...labelProps}
      className={cn(
        "mb-1 text-xs",
        tone === "article"
          ? "text-muted-foreground/80 font-medium tracking-normal"
          : "text-muted-foreground font-semibold tracking-wide uppercase",
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
