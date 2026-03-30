import { Loader2 } from "lucide-react";

import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import {
  type PostDetailModalPost,
  getPostContextLine,
  getPostKind,
  getThreadGroupId,
} from "../post-detail-helpers";
import type {
  PostDetailContentVariant,
  PostDetailHeightMode,
} from "../resolve-post-detail-variant";
import type { PostThreadGroupResponse } from "../usePostThreadGroup";

import { MediaPostPreview } from "./MediaPostPreview";
import { PollPostPreview } from "./PollPostPreview";
import { TextPostPreview } from "./TextPostPreview";

type Inner = Exclude<PostDetailContentVariant, "thread">;

function ThreadSegmentRow({
  text,
  position,
  hasMedia,
}: {
  text: string;
  position: number;
  hasMedia: boolean;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground bg-muted/15 rounded-lg px-3 py-2 text-sm"
      )}
    >
      <span className="text-muted-foreground/80 mr-2 font-mono text-xs tabular-nums">
        {position}.
      </span>
      <span className="line-clamp-3 whitespace-pre-wrap">{text}</span>
      {hasMedia ? (
        <span className="text-muted-foreground/80 mt-1 block text-xs">
          Media attached
        </span>
      ) : null}
    </div>
  );
}

function CurrentInnerBody({
  innerVariant,
  post,
  type,
  nip88PollsEnabled,
  contextLine,
  heightMode,
  onImageClick,
}: {
  innerVariant: Inner;
  post: PostDetailModalPost;
  type: "draft" | "published" | "scheduled";
  nip88PollsEnabled: boolean;
  contextLine: string;
  heightMode: PostDetailHeightMode;
  onImageClick: (url: string) => void;
}) {
  const compact = heightMode === "compact";
  if (innerVariant === "poll") {
    return (
      <PollPostPreview
        post={post}
        type={type}
        nip88PollsEnabled={nip88PollsEnabled}
        contextLine={contextLine}
      />
    );
  }
  if (innerVariant === "media") {
    return (
      <MediaPostPreview
        post={post}
        contextLine={contextLine}
        onImageClick={onImageClick}
      />
    );
  }
  return (
    <TextPostPreview post={post} contextLine={contextLine} compact={compact} />
  );
}

export function ThreadPostPreview({
  post,
  type,
  nip88PollsEnabled,
  innerVariant,
  heightMode,
  formatDateFn,
  formatScheduledDateFn,
  userTimezone,
  userTimeFormat,
  queueType,
  onImageClick,
  threadGroupData,
  threadGroupLoading,
}: {
  post: PostDetailModalPost;
  type: "draft" | "published" | "scheduled";
  nip88PollsEnabled: boolean;
  innerVariant: Inner;
  heightMode: PostDetailHeightMode;
  formatDateFn: (
    date: Date | string,
    short: boolean,
    tz?: string,
    fmt?: "12h" | "24h"
  ) => string;
  formatScheduledDateFn: (
    d: Date | null | undefined,
    tz: string | undefined,
    fmt: "12h" | "24h"
  ) => string;
  userTimezone: string | undefined;
  userTimeFormat: "12h" | "24h";
  queueType: { name: string } | null | undefined;
  onImageClick: (url: string) => void;
  threadGroupData: PostThreadGroupResponse | undefined;
  threadGroupLoading: boolean;
}) {
  const groupId = getThreadGroupId(post);
  const data = threadGroupData;
  const isPending = threadGroupLoading;

  const contextLine = getPostContextLine(
    type,
    post,
    queueType,
    formatDateFn,
    formatScheduledDateFn,
    userTimezone,
    userTimeFormat
  );

  const segments = data?.segments ?? [];
  const currentIndex = data?.currentIndex ?? -1;
  const total = data?.total ?? 0;

  const showStack =
    Boolean(groupId) && segments.length > 1 && currentIndex >= 0;

  const prevSeg = showStack ? segments[currentIndex - 1] : undefined;
  const nextSeg = showStack ? segments[currentIndex + 1] : undefined;

  const threadKindOnly =
    !groupId && getPostKind(post) === "THREAD" ? "Thread post" : null;

  const positionLabel =
    groupId && !isPending && total > 0 && currentIndex >= 0
      ? `Post ${currentIndex + 1} of ${total}`
      : groupId && !isPending && currentIndex < 0
        ? "Thread post"
        : null;

  return (
    <div className="space-y-4 py-1">
      {groupId && isPending ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2
            className={`${INLINE_ICON_SIZE_CLASS} animate-spin`}
            aria-hidden
          />
          Loading thread…
        </div>
      ) : null}

      {showStack ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Thread
          </p>
          {prevSeg ? (
            <ThreadSegmentRow
              text={prevSeg.previewText}
              position={prevSeg.position}
              hasMedia={prevSeg.hasMedia}
            />
          ) : null}
          <div className="border-primary/20 bg-primary/5 rounded-xl border p-3">
            <CurrentInnerBody
              innerVariant={innerVariant}
              post={post}
              type={type}
              nip88PollsEnabled={nip88PollsEnabled}
              contextLine=""
              heightMode={heightMode}
              onImageClick={onImageClick}
            />
          </div>
          {nextSeg ? (
            <ThreadSegmentRow
              text={nextSeg.previewText}
              position={nextSeg.position}
              hasMedia={nextSeg.hasMedia}
            />
          ) : null}
          <p className="text-muted-foreground text-xs">{contextLine}</p>
          {positionLabel ? (
            <p className="text-muted-foreground text-xs">{positionLabel}</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <CurrentInnerBody
            innerVariant={innerVariant}
            post={post}
            type={type}
            nip88PollsEnabled={nip88PollsEnabled}
            contextLine={contextLine}
            heightMode={heightMode}
            onImageClick={onImageClick}
          />
          {positionLabel ? (
            <p className="text-muted-foreground text-xs">{positionLabel}</p>
          ) : threadKindOnly ? (
            <p className="text-muted-foreground text-xs">{threadKindOnly}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
