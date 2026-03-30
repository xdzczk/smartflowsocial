import { Link } from "@remix-run/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";
import {
  RailSectionHeader,
  RailSettingsValueRow,
  RAIL_MAJOR_DIVIDE,
  RAIL_PAD_X,
  RAIL_ZONE_PY,
} from "~/features/posts/components/publishing-rail";
import { getQueueColor } from "~/features/posts/queue-colors";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import type { PostDetailRelationshipType } from "../derive-post-detail-semantics";
import type { PostDetailModalPost } from "../post-detail-helpers";
import {
  InReplyToBlock,
  QuotedPostBlock,
  RepostedPostBlock,
  ThreadContextBlock,
} from "../relationships/RelationshipPreviewBlocks";
import type { PostDetailContentVariant } from "../resolve-post-detail-variant";
import type { PostThreadGroupResponse } from "../usePostThreadGroup";

import { DetailModalReplySnippet } from "./DetailModalReplySnippet";

const RAIL_SECTION_LABEL = cn(
  "normal-case tracking-tight text-muted-foreground/70 !mb-1 text-[10px] font-medium"
);

const USER_TAGS_VISIBLE = 8;

function QueueTypeCalm({
  queueType,
}: {
  queueType: { name: string; color?: string | null; id?: string };
}) {
  const colors = getQueueColor(
    queueType.name,
    (queueType as { colorToken?: string | null }).colorToken
  );
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {queueType.name}
    </span>
  );
}

