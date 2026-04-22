import { Link, useRouteLoaderData } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";
import { MarkdownPreview } from "~/features/posts/components/MarkdownPreview";
import {
  getDeleteButtonLabel,
  getLongFormPublishedEventId,
} from "~/features/posts/components/post-detail-modal/post-detail-helpers";
import { PostDetailHeader } from "~/features/posts/components/post-detail-modal/PostDetailHeader";
import { DetailModalReplySnippet } from "~/features/posts/components/post-detail-modal/rail/DetailModalReplySnippet";
import { getPostDetailStateConfig } from "~/features/posts/components/post-detail-modal/state-config";
import {
  RailSectionHeader,
  RailSettingsValueRow,
  RAIL_MAJOR_DIVIDE,
  RAIL_PAD_X,
  RAIL_ZONE_PY,
} from "~/features/posts/components/publishing-rail";
import { optimisticallyRemovePostIdsFromViews } from "~/features/posts/hooks/post-cache-prune";
import { invalidateDependentCaches } from "~/features/posts/hooks/useRefreshPostViews";
import { getQueueColor } from "~/features/posts/queue-colors";
import { ScheduledPostActionBar } from "~/features/posts/scheduled/components/ScheduledPostActionBar";
import type {
  LongFormPostType,
  LongFormPostData,
} from "~/features/posts/server";
import { buildActionUrl } from "~/features/posts/utils/remix-action-url";
import { handleErrorSafely } from "~/lib/error-handler.client";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { stripMarkdownToPlainText } from "~/lib/markdown-utils";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";
import { useThreadView } from "~/lib/query/hooks/useApiQuery";
import {
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  type DateDisplayLocale,
} from "~/lib/temporal";
import { cn } from "~/lib/utils";

function formatLongFormDate(
  dateInput: string | Date | number | undefined,
  userTimezone: string,
  userTimeFormat: "12h" | "24h",
  dateLocale: DateDisplayLocale = "en-GB"
): string {
  if (!dateInput) return "—";
  try {
    let zonedDateTime;
    if (typeof dateInput === "string") {
      const unixTimestamp = parseInt(dateInput, 10);
      if (!isNaN(unixTimestamp) && dateInput.length <= 13) {
        const timestamp =
          dateInput.length <= 10
            ? unixTimestamp
            : Math.floor(unixTimestamp / 1000);
        zonedDateTime = fromUnixTimestamp(timestamp, "UTC");
      } else {
        zonedDateTime = fromISOString(String(dateInput), "UTC");
      }
    } else if (typeof dateInput === "number") {
      const timestamp =
        dateInput.toString().length <= 10
          ? dateInput
          : Math.floor(dateInput / 1000);
      zonedDateTime = fromUnixTimestamp(timestamp, "UTC");
    } else {
      zonedDateTime = fromDate(new Date(dateInput), "UTC");
    }
    const userZoned = zonedDateTime.withTimeZone(userTimezone);
    return formatForDisplay(
      userZoned,
      userTimezone,
      {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: userTimeFormat === "12h",
      },
      userTimeFormat,
      dateLocale
    );
  } catch (error) {
    handleErrorSafely(error, {
      component: "LongFormDetailsModal",
      action: "formatDate",
    });
    const dateObj =
      typeof dateInput === "string"
        ? new Date(dateInput)
        : typeof dateInput === "number"
          ? new Date(dateInput * 1000)
          : dateInput;
    return dateObj.toLocaleDateString(dateLocale, {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: userTimeFormat === "12h",
      timeZone: userTimezone,
    });
  }
}

function getLongFormReadingTime(content: string | undefined): string {
  if (!content) return "0 min read";
  try {
    const plain = stripMarkdownToPlainText(content);
    const wordCount = plain.trim().split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200);
    return `${readingTime} min read`;
  } catch {
    return "— min read";
  }
}

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

