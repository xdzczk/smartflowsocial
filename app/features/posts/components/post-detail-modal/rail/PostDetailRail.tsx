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
  "normal-case tracking-tight text-muted-foreground/75 !mb-1.5 text-[10px] font-medium"
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
  stateSectionMode,
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
  stateSectionMode: "performance" | "actions";
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
  const contentRows = [...structureRows];
  if (relationshipType === "reply" && inReplyTo) {
    contentRows.push({ label: "Reply target", value: "Present" });
  }
  if (relationshipType === "quote" && quotedPost) {
    contentRows.push({ label: "Quoted post", value: "Attached" });
  }
  if (relationshipType === "repost" && repostedPost) {
    contentRows.push({ label: "Reposted source", value: "Present" });
  }
  const showContent = contentRows.length > 0 || userTags.length > 0;
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
    stateSectionMode === "performance" &&
    (relationshipType === "repost"
      ? false
      : relationshipType === "original"
        ? showRepliesOriginal
        : showRepliesSecondary);

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
        "border-border/70 bg-background/60 flex max-h-full min-w-0 flex-col overflow-y-auto md:w-[34%] md:max-w-[380px] md:min-w-[320px]",
        "border-t md:border-t-0 md:border-l"
      )}
    >
      <div className={pad}>
        <RailSectionHeader className={RAIL_SECTION_LABEL}>
          Publishing
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
            <div className="flex flex-col gap-1.5">
              <span className="text-foreground text-xs font-medium">Queue</span>
              <QueueTypeCalm queueType={queueType} />
            </div>
          ) : null}
        </div>

        {showContent ? (
          <>
            <div className={divide} />
            <RailSectionHeader className={RAIL_SECTION_LABEL}>
              Content
            </RailSectionHeader>
            <div className="mt-1.5 space-y-1.5">
              {contentRows.map((row) => (
                <RailSettingsValueRow
                  key={row.label + row.value}
                  label={row.label}
                  value={row.value}
                  trailing={null}
                />
              ))}
              {relationshipType === "reply" && inReplyTo ? (
                <InReplyToBlock
                  authorLine={inReplyTo.authorLine}
                  snippet={inReplyTo.snippet}
                  viewThreadUrl={inReplyTo.viewThreadUrl}
                />
              ) : null}
              {relationshipType === "quote" && quotedPost ? (
                <QuotedPostBlock
                  authorLine={quotedPost.authorLine}
                  snippet={quotedPost.snippet}
                  openUrl={quotedPost.openUrl}
                  hasMediaHint={quotedPost.hasMediaHint}
                />
              ) : null}
              {relationshipType === "repost" && repostedPost ? (
                <RepostedPostBlock
                  authorLine={repostedPost.authorLine}
                  snippet={repostedPost.snippet}
                  openUrl={repostedPost.openUrl}
                />
              ) : null}
              {relationshipType === "thread_item" && threadContextPosition ? (
                <ThreadContextBlock positionLine={threadContextPosition} />
              ) : null}
              {userTags.length > 0 && !post.repost ? (
                <UserTagChips
                  tags={userTags}
                  expanded={tagsExpanded}
                  onToggle={() => setTagsExpanded((v) => !v)}
                />
              ) : null}
            </div>
          </>
        ) : null}

        {stateSectionMode === "actions" ? (
          <>
            <div className={divide} />
            <RailSectionHeader className={RAIL_SECTION_LABEL}>
              Next steps
            </RailSectionHeader>
            <div className="mt-1.5 space-y-2">
              <RailSettingsValueRow
                label="Primary action"
                value={type === "scheduled" ? "Edit post" : "Review details"}
                trailing={null}
              />
              {type === "scheduled" ? (
                <RailSettingsValueRow
                  label="Secondary action"
                  value="Reschedule"
                  trailing={null}
                />
              ) : null}
              <p className="text-muted-foreground text-xs">
                {type === "scheduled"
                  ? "Use Edit and Reschedule to validate this post before it goes live."
                  : "No performance metrics are available for this state."}
              </p>
            </div>
          </>
        ) : null}

        {stateSectionMode === "performance" ? (
          <>
            <div className={divide} />
            <RailSectionHeader className={RAIL_SECTION_LABEL}>
              Performance
            </RailSectionHeader>
            {engagementStats ? (
              <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
                <div>
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {engagementStats.replies}
                  </p>
                  <p className="text-muted-foreground">Replies</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {engagementStats.likes}
                  </p>
                  <p className="text-muted-foreground">Likes</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {engagementStats.reposts}
                  </p>
                  <p className="text-muted-foreground">Reposts</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {engagementStats.zaps}
                  </p>
                  <p className="text-muted-foreground">Zaps</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {engagementStats.mentions}
                  </p>
                  <p className="text-muted-foreground">Mentions</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {engagementStats.satszapped}
                  </p>
                  <p className="text-muted-foreground">Sats</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1.5 text-xs">
                Performance metrics are not available yet.
              </p>
            )}
            <div className="mt-2 flex flex-col gap-2">
              {viewThreadUrl ? (
                <Link
                  to={viewThreadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
                >
                  View thread
                  <ChevronRight
                    className={INLINE_ICON_SIZE_CLASS}
                    aria-hidden
                  />
                </Link>
              ) : null}
              {openOnNostrUrl ? (
                <Link
                  to={openOnNostrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
                >
                  Open on Nostr
                  <ChevronRight
                    className={INLINE_ICON_SIZE_CLASS}
                    aria-hidden
                  />
                </Link>
              ) : null}
            </div>
          </>
        ) : null}

        {showRepliesSection ? (
          <>
            <div className={divide} />
            <RailSectionHeader className={RAIL_SECTION_LABEL}>
              Recent replies
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
              {viewThreadUrl ? (
                <Link
                  to={viewThreadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
                >
                  View thread
                  <ChevronRight
                    className={INLINE_ICON_SIZE_CLASS}
                    aria-hidden
                  />
                </Link>
              ) : null}
            </div>
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
