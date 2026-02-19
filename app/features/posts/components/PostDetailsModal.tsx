import type { Post } from "@prisma/client";
import { useFetcher, Link } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import MediaModal from "~/components/ui/MediaModal";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { ChildRepliesPanel } from "~/features/engagement/components/ChildRepliesPanel";
import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";
import { formatDate } from "~/features/posts/utils/content-helpers";
import { getImageUrls } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useThreadView } from "~/lib/query/hooks/useApiQuery";
import {
  formatForDisplay,
  fromDate,
  type DateDisplayLocale,
} from "~/lib/temporal";

import { getQueueColor } from "../queue-colors";
import type { CombinedContent, PostData } from "../types";

const MODAL_TITLE = "Post";

function getPostEventId(
  post: Post | PostData | CombinedContent,
  type: string
): string | null {
  if (type !== "published") return null;
  const se = post.signedEvent;
  if (!se || typeof se !== "object" || !("id" in se)) return null;
  const id = (se as { id?: string }).id;
  return typeof id === "string" ? id : null;
}

function formatScheduledDate(
  scheduledAtUtc: Date | null | undefined,
  userTimezone: string | undefined,
  userTimeFormat: "12h" | "24h",
  dateLocale: DateDisplayLocale = "en-GB"
): string {
  if (!scheduledAtUtc) return "Not scheduled";
  try {
    const tz = userTimezone ?? "UTC";
    const zoned = fromDate(scheduledAtUtc, "UTC");
    const userZoned = zoned.withTimeZone(tz);
    return formatForDisplay(
      userZoned,
      tz,
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
  } catch {
    return scheduledAtUtc.toLocaleDateString(dateLocale, {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: userTimeFormat === "12h",
    });
  }
}

function getDeleteButtonLabel(
  type: "draft" | "published" | "scheduled"
): string {
  switch (type) {
    case "draft":
      return "Delete Draft";
    case "scheduled":
      return "Delete Scheduled Post";
    default:
      return "Delete Post";
  }
}

function PostStatusBadge({
  type,
}: {
  type: "draft" | "published" | "scheduled";
}) {
  const base =
    "inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium";
  if (type === "draft")
    return (
      <span className={`${base} border-border bg-muted/50 text-foreground`}>
        Draft
      </span>
    );
  if (type === "scheduled")
    return (
      <span
        className={`${base} border-border bg-muted/50 text-muted-foreground`}
      >
        Scheduled
      </span>
    );
  return (
    <span className={`${base} border-success bg-success/10 text-success`}>
      Posted
    </span>
  );
}

function QueueTypeChip({
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
      className={`inline-flex items-center rounded-md border-2 px-3 py-1 text-sm font-medium capitalize ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {queueType.name}
    </span>
  );
}

function hasViewNoteLink(
  post: Post | PostData | CombinedContent
): post is Post & { signedEvent: { id: string } } {
  const se = post.signedEvent;
  return (
    !!se &&
    typeof se === "object" &&
    "id" in se &&
    typeof (se as { id?: string }).id === "string"
  );
}

/** One-line context under the post card: "Posted 2 Jun 2026, 4:00 PM · Queue" etc. */
function getPostContextLine(
  type: "draft" | "published" | "scheduled",
  post: Post | PostData | CombinedContent,
  queueType: { name: string } | null | undefined,
  formatDateFn: (
    date: Date | string,
    short: boolean,
    tz?: string,
    fmt?: "12h" | "24h"
  ) => string,
  formatScheduledDateFn: (
    d: Date | null | undefined,
    tz: string | undefined,
    fmt: "12h" | "24h"
  ) => string,
  userTimezone: string | undefined,
  userTimeFormat: "12h" | "24h"
): string {
  const queueName = queueType?.name ?? "";
  const sep = queueName ? " · " : "";
  if (type === "draft") return `Draft${sep}${queueName}`.trim();
  if (type === "scheduled" && "scheduledAtUtc" in post && post.scheduledAtUtc)
    return `Scheduled for ${formatScheduledDateFn(post.scheduledAtUtc, userTimezone, userTimeFormat)}${sep}${queueName}`.trim();
  if (type === "published" && post.publishedAt)
    return `Posted ${formatDateFn(post.publishedAt, false, userTimezone, userTimeFormat)}${sep}${queueName}`.trim();
  return queueName || "—";
}

function PostDetailsSidebar({
  type,
  post,
  queueType,
  showStats,
  stats,
  eventId,
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
}: {
  type: "draft" | "published" | "scheduled";
  post: Post | PostData | CombinedContent;
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
}) {
  const sectionTitle = "text-muted-foreground mb-2 text-sm font-medium";
  const block = "border-border bg-muted/30 rounded-lg border p-4";

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Details */}
      <div>
        <h3 className={sectionTitle}>Details</h3>
        <div className="space-y-3">
          {type === "draft" ? (
            <div>
              <span className="text-muted-foreground text-xs">Created</span>
              <p className="text-foreground text-sm">
                {formatDateFn(
                  post.createdAt,
                  false,
                  userTimezone,
                  userTimeFormat
                )}
              </p>
            </div>
          ) : null}
          {type === "scheduled" &&
          "scheduledAtUtc" in post &&
          post.scheduledAtUtc ? (
            <div>
              <span className="text-muted-foreground text-xs">
                Scheduled for
              </span>
              <p className="text-foreground text-sm">
                {formatScheduledDateFn(
                  post.scheduledAtUtc,
                  userTimezone,
                  userTimeFormat
                )}
              </p>
            </div>
          ) : null}
          {type === "published" && post.publishedAt ? (
            <div>
              <span className="text-muted-foreground text-xs">Posted at</span>
              <p className="text-foreground text-sm">
                {formatDateFn(
                  post.publishedAt,
                  false,
                  userTimezone,
                  userTimeFormat
                )}
              </p>
            </div>
          ) : null}
          {queueType ? (
            <div>
              <span className="text-muted-foreground text-xs">Queue</span>
              <div className="mt-0.5">
                <QueueTypeChip queueType={queueType} />
              </div>
            </div>
          ) : null}
          {post.tags && post.tags.length > 0 && !post.repost ? (
            <div>
              <span className="text-muted-foreground text-xs">Tags</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-muted text-foreground rounded-full px-2 py-0.5 text-xs font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Engagement */}
      {showStats && stats ? (
        <div className={block}>
          <h3 className={sectionTitle}>Engagement</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-foreground text-xl font-bold">{stats.likes}</p>
              <p className="text-muted-foreground text-xs">Likes</p>
            </div>
            <div className="text-center">
              <p className="text-foreground text-xl font-bold">
                {stats.replies}
              </p>
              <p className="text-muted-foreground text-xs">Replies</p>
            </div>
            <div className="text-center">
              <p className="text-foreground text-xl font-bold">
                {stats.mentions}
              </p>
              <p className="text-muted-foreground text-xs">Mentions</p>
            </div>
            <div className="text-center">
              <p className="text-foreground text-xl font-bold">
                {stats.reposts}
              </p>
              <p className="text-muted-foreground text-xs">Reposts</p>
            </div>
            <div className="text-center">
              <p className="text-foreground text-xl font-bold">{stats.zaps}</p>
              <p className="text-muted-foreground text-xs">Zaps</p>
            </div>
            <div className="text-center">
              <p className="text-foreground text-xl font-bold">
                {stats.satszapped}
              </p>
              <p className="text-muted-foreground text-xs">Sats</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Comments (posted only) */}
      {type === "published" && eventId ? (
        <section
          className={block}
          aria-labelledby="post-details-comments-heading"
          aria-live="polite"
          aria-busy={isThreadLoading}
        >
          <h3 id="post-details-comments-heading" className={sectionTitle}>
            Comments ({directReplies.length})
          </h3>
          <div className="max-h-64 overflow-x-hidden overflow-y-auto">
            <ChildRepliesPanel
              isLoading={isThreadLoading}
              replies={directReplies}
              metadata={threadMetadata}
            />
          </div>
          <Link
            to={`https://primal.net/e/${eventId}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View thread (opens in new tab)"
            className="text-primary mt-2 inline-block text-sm font-medium hover:underline"
          >
            View thread
          </Link>
        </section>
      ) : null}

      {/* Technical */}
      {showSignedEvent && post.signedEvent ? (
        <div className={block}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className={sectionTitle}>Technical details</h3>
            <button
              type="button"
              onClick={onToggleEventData}
              aria-expanded={showEventData}
              aria-controls="signed-event-data"
              className="text-primary focus:ring-ring text-xs hover:underline focus:ring-2 focus:ring-offset-0 focus:outline-none"
            >
              {showEventData ? "Hide" : "Show"}
            </button>
          </div>
          {showEventData ? (
            <pre
              id="signed-event-data"
              className="bg-muted/50 text-foreground max-h-64 overflow-auto rounded-md p-3 text-xs break-words whitespace-pre-wrap"
            >
              {JSON.stringify(post.signedEvent, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface PostDetailsModalProps {
  post: Post | PostData | CombinedContent;
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  onClose: () => void;
  onEdit?: (post: Post | PostData | CombinedContent) => void;
  onReschedule?: (post: Post | PostData | CombinedContent) => void;
  showStats?: boolean;
  showSignedEvent?: boolean;
  type?: "draft" | "published" | "scheduled";
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
}

export default function PostDetailsModal({
  post,
  stats,
  onClose,
  onEdit,
  onReschedule,
  showStats = false,
  showSignedEvent = false,
  type = "published",
  userTimezone,
  userTimeFormat = "12h",
}: PostDetailsModalProps) {
  const deleteFetcher = useFetcher();
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [activeMediaSrc, setActiveMediaSrc] = useState<string | null>(null);
  const [showEventData, setShowEventData] = useState(false);

  // Close modal when delete completes successfully (e.g. from Flow or Scheduled section)
  useEffect(() => {
    if (deleteFetcher.state !== "idle" || !deleteFetcher.data) return;
    const data = deleteFetcher.data as { success?: boolean; error?: unknown };
    if (data.error || !data.success) return;
    const formData = deleteFetcher.formData as FormData | undefined;
    const submittedPostId = formData?.get("postId");
    const isOurDelete =
      formData?.get("_action") === "delete" &&
      (submittedPostId === post.id ||
        String(submittedPostId) === String(post.id));
    if (isOurDelete) {
      onClose();
    }
  }, [
    deleteFetcher.state,
    deleteFetcher.data,
    deleteFetcher.formData,
    post.id,
    onClose,
  ]);

  const hasQueueType = (
    p: Post | PostData | CombinedContent
  ): p is PostData | CombinedContent => "queueType" in p;
  const queueType = hasQueueType(post) ? post.queueType : null;
  const eventId = getPostEventId(post, type);

  const { data: threadData, isPending: isThreadLoading } =
    useThreadView(eventId);

  const directReplies = useMemo((): ChildReply[] => {
    if (!eventId || !threadData?.events || !Array.isArray(threadData.events))
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
        return eTags.some((t) => t[1] === eventId);
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
  }, [eventId, threadData?.events]);

  const threadMetadata = threadData?.metadata ?? {};
  const showViewNote = type === "published" && hasViewNoteLink(post);

  const { dateLocale } = useFormattedDate();
  const formatDateWithLocale = useCallback(
    (date: Date | string, short: boolean, tz?: string, fmt?: "12h" | "24h") =>
      formatDate(
        date,
        short,
        tz ?? userTimezone,
        fmt ?? userTimeFormat,
        dateLocale
      ),
    [dateLocale, userTimezone, userTimeFormat]
  );
  const formatScheduledDateWithLocale = useCallback(
    (d: Date | null | undefined, tz: string | undefined, fmt: "12h" | "24h") =>
      formatScheduledDate(d, tz, fmt, dateLocale),
    [dateLocale]
  );

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          hideCloseButton
          className="bg-card text-card-foreground border-border flex max-h-[90dvh] w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-2xl"
        >
          <div className="border-border bg-card/95 sticky top-0 z-10 border-b px-6 py-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-foreground text-xl font-semibold">
                  {MODAL_TITLE}
                </DialogTitle>
                <PostStatusBadge type={type} />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-foreground hover:bg-muted focus:ring-ring flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Two panels: post card (left) + sidebar (right); stack on small screens */}
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Left: post card */}
            <div className="border-border flex-1 overflow-y-auto md:border-r">
              <div className="border-border bg-card mx-4 mt-4 mb-4 rounded-lg border p-6 md:mx-6 md:mt-6 md:mb-6">
                {post.fileUrl && post.fileUrl.length > 0 ? (
                  <div className="mb-4 overflow-hidden rounded-lg">
                    <div className="flex max-h-[420px] gap-3 overflow-x-auto pb-2">
                      {getImageUrls(post.fileUrl).map((url, index) => (
                        <MediaThumbnail
                          key={url}
                          src={url}
                          alt={`Post media ${index + 1}`}
                          className="ring-border h-48 max-h-[400px] w-auto flex-shrink-0 rounded-lg object-cover ring-1 shadow-sm"
                          onClick={() => {
                            setActiveMediaSrc(url);
                            setIsMediaOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mb-3">
                  <h3 className="text-muted-foreground mb-1 text-sm font-medium">
                    Caption
                  </h3>
                  <p
                    className={
                      post.caption?.trim()
                        ? "text-foreground leading-relaxed"
                        : "text-muted-foreground leading-relaxed italic"
                    }
                  >
                    {post.caption?.trim() ? post.caption : "No caption"}
                  </p>
                </div>
                <p className="text-muted-foreground text-sm">
                  {getPostContextLine(
                    type,
                    post,
                    queueType,
                    formatDate,
                    formatScheduledDateWithLocale,
                    userTimezone,
                    userTimeFormat
                  )}
                </p>
              </div>
            </div>

            {/* Right: sidebar */}
            <div className="border-border bg-muted/20 overflow-y-auto md:w-80 md:flex-shrink-0">
              <PostDetailsSidebar
                type={type}
                post={post}
                queueType={queueType}
                showStats={showStats}
                stats={stats}
                eventId={eventId}
                directReplies={directReplies}
                isThreadLoading={isThreadLoading}
                threadMetadata={threadMetadata}
                showSignedEvent={showSignedEvent}
                showEventData={showEventData}
                onToggleEventData={() => setShowEventData((v) => !v)}
                formatDateFn={formatDateWithLocale}
                formatScheduledDateFn={formatScheduledDateWithLocale}
                userTimezone={userTimezone}
                userTimeFormat={userTimeFormat}
              />
            </div>
          </div>

          {/* Footer: primary action first, then secondary, Delete de-emphasized */}
          <div className="border-border bg-card/95 sticky bottom-0 border-t px-6 py-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-end gap-3">
              {type === "published" && showViewNote ? (
                <Link
                  to={`https://primal.net/e/${post.signedEvent.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View note (opens in new tab)"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
                >
                  View Note
                </Link>
              ) : null}
              {type === "scheduled" && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(post)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
                >
                  Edit
                </button>
              ) : null}
              {type === "scheduled" && onReschedule ? (
                <button
                  type="button"
                  onClick={() => onReschedule(post)}
                  className="border-border bg-card text-foreground hover:bg-muted focus:ring-ring inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
                >
                  Reschedule
                </button>
              ) : null}

              <deleteFetcher.Form
                method="post"
                onClick={(e) => e.stopPropagation()}
              >
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="_action" value="delete" />
                <button
                  type="submit"
                  disabled={deleteFetcher.state !== "idle"}
                  className="border-destructive text-destructive hover:bg-destructive/10 focus:ring-ring inline-flex items-center rounded-lg border bg-transparent px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none disabled:opacity-50"
                >
                  {deleteFetcher.state !== "idle" &&
                  deleteFetcher.formData?.get("postId") === post.id
                    ? "Deleting..."
                    : getDeleteButtonLabel(type)}
                </button>
              </deleteFetcher.Form>
            </div>
          </div>

          {/* Media full-screen modal: rendered inside DialogContent so closing it does not close the dialog */}
          <MediaModal
            src={activeMediaSrc ?? ""}
            isOpen={Boolean(isMediaOpen && activeMediaSrc)}
            onClose={() => setIsMediaOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
