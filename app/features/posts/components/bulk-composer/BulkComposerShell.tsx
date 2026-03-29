import type { ReactNode } from "react";

import { NewPostHeader } from "~/features/posts/components/NewPostHeader";

export function BulkComposerShell({
  title,
  headerActions,
  workspace,
  rail,
}: {
  title: string;
  headerActions: ReactNode;
  workspace: ReactNode;
  rail: ReactNode;
}) {
  const showHeader =
    title.trim().length > 0 ||
    (headerActions != null && headerActions !== false);

  return (
    <div className="px-6 pt-4 pb-6">
      {showHeader ? (
        <header className="border-border/50 mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-3">
          {title.trim().length > 0 ? (
            <NewPostHeader title={title} />
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {headerActions}
          </div>
        </header>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">{workspace}</div>
        <div className="w-full shrink-0 lg:w-auto lg:max-w-[344px]">{rail}</div>
      </div>
    </div>
  );
}