// eslint-disable-next-line sonarjs/cognitive-complexity -- long-form rail: overview, tags, queue, engagement, technical
function LongFormDetailRail({
  type,
  post,
  eventId,
  tz,
  userTimeFormat,
  dateLocale,
  directReplies,
  isThreadLoading,
  threadMetadata,
  showSignedEvent,
  showEventData,
  onToggleEventData,
  openOnNostrUrl,
  viewThreadUrl,
  showStats,
  stats,
  stateSectionMode,
}: {
  type: "draft" | "scheduled" | "published";
  post: LongFormPostType | LongFormPostData;
  eventId: string | null | undefined;
  tz: string;
  userTimeFormat: "12h" | "24h";
  dateLocale: DateDisplayLocale;
  directReplies: ChildReply[];
  isThreadLoading: boolean;
  threadMetadata: Record<string, unknown>;
  showSignedEvent: boolean;
  showEventData: boolean;
  onToggleEventData: () => void;
  openOnNostrUrl: string | null;
  viewThreadUrl: string;
  showStats: boolean;
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  stateSectionMode: "performance" | "actions";
}) {
  const pad = cn(RAIL_PAD_X, RAIL_ZONE_PY, "flex flex-col gap-0");
  const divide = cn(RAIL_MAJOR_DIVIDE, "my-3");

  const dateLabel =
    type === "published"
      ? "Posted at"
      : type === "scheduled"
        ? "Scheduled for"
        : "Created";
  const dateValue =
    type === "published"
      ? (post.publishedAt ?? undefined)
      : type === "scheduled"
        ? (post.scheduledAtUtc ?? undefined)
        : post.createdAt;
  const dateStr = formatLongFormDate(dateValue, tz, userTimeFormat, dateLocale);

  const queueType =
    "queueType" in post && post.queueType && typeof post.queueType === "object"
      ? post.queueType
      : null;

  const statusLabel =
    type === "published"
      ? "Published"
      : type === "scheduled"
        ? "Scheduled"
        : "Draft";

  const previewReplies = directReplies.slice(0, 2);
  const readingTime = getLongFormReadingTime(post.content ?? undefined);
  const hasCover = Boolean(post.image?.trim());
  const engagementStats =
    type === "published" && showStats && stats && eventId ? stats : null;

  return (
    <aside
      className={cn(
        "border-border/70 bg-canvas/60 flex max-h-full min-w-0 flex-col overflow-y-auto md:w-[34%] md:max-w-[380px] md:min-w-[320px]",
        "border-t md:border-t-0 md:border-l"
      )}
    >
      <div className={pad}>
        <RailSectionHeader>Publishing</RailSectionHeader>
        <div className="mt-2 space-y-2.5">
          <RailSettingsValueRow
            label="Status"
            value={statusLabel}
            trailing={null}
          />
          <RailSettingsValueRow label="Type" value="Article" trailing={null} />
          <RailSettingsValueRow
            label={dateLabel}
            value={dateStr}
            trailing={null}
          />
          {queueType && "name" in queueType ? (
            <div className="flex flex-col gap-1">
              <span className="text-text text-xs font-medium">Queue</span>
              <QueueTypeCalm
                queueType={
                  queueType as {
                    name: string;
                    color?: string | null;
                    id?: string;
                  }
                }
              />
            </div>
          ) : null}
          {post.tags.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-text text-xs font-medium">Tags</span>
              <div className="flex flex-wrap gap-1">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-surface-hover text-text rounded-xs px-1.5 py-0.5 text-[10px] font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className={divide} />
        <RailSectionHeader>Content</RailSectionHeader>
        <div className="mt-2 space-y-1">
          <RailSettingsValueRow
            label="Reading time"
            value={readingTime}
            trailing={null}
          />
          <RailSettingsValueRow
            label="Cover"
            value={hasCover ? "Yes" : "No"}
            trailing={null}
          />
        </div>

        {stateSectionMode === "actions" ? (
          <>
            <div className={divide} />
            <RailSectionHeader>Next steps</RailSectionHeader>
            <div className="mt-2 space-y-2">
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
              <p className="text-text-secondary text-xs">
                {type === "scheduled"
                  ? "Use Edit and Reschedule to verify this article before publishing."
                  : "Performance metrics are only available once published."}
              </p>
            </div>
          </>
        ) : null}

        {stateSectionMode === "performance" ? (
          <>
            <div className={divide} />
            <RailSectionHeader>Performance</RailSectionHeader>
            {engagementStats ? (
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
                <div>
                  <p className="text-text font-semibold tabular-nums">
                    {engagementStats.replies}
                  </p>
                  <p className="text-text-secondary">Replies</p>
                </div>
                <div>
                  <p className="text-text font-semibold tabular-nums">
                    {engagementStats.likes}
                  </p>
                  <p className="text-text-secondary">Likes</p>
                </div>
                <div>
                  <p className="text-text font-semibold tabular-nums">
                    {engagementStats.reposts}
                  </p>
                  <p className="text-text-secondary">Reposts</p>
                </div>
                <div>
                  <p className="text-text font-semibold tabular-nums">
                    {engagementStats.zaps}
                  </p>
                  <p className="text-text-secondary">Zaps</p>
                </div>
                <div>
                  <p className="text-text font-semibold tabular-nums">
                    {engagementStats.mentions}
                  </p>
                  <p className="text-text-secondary">Mentions</p>
                </div>
                <div>
                  <p className="text-text font-semibold tabular-nums">
                    {engagementStats.satszapped}
                  </p>
                  <p className="text-text-secondary">Sats</p>
                </div>
              </div>
            ) : (
              <p className="text-text-secondary mt-2 text-xs">
                Performance metrics are not available yet.
              </p>
            )}
            <div className="stack-tight mt-2">
              {viewThreadUrl ? (
                <Link
                  to={viewThreadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
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
                  className="text-brand inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
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

        {stateSectionMode === "performance" &&
        type === "published" &&
        eventId ? (
          <>
            <div className={divide} />
            <RailSectionHeader>Recent replies</RailSectionHeader>
            <div
              className="mt-2 space-y-2"
              aria-live="polite"
              aria-busy={isThreadLoading}
            >
              {isThreadLoading ? (
                <p className="text-text-secondary text-xs">Loading…</p>
              ) : previewReplies.length > 0 ? (
                previewReplies.map((r) => (
                  <DetailModalReplySnippet
                    key={r.id || r.pubkey + r.created_at}
                    reply={r}
                    metadata={threadMetadata}
                  />
                ))
              ) : (
                <p className="text-text-secondary text-xs">
                  Replies: {directReplies.length}
                </p>
              )}
              {viewThreadUrl ? (
                <Link
                  to={viewThreadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
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
                aria-controls="longform-signed-event-data"
                className="text-text-secondary hover:text-text text-[10px] font-medium"
              >
                {showEventData ? "Hide" : "Show"}
              </button>
            </div>
            {showEventData ? (
              <pre
                id="longform-signed-event-data"
                className="bg-surface-hover/40 text-text mt-2 max-h-48 overflow-auto rounded-md p-2 text-[10px] break-words whitespace-pre-wrap"
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

interface LongFormDetailsModalProps {
  post: LongFormPostType | LongFormPostData;
  onClose: () => void;
  onEdit?: (post: LongFormPostType | LongFormPostData) => void;
  onReschedule?: (post: LongFormPostType | LongFormPostData) => void;
  type: "draft" | "scheduled" | "published";
  showSignedEvent?: boolean;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onDeleted?: (postId: string) => void;
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  showStats?: boolean;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- article detail: delete, nostr, media, actions
export default function LongFormDetailsModal({
  post,
  onClose,
  onEdit,
  onReschedule,
  type,
  showSignedEvent = false,
  userTimezone = "UTC",
  userTimeFormat = "12h",
  onDeleted,
  stats,
  showStats = false,
}: LongFormDetailsModalProps) {
  const { dateLocale } = useFormattedDate();
  const [showEventData, setShowEventData] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const rootData = useRouteLoaderData("root") as
    | {
        user?: {
          preferredNostrClient?: string;
          customNostrClientBaseUrl?: string | null;
        } | null;
      }
    | undefined;
  const nostrUrls = useMemo(
    () => getNostrClientUrlsFromUser(rootData?.user),
    [rootData?.user]
  );

  const handleDelete = useCallback(() => {
    const postId = post.id;
    setIsDeleting(true);
    optimisticallyRemovePostIdsFromViews(queryClient, [postId]);
    onDeleted?.(postId);
    onClose();

    const formData = new FormData();
    formData.append("_action", "deleteLongForm");
    formData.append("postId", postId);
    void (async () => {
      try {
        const url = buildActionUrl(window.location.pathname);
        const resp = await fetch(url, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        const json = (await resp.json().catch(() => null)) as {
          cascadeDeletedIds?: string[];
        } | null;
        const cascadeIds = json?.cascadeDeletedIds;
        if (cascadeIds && cascadeIds.length > 0) {
          optimisticallyRemovePostIdsFromViews(queryClient, cascadeIds);
        }
      } finally {
        invalidateDependentCaches(queryClient);
      }
    })();
  }, [post.id, queryClient, onDeleted, onClose]);

  const eventId =
    type === "published" ? getLongFormPublishedEventId(post) : null;
  const eventIdForThread = eventId;

  const { data: threadData, isPending: isThreadLoading } =
    useThreadView(eventIdForThread);

  const directReplies = useMemo((): ChildReply[] => {
    const rootId = eventIdForThread ?? "";
    if (!rootId || !threadData?.events || !Array.isArray(threadData.events))
      return [];
    const events = threadData.events as Array<{
      id?: string;
      pubkey?: string;
      content?: string;
      created_at?: number;
      tags?: string[][];
    }>;
    return events
      .filter((event) => {
        const eTags = Array.isArray(event.tags)
          ? event.tags.filter((t) => Array.isArray(t) && t[0] === "e")
          : [];
        return eTags.some((t) => t[1] === rootId);
      })
      .map(
        (event): ChildReply => ({
          id: event.id ?? "",
          pubkey: event.pubkey ?? "",
          content: event.content ?? "",
          created_at: event.created_at ?? 0,
          tags: event.tags,
        })
      );
  }, [eventIdForThread, threadData?.events]);

  const threadMetadata = threadData?.metadata ?? {};
  const tz = userTimezone;

  const articleIdStr = getLongFormPublishedEventId(post) ?? "";
  const openOnNostrUrl =
    type === "published" && articleIdStr
      ? nostrUrls.articleUrl(articleIdStr)
      : null;
  const viewThreadUrl =
    eventIdForThread && eventIdForThread.length > 0
      ? nostrUrls.eventUrl(eventIdForThread)
      : "";

  const metaLine = formatLongFormDate(
    type === "published"
      ? (post.publishedAt ?? undefined)
      : type === "scheduled"
        ? (post.scheduledAtUtc ?? undefined)
        : post.createdAt,
    tz,
    userTimeFormat,
    dateLocale
  );

  const deleteForm = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isDeleting}
      className="text-danger/85 hover:bg-danger/10 hover:text-danger"
      onClick={(e) => {
        e.stopPropagation();
        handleDelete();
      }}
    >
      {isDeleting
        ? "Deleting..."
        : type === "scheduled"
          ? getDeleteButtonLabel("scheduled")
          : type === "draft"
            ? "Delete Draft"
            : "Delete Article"}
    </Button>
  );

  const statusType: "draft" | "published" | "scheduled" =
    type === "published"
      ? "published"
      : type === "scheduled"
        ? "scheduled"
        : "draft";
  const stateConfig = getPostDetailStateConfig(type);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="bg-surface-overlay text-text border-border/80 shadow-3 flex max-h-[86dvh] w-full max-w-[min(1200px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-xl p-0"
      >
        <PostDetailHeader
          typeLabel="Article"
          statusType={statusType}
          publishedPillLabel="Published"
          subtitle={
            type === "scheduled"
              ? `${stateConfig.headerPrefix} ${metaLine}`
              : type === "published"
                ? `${stateConfig.headerPrefix} ${metaLine}`
                : `${stateConfig.headerPrefix} ${metaLine}`
          }
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
          <div className="border-border/70 min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6 md:w-[66%] md:max-w-[68%] md:border-r">
            <div className="mx-auto max-w-3xl">
              <div className="border-border/70 bg-surface-hover/20 rounded-xl border p-5 md:p-6">
                <p className="text-text-secondary mb-4 text-sm">
                  {metaLine}
                  <span className="mx-2">·</span>
                  {getLongFormReadingTime(post.content ?? undefined)}
                </p>

                <h1 className="text-text mb-6 text-2xl leading-tight font-semibold tracking-tight md:text-3xl">
                  {post.title ?? "Untitled Article"}
                </h1>

                {post.image ? (
                  <div className="border-border/60 bg-surface-hover/35 mb-6 overflow-hidden rounded-xl border">
                    <img
                      src={post.image}
                      alt=""
                      className="max-h-[min(54vh,560px)] w-full object-contain"
                    />
                  </div>
                ) : null}

                {post.summary ? (
                  <div className="border-border/60 bg-canvas/55 mb-6 rounded-lg border px-4 py-3">
                    <p className="text-text-secondary text-base leading-relaxed">
                      {post.summary}
                    </p>
                  </div>
                ) : null}

                <div className="text-text text-[1.05rem] leading-relaxed">
                  <MarkdownPreview source={post.content ?? ""} />
                </div>

                {post.tags.length > 0 ? (
                  <>
                    <Separator className="mt-8 mb-3" />
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span key={tag} className="text-text-secondary text-sm">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <LongFormDetailRail
            type={type}
            post={post}
            eventId={eventId}
            tz={tz}
            userTimeFormat={userTimeFormat}
            dateLocale={dateLocale}
            directReplies={directReplies}
            isThreadLoading={isThreadLoading}
            threadMetadata={threadMetadata}
            showSignedEvent={showSignedEvent}
            showEventData={showEventData}
            onToggleEventData={() => setShowEventData((v) => !v)}
            openOnNostrUrl={openOnNostrUrl}
            viewThreadUrl={viewThreadUrl}
            showStats={Boolean(showStats && type === "published")}
            stats={stats}
            stateSectionMode={stateConfig.sectionMode}
          />
        </div>

        {type === "scheduled" ? (
          <ScheduledPostActionBar
            onEdit={onEdit ? () => onEdit(post) : undefined}
            onReschedule={onReschedule ? () => onReschedule(post) : undefined}
            openFullEditorHref={`/dashboard/compose?scheduled=${post.id}`}
            openFullEditorLabel="Open in full editor"
            deleteForm={deleteForm}
          />
        ) : (
          <div className="border-border/70 bg-surface/95 shrink-0 border-t px-6 py-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-text-secondary min-h-[36px] text-xs">
                {deleteForm}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {type === "published" && openOnNostrUrl ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={openOnNostrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open on Nostr (opens in new tab)"
                    >
                      Open on Nostr
                    </Link>
                  </Button>
                ) : null}
                {type === "published" && eventIdForThread ? (
                  <Button variant="default" size="sm" asChild>
                    <Link
                      to={viewThreadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View thread (opens in new tab)"
                    >
                      View thread
                    </Link>
                  </Button>
                ) : null}
                {type === "draft" ? (
                  <Button variant="default" size="sm" asChild>
                    <Link to={`/dashboard/drafts/longform/edit/${post.id}`}>
                      Edit Draft
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
