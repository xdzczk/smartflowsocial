import React from "react";

import {
  PublishingLibraryShell,
  PublishingPageHeader,
} from "~/features/posts/ui";

type CreateComposerContentType = "post" | "poll" | "thread" | "article";

interface CreateComposerShellProps {
  contentType: CreateComposerContentType;
  onContentTypeChange: (next: CreateComposerContentType) => void;
  title?: string;
  /**
   * Shown on the right of the Post/Poll/Thread/Article tab row (e.g. Drafts / Templates).
   */
  composerHeaderActions?: React.ReactNode;
  /** Shown on the title row, top-right (e.g. save status). */
  saveStateLabel?: string | null;
  /**
   * When true and `saveStateLabel` is empty, reserve the same space as a typical
   * status line so skeleton → loaded composer does not shift the title row.
   */
  reserveTitleStatusSlot?: boolean;
  children: React.ReactNode;
}

function tabButtonClass(active: boolean): string {
  return `rounded-md px-2.5 py-1.5 text-xs motion-fast ${
    active
      ? "bg-surface text-text shadow-sm ring-1 ring-border-subtle/60 font-semibold dark:shadow-none"
      : "text-text-secondary hover:bg-surface-hover/80 hover:text-text font-medium"
  }`;
}

export function CreateComposerShell({
  contentType,
  onContentTypeChange,
  title = "Create post",
  composerHeaderActions = null,
  saveStateLabel = null,
  reserveTitleStatusSlot = false,
  children,
}: CreateComposerShellProps) {
  const showSaveLabel =
    typeof saveStateLabel === "string" && saveStateLabel.trim().length > 0;
  const showTabRowActions = composerHeaderActions != null;
  const showTitleStatusPlaceholder = !showSaveLabel && reserveTitleStatusSlot;

  const titleRowActions = showSaveLabel ? (
    <span
      className="text-text-secondary text-right text-xs whitespace-nowrap tabular-nums"
      aria-live="polite"
    >
      {saveStateLabel.trim()}
    </span>
  ) : showTitleStatusPlaceholder ? (
    <span
      className="text-text-secondary text-right text-xs whitespace-nowrap tabular-nums opacity-0"
      aria-hidden
    >
      Saved locally
    </span>
  ) : undefined;

  return (
    <PublishingLibraryShell>
      <div className="pt-2 pb-4">
        <PublishingPageHeader title={title} actions={titleRowActions} />
      </div>
      <div className="mb-4 flex w-full min-w-0 items-center gap-2 sm:gap-3">
        <div
          className="bg-section/70 dark:bg-section/55 ring-border-subtle/50 flex min-w-0 flex-1 flex-wrap items-center gap-0.5 rounded-lg p-0.5 ring-1"
          role="tablist"
          aria-label="Content type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={contentType === "post"}
            className={tabButtonClass(contentType === "post")}
            onClick={() => onContentTypeChange("post")}
          >
            Post
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={contentType === "poll"}
            className={tabButtonClass(contentType === "poll")}
            onClick={() => onContentTypeChange("poll")}
          >
            Poll
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={contentType === "thread"}
            className={tabButtonClass(contentType === "thread")}
            onClick={() => onContentTypeChange("thread")}
          >
            Thread
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={contentType === "article"}
            className={tabButtonClass(contentType === "article")}
            onClick={() => onContentTypeChange("article")}
          >
            Article
          </button>
        </div>
        {showTabRowActions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5 sm:gap-1">
            {composerHeaderActions}
          </div>
        ) : null}
      </div>
      {children}
    </PublishingLibraryShell>
  );
}
