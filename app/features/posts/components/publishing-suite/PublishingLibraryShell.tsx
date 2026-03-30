import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { PUBLISHING_LIBRARY_SHELL_CLASS } from "./constants";

export function PublishingLibraryShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(PUBLISHING_LIBRARY_SHELL_CLASS, className)}>
      {children}
    </div>
  );
}
