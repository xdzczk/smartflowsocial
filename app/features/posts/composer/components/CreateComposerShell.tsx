import React from "react";

import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import { NewPostHeader } from "~/features/posts/components/NewPostHeader";

import type { ComposerPublishMode } from "./composer";

type CreateComposerContentType = "post" | "poll" | "thread" | "article";

interface CreateComposerShellProps {
  status: ComposerStatus;
  relayCount: number;
  onRelayClick: () => void;
  contentType: CreateComposerContentType;
  onContentTypeChange: (next: CreateComposerContentType) => void;
  publishMode?: ComposerPublishMode;
  onPublishModeChange?: (next: ComposerPublishMode) => void;
  draftStateLabel?: string;
  showPublishModeBar?: boolean;
  title?: string;
  metadataItems?: string[];
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
  status,
  relayCount,
  onRelayClick,
  contentType,
  onContentTypeChange,
  publishMode = "now",
  onPublishModeChange,
  draftStateLabel = "Draft idle",
  showPublishModeBar = true,
  title = "Create post",
  metadataItems = [],
  children,
}: CreateComposerShellProps) {
  return (
    <div className="p-6">
      <div className="bg-background/95 mb-4 space-y-3 border-b pb-3 backdrop-blur">
        <NewPostHeader
          status={status}
          relayCount={relayCount}
          onRelayClick={onRelayClick}
          title={title}
          metadataItems={metadataItems}
        />
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
        {showPublishModeBar ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["now", "Now"],
                  ["schedule", "Schedule"],
                  ["queue", "Queue"],
                ] as const
              ).map(([modeValue, modeLabel]) => (
                <button
                  key={modeValue}
                  type="button"
                  className={tabButtonClass(publishMode === modeValue)}
                  onClick={() => onPublishModeChange?.(modeValue)}
                >
                  {modeLabel}
                </button>
              ))}
            </div>
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <span>{draftStateLabel}</span>
            </div>
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
