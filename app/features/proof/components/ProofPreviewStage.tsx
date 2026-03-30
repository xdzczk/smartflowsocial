import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function ProofPreviewStage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted/20 flex min-h-[280px] flex-1 items-center justify-center rounded-xl p-6 sm:min-h-[360px]",
        className
      )}
    >
      <div className="flex w-full max-w-full justify-center">{children}</div>
    </div>
  );
}
