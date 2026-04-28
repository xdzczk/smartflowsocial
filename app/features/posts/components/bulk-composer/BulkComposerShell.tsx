import type { ReactNode } from "react";

import {
  PublishingLibraryShell,
  PublishingPageHeader,
} from "~/features/posts/ui";
import { cn } from "~/lib/utils";

export function BulkComposerShell({
  title,
  headerActions,
  workspace,
  rail,
  className,
}: {
  title: string;
  headerActions: ReactNode;
  workspace: ReactNode;
  rail: ReactNode;
  /** Optional class on the outer library shell (e.g. for nested route usage). */
  className?: string;
}) {
  const showHeader =
    title.trim().length > 0 ||
    (headerActions != null && headerActions !== false);
  const pageTitle = title.trim().length > 0 ? title : "\u00a0";

  return (
    <PublishingLibraryShell className={cn(className)}>
      {showHeader ? (
        <div className="pt-2 pb-4">
          <PublishingPageHeader
            title={pageTitle}
            actions={
              headerActions != null && headerActions !== false
                ? headerActions
                : undefined
            }
          />
        </div>
      ) : null}
      <div className="stack-loose min-w-0 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">{workspace}</div>
        <div className="w-full min-w-0 shrink-0 lg:w-auto">{rail}</div>
      </div>
    </PublishingLibraryShell>
  );
}