function UserTagChips({
  tags,
  expanded,
  onToggle,
}: {
  tags: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  if (tags.length === 0) return null;
  const visible = expanded ? tags : tags.slice(0, USER_TAGS_VISIBLE);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground text-xs font-medium">Tags</span>
      <div className="flex flex-wrap gap-1">
        {visible.map((tag) => (
          <span
            key={tag}
            className="bg-muted text-foreground max-w-[min(100%,14rem)] truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
            title={tag}
          >
            #{tag.length > 36 ? `${tag.slice(0, 33)}…` : tag}
          </span>
        ))}
      </div>
      {tags.length > USER_TAGS_VISIBLE ? (
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground text-left text-[10px] font-medium"
        >
          {expanded ? "Show fewer" : `Show all (${tags.length})`}
        </button>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- conditional rail sections
export function PostDetailRail({
  variant,
  type,
  post,
  queueType,
  showStats,
  stats,
  eventId,
  viewThreadUrl,
  openOnNostrUrl,
  directReplies,
  isThreadLoading,
  threadMetadata,
  showSignedEvent,
  showEventData,
  onToggleEventData,
  formatDateFn,
  formatScheduledDateFn,
  userTimezone,
  userTimeFormat,
  threadGroupSummary,
  mediaCount,
  pollOptionCount,
  statusLabel,
  contentLabel,
  relationshipType,
  inReplyTo,
  quotedPost,
  repostedPost,
  threadContextPosition,
  userTags,
  technicalTags,
}: {
  type: "draft" | "published" | "scheduled";
  post: PostDetailModalPost;
  queueType:
    | { name: string; color?: string | null; id?: string }
    | null
    | undefined;
  showStats: boolean;
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  eventId: string | null;
  viewThreadUrl: string;
  openOnNostrUrl: string | null;
  directReplies: ChildReply[];
  isThreadLoading: boolean;
  threadMetadata: Record<string, unknown>;
  showSignedEvent: boolean;
  showEventData: boolean;
  onToggleEventData: () => void;
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
  threadGroupSummary: PostThreadGroupResponse | undefined;
  mediaCount: number;
  pollOptionCount: number | null;
  statusLabel: string;
  /** Post | Poll — content type, not relationship */
  contentLabel: string;
  relationshipType: PostDetailRelationshipType;
  inReplyTo?: {
    authorLine: string | null;
    snippet: string | null;
    viewThreadUrl: string;
  } | null;
  quotedPost?: {
    authorLine: string | null;
    snippet: string | null;
    openUrl: string | null;
    hasMediaHint?: boolean;
  } | null;
  repostedPost?: {
    authorLine: string | null;
    snippet: string | null;
    openUrl: string | null;
  } | null;
  threadContextPosition?: string | null;
  userTags: string[];
  technicalTags: string[];
  variant: PostDetailContentVariant;
}) {
  const [tagsExpanded, setTagsExpanded] = useState(false);
  /** When there is no signed-event JSON toggle, expand technical tags locally. */
  const [localTechnicalExpanded, setLocalTechnicalExpanded] = useState(false);

  const pad = cn(RAIL_PAD_X, RAIL_ZONE_PY, "flex flex-col gap-0");
  const divide = cn(RAIL_MAJOR_DIVIDE, "my-2.5");

  const threadPos =
    threadGroupSummary &&
    threadGroupSummary.currentIndex >= 0 &&
    threadGroupSummary.total > 0
      ? `${threadGroupSummary.currentIndex + 1} of ${threadGroupSummary.total}`
      : null;

  const structureRows: Array<{ label: string; value: string }> = [];
  if (threadPos) {
    structureRows.push({ label: "Thread", value: threadPos });
  }
  if (mediaCount > 0) {
    structureRows.push({
      label: "Media",
      value: `${mediaCount} image${mediaCount === 1 ? "" : "s"}`,
    });
  }
  if (pollOptionCount != null && pollOptionCount > 0) {
    structureRows.push({
      label: "Poll options",
      value: String(pollOptionCount),
    });
  }
  const showStructure = structureRows.length > 0;
  const engagementStats =
    type === "published" && showStats && stats && eventId ? stats : null;

  const previewReplies = directReplies.slice(0, 2);

  const showRepliesOriginal =
    type === "published" &&
    eventId &&
    (variant !== "thread" || isThreadLoading || directReplies.length > 0);

  const showRepliesSecondary =
    type === "published" &&
    eventId &&
    (relationshipType === "reply" ||
      relationshipType === "quote" ||
      relationshipType === "thread_item") &&
    directReplies.length > 0;

  const showRepliesSection =
    relationshipType === "repost"
      ? false
      : relationshipType === "original"
        ? showRepliesOriginal
        : showRepliesSecondary;

  /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Boolean OR of relationship guards, not nullish coalescing */
  const showRelationshipRail = Boolean(
    (relationshipType === "reply" && inReplyTo) ||
    (relationshipType === "quote" && quotedPost) ||
    (relationshipType === "repost" && repostedPost) ||
    (relationshipType === "thread_item" && threadContextPosition)
  );
  /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

  const hasSignedEventJson = Boolean(showSignedEvent && post.signedEvent);
  const technicalTagsOnly = technicalTags.length > 0 && !hasSignedEventJson;
  const showTechnicalExpanded = technicalTagsOnly
    ? localTechnicalExpanded
    : showEventData;
  const showTechnicalBlock = technicalTags.length > 0 || hasSignedEventJson;

  const toggleTechnical = () => {
    if (technicalTagsOnly) {
      setLocalTechnicalExpanded((v) => !v);
    } else {
      onToggleEventData();
    }
  };

  return (
    <aside
      className={cn(
        "border-border bg-muted/10 flex max-h-full min-w-0 flex-col overflow-y-auto md:w-[30%] md:max-w-[320px] md:min-w-[260px]",
        "border-t md:border-t-0 md:border-l"
      )}
    >
      <div className={pad}>
        <RailSectionHeader className={RAIL_SECTION_LABEL}>
          Overview
        </RailSectionHeader>
        <div className="mt-1.5 space-y-2.5">
          <RailSettingsValueRow
            label="Status"
            value={statusLabel}
            trailing={null}
          />
          <RailSettingsValueRow
            label="Content"
            value={contentLabel}
            trailing={null}
          />
          {type === "draft" ? (
            <RailSettingsValueRow
              label="Created"
              value={formatDateFn(
                post.createdAt,
                false,
                userTimezone,
                userTimeFormat
              )}
              trailing={null}
            />
          ) : null}
          {type === "scheduled" &&
          "scheduledAtUtc" in post &&
          post.scheduledAtUtc ? (
            <RailSettingsValueRow
              label="Scheduled for"
              value={formatScheduledDateFn(
                post.scheduledAtUtc,
                userTimezone,
                userTimeFormat
              )}
              trailing={null}
            />
          ) : null}
          {type === "published" && post.publishedAt ? (
            <RailSettingsValueRow
              label="Posted at"
              value={formatDateFn(
                post.publishedAt,
                false,
                userTimezone,
                userTimeFormat
              )}
              trailing={null}
            />
          ) : null}
          {queueType ? (
            <div className="flex flex-col gap-1">
              <span className="text-foreground text-xs font-medium">Queue</span>
              <QueueTypeCalm queueType={queueType} />
            </div>
          ) : null}
          {userTags.length > 0 && !post.repost ? (
            <UserTagChips
              tags={userTags}
              expanded={tagsExpanded}
              onToggle={() => setTagsExpanded((v) => !v)}
            />
          ) : null}
          {type === "published" &&
          eventId &&
          openOnNostrUrl &&
          !engagementStats ? (
            <div className="flex flex-col gap-2 pt-1">
              <Link
                to={openOnNostrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
              >
                Open on Nostr
                <ChevronRight className={INLINE_ICON_SIZE_CLASS} aria-hidden />
              </Link>
              <Link
                to={viewThreadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
              >
                View thread
                <ChevronRight className={INLINE_ICON_SIZE_CLASS} aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>

        {showRelationshipRail ? (
          <>
            <div className={divide} />
            {relationshipType === "reply" && inReplyTo ? (
              <>
                <RailSectionHeader className={RAIL_SECTION_LABEL}>
                  In reply to
                </RailSectionHeader>
                <div className="mt-1.5">
                  <InReplyToBlock
                    authorLine={inReplyTo.authorLine}
                    snippet={inReplyTo.snippet}
                    viewThreadUrl={inReplyTo.viewThreadUrl}
                  />
                </div>
              </>
            ) : null}
            {relationshipType === "quote" && quotedPost ? (
              <>
                <RailSectionHeader className={RAIL_SECTION_LABEL}>
                  Quoted post
                </RailSectionHeader>
                <div className="mt-1.5">
                  <QuotedPostBlock
                    authorLine={quotedPost.authorLine}
                    snippet={quotedPost.snippet}
                    openUrl={quotedPost.openUrl}
                    hasMediaHint={quotedPost.hasMediaHint}
                  />
                </div>
              </>
            ) : null}
            {relationshipType === "repost" && repostedPost ? (
              <>
                <RailSectionHeader className={RAIL_SECTION_LABEL}>
                  Reposted post
                </RailSectionHeader>
                <div className="mt-1.5">
                  <RepostedPostBlock
                    authorLine={repostedPost.authorLine}
                    snippet={repostedPost.snippet}
                    openUrl={repostedPost.openUrl}
                  />
                </div>
              </>
            ) : null}
            {relationshipType === "thread_item" && threadContextPosition ? (
              <>
                <RailSectionHeader className={RAIL_SECTION_LABEL}>
                  Thread context
                </RailSectionHeader>
                <div className="mt-1.5">
                  <ThreadContextBlock positionLine={threadContextPosition} />
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {showStructure ? (
          <>
            <div className={divide} />
            <RailSectionHeader className={RAIL_SECTION_LABEL}>
              Structure
            </RailSectionHeader>
            <div className="mt-1.5 space-y-1">
              {structureRows.map((row) => (
                <RailSettingsValueRow
                  key={row.label + row.value}
                  label={row.label}
                  value={row.value}
                  trailing={null}
                />
              ))}
            </div>
          </>
        ) : null}

        {showRepliesSection ? (
          <>
            <div className={divide} />
            <RailSectionHeader className={RAIL_SECTION_LABEL}>
              Replies
            </RailSectionHeader>
            <div
              className="mt-1.5 space-y-2"
              aria-live="polite"
              aria-busy={isThreadLoading}
            >
              {isThreadLoading ? (
                <p className="text-muted-foreground text-xs">Loading…</p>
              ) : previewReplies.length > 0 ? (
                previewReplies.map((r) => (
                  <DetailModalReplySnippet
                    key={r.id || r.pubkey + r.created_at}
                    reply={r}
                    metadata={threadMetadata}
                  />
                ))
              ) : (
                <p className="text-muted-foreground text-xs">
                  Replies: {directReplies.length}
                </p>
              )}
              <Link
                to={viewThreadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
              >
                View thread
                <ChevronRight className={INLINE_ICON_SIZE_CLASS} aria-hidden />
              </Link>
            </div>
          </>
        ) : null}

        {engagementStats ? (
          <>
            <div className={divide} />
            <RailSectionHeader className={RAIL_SECTION_LABEL}>
              Engagement
            </RailSectionHeader>
            <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
              <div>
                <p className="text-foreground font-semibold tabular-nums">
                  {engagementStats.likes}
                </p>
                <p className="text-muted-foreground">Likes</p>
              </div>
              <div>
                <p className="text-foreground font-semibold tabular-nums">
                  {engagementStats.reposts}
                </p>
                <p className="text-muted-foreground">Reposts</p>
              </div>
              <div>
                <p className="text-foreground font-semibold tabular-nums">
                  {engagementStats.replies}
                </p>
                <p className="text-muted-foreground">Replies</p>
              </div>
              <div>
                <p className="text-foreground font-semibold tabular-nums">
                  {engagementStats.zaps}
                </p>
                <p className="text-muted-foreground">Zaps</p>
              </div>
              <div>
                <p className="text-foreground font-semibold tabular-nums">
                  {engagementStats.mentions}
                </p>
                <p className="text-muted-foreground">Mentions</p>
              </div>
              <div>
                <p className="text-foreground font-semibold tabular-nums">
                  {engagementStats.satszapped}
                </p>
                <p className="text-muted-foreground">Sats</p>
              </div>
            </div>
            {openOnNostrUrl ? (
              <Link
                to={openOnNostrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
              >
                Open on Nostr
                <ChevronRight className={INLINE_ICON_SIZE_CLASS} aria-hidden />
              </Link>
            ) : null}
          </>
        ) : null}

        {showTechnicalBlock ? (
          <>
            <div className={divide} />
            <div className="flex items-center justify-between gap-2">
              <RailSectionHeader
                className={cn(RAIL_SECTION_LABEL, "!mb-0 leading-none")}
              >
                Technical details
              </RailSectionHeader>
              <button
                type="button"
                onClick={toggleTechnical}
                aria-expanded={showTechnicalExpanded}
                aria-controls="post-detail-technical-block"
                className="text-muted-foreground hover:text-foreground text-[10px] font-medium"
              >
                {showTechnicalExpanded ? "Hide" : "Show"}
              </button>
            </div>
            {showTechnicalExpanded ? (
              <div id="post-detail-technical-block" className="mt-2 space-y-2">
                {technicalTags.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground mb-1 text-[10px] font-medium">
                      Tags (raw)
                    </p>
                    <pre className="bg-muted/40 text-foreground max-h-32 overflow-auto rounded-md p-2 text-[10px] break-words whitespace-pre-wrap">
                      {technicalTags.join("\n")}
                    </pre>
                  </div>
                ) : null}
                {hasSignedEventJson ? (
                  <pre
                    id="post-detail-signed-event"
                    className="bg-muted/40 text-foreground max-h-48 overflow-auto rounded-md p-2 text-[10px] break-words whitespace-pre-wrap"
                  >
                    {JSON.stringify(post.signedEvent, null, 2)}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}
