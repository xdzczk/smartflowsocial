import React from "react";

import { NewPostHeader } from "~/features/posts/components/NewPostHeader";

type CreateComposerContentType = "post" | "poll" | "thread" | "article";

interface CreateComposerShellProps {
  contentType: CreateComposerContentType;
  onContentTypeChange: (next: CreateComposerContentType) => void;
  title?: string;
  /** Shown on the right of the Post/Poll/Thread/Article tab row (e.g. save status). */
  saveStateLabel?: string | null;
  children: React.ReactNode;
}

function tabButtonClass(active: boolean): string {
  return `rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
  }`;
}

export function CreateComposerShell({
  contentType,
  onContentTypeChange,
  title = "Create post",
  saveStateLabel = null,
  children,
}: CreateComposerShellProps) {
  const showSaveLabel =
    typeof saveStateLabel === "string" && saveStateLabel.trim().length > 0;

  return (
    <div className="px-6 pt-4 pb-5">
      <header className="border-border/50 mb-3 space-y-1.5 border-b pb-2.5">
        <NewPostHeader title={title} />
        <div className="flex w-full min-w-0 items-center gap-3">
          <div
            className="flex min-w-0 flex-wrap items-center gap-1.5"
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
          {showSaveLabel ? (
            <span
              className="text-muted-foreground ml-auto shrink-0 text-right text-xs whitespace-nowrap tabular-nums"
              aria-live="polite"
            >
              {saveStateLabel.trim()}
            </span>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}
