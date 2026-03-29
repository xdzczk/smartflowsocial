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
    <section className={cn("pt-1", className)} aria-label={title}>
      <ComposerCanvasSectionLabel className="mb-2.5">
        {title}
      </ComposerCanvasSectionLabel>
      <PreviewWarnings warnings={warnings} />
      <div className="border-border/50 bg-card/40 rounded-xl border p-4 shadow-sm">
        {children}
      </div>
    </section>
  );
}
