import React from "react";

import { NewPostHeader } from "~/features/posts/components/NewPostHeader";

type CreateComposerContentType = "post" | "poll" | "thread" | "article";

interface CreateComposerShellProps {
  contentType: CreateComposerContentType;
  onContentTypeChange: (next: CreateComposerContentType) => void;
  title?: string;
  children: React.ReactNode;
}

function tabButtonClass(active: boolean): string {
  return `rounded-md px-3 py-1.5 text-sm font-medium ${
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted"
  }`;
}

export function CreateComposerShell({
  contentType,
  onContentTypeChange,
  title = "Create post",
  children,
}: CreateComposerShellProps) {
  return (
    <div className="p-6">
      <div className="bg-background/95 mb-4 space-y-3 border-b pb-3 backdrop-blur">
        <NewPostHeader title={title} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={tabButtonClass(contentType === "post")}
            onClick={() => onContentTypeChange("post")}
          >
            Post
          </button>
          <button
            type="button"
            className={tabButtonClass(contentType === "poll")}
            onClick={() => onContentTypeChange("poll")}
          >
            Poll
          </button>
          <button
            type="button"
            className={tabButtonClass(contentType === "thread")}
            onClick={() => onContentTypeChange("thread")}
          >
            Thread
          </button>
          <button
            type="button"
            className={tabButtonClass(contentType === "article")}
            onClick={() => onContentTypeChange("article")}
          >
            Article
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
