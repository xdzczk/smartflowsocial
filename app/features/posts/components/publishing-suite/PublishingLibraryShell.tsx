import type { ReactNode } from "react";

import { PageContent } from "~/components/layout/PageContent";
import { cn } from "~/lib/utils";

export function PublishingLibraryShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <PageContent fluid className={cn("min-h-screen pb-8", className)}>
      {children}
    </PageContent>
  );
}
