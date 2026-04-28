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
  /**
   * When true (default), the shell wraps the rail in a sticky column under the
   * dashboard header. Use with `BulkSettingsRail shellOwnsRailSticky` (default
   * true). Set false in the bulk composer modal, and pass
   * `shellOwnsRailSticky={false}` on the rail.
   */
  railStickyShell = true,
}: {
  title: string;
  headerActions: ReactNode;
  workspace: ReactNode;
  rail: ReactNode;
  /** Optional class on the outer library shell (e.g. for nested route usage). */
  className?: string;
  railStickyShell?: boolean;
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
        <div
          className={cn(
            "flex w-full min-w-0 shrink-0 flex-col lg:w-auto lg:self-start",
            railStickyShell &&
              "lg:sticky lg:top-[4.75rem] lg:z-10 lg:max-h-[calc(100dvh-5.75rem)]"
          )}
        >
          {rail}
        </div>
      </div>
    </PublishingLibraryShell>
  );
}
