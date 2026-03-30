import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { ComposerCanvasSectionLabel } from "../components/composer/composer-canvas-primitives";

import type { PreviewWarning } from "./normalized-composer-preview.types";
import { PreviewWarnings } from "./PreviewWarnings";

export function ComposerPreviewSection({
  title,
  warnings,
  children,
  className,
}: {
  title: string;
  warnings: PreviewWarning[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border/35 mt-1 border-t pt-2.5 first:mt-0 first:border-t-0 first:pt-1",
        className
      )}
      aria-label={title}
    >
      <ComposerCanvasSectionLabel className="mb-1.5">
        {title}
      </ComposerCanvasSectionLabel>
      <PreviewWarnings warnings={warnings} />
      {children}
    </section>
  );
}
