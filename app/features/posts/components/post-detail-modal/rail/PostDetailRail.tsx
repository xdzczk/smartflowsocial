import { Link } from "@remix-run/react";
import { ChevronRight } from "lucide-react";

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

import type { PostDetailModalPost } from "../post-detail-helpers";
import type { PostThreadGroupResponse } from "../usePostThreadGroup";

import { DetailModalReplySnippet } from "./DetailModalReplySnippet";

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

// eslint-disable-next-line sonarjs/cognitive-complexity -- conditional rail sections
export function PostDetailRail({
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
  typeLabel,
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
  typeLabel: string;
}) {
  const pad = cn(RAIL_PAD_X, RAIL_ZONE_PY, "flex flex-col gap-0");
  const divide = cn(RAIL_MAJOR_DIVIDE, "my-3");

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

  return (
    <aside
      className={cn(
        "border-border bg-muted/10 flex max-h-full min-w-0 flex-col overflow-y-auto md:w-[30%] md:max-w-[320px] md:min-w-[260px]",
        "border-t md:border-t-0 md:border-l"
      )}
    >
      <div className={pad}>
        <RailSectionHeader>Overview</RailSectionHeader>
        <div className="mt-2 space-y-2.5">
          <RailSettingsValueRow
            label="Status"
            value={statusLabel}
            trailing={null}
          />
          <RailSettingsValueRow
            label="Type"
            value={typeLabel}
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
          {post.tags && post.tags.length > 0 && !post.repost ? (
            <div className="flex flex-col gap-1">
              <span className="text-foreground text-xs font-medium">Tags</span>
              <div className="flex flex-wrap gap-1">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-muted text-foreground rounded px-1.5 py-0.5 text-[10px] font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
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

        {showStructure ? (
          <>
            <div className={divide} />
            <RailSectionHeader>Structure</RailSectionHeader>
            <div className="mt-2 space-y-1">
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

        {type === "published" && eventId ? (
          <>
            <div className={divide} />
            <RailSectionHeader>Replies</RailSectionHeader>
            <div
              className="mt-2 space-y-2"
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
            <RailSectionHeader>Engagement</RailSectionHeader>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
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

        {showSignedEvent && post.signedEvent ? (
          <>
            <div className={divide} />
            <div className="flex items-center justify-between gap-2">
              <RailSectionHeader className="mb-0">
                Technical details
              </RailSectionHeader>
              <button
                type="button"
                onClick={onToggleEventData}
                aria-expanded={showEventData}
                aria-controls="post-detail-signed-event"
                className="text-muted-foreground hover:text-foreground text-[10px] font-medium"
              >
                {showEventData ? "Hide" : "Show"}
              </button>
            </div>
            {showEventData ? (
              <pre
                id="post-detail-signed-event"
                className="bg-muted/40 text-foreground mt-2 max-h-48 overflow-auto rounded-md p-2 text-[10px] break-words whitespace-pre-wrap"
              >
                {JSON.stringify(post.signedEvent, null, 2)}
              </pre>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}
