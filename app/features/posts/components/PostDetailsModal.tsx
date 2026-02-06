import type { Post } from "@prisma/client";
import { useFetcher, Link } from "@remix-run/react";
import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import MediaModal from "~/components/ui/MediaModal";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { ChildRepliesPanel } from "~/features/engagement/components/ChildRepliesPanel";
import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";
import { formatDate } from "~/features/posts/utils/content-helpers";
import { getImageUrls } from "~/lib/helpers";
import { useThreadView } from "~/lib/query/hooks/useApiQuery";
import { formatForDisplay, fromDate } from "~/lib/temporal";

import { getQueueColor } from "../queue-colors";
import type { CombinedContent, PostData } from "../types";

const MODAL_TITLE = "Post";

function getPostEventId(
  post: Post | PostData | CombinedContent,
  type: string
): string | null {
  if (type !== "posted") return null;
  const se = post.signedEvent;
  if (!se || typeof se !== "object" || !("id" in se)) return null;
  const id = (se as { id?: string }).id;
  return typeof id === "string" ? id : null;
}

function formatScheduledDate(
  scheduledAtUtc: Date | null | undefined,
  userTimezone: string | undefined,
  userTimeFormat: "12h" | "24h"
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
      userTimeFormat
    );
  } catch {
    return scheduledAtUtc.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: userTimeFormat === "12h",
    });
  }
}

function getDeleteButtonLabel(type: "draft" | "posted" | "scheduled"): string {
  switch (type) {
    case "draft":
      return "Delete Draft";
    case "scheduled":
      return "Delete Scheduled Post";
    default:
      return "Delete Post";
  }
}

function PostStatusBadge({ type }: { type: "draft" | "posted" | "scheduled" }) {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium";
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
  const colors = getQueueColor(queueType.name, queueType.color);
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${colors?.bg ?? ""} ${colors?.text ?? ""}`}
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

function PostDetailsMetadataGrid({
  type,
  post,
  queueType,
  formatDateFn,
  formatScheduledDateFn,
  userTimezone,
  userTimeFormat,
}: {
  type: "draft" | "posted" | "scheduled";
  post: Post | PostData | CombinedContent;
  queueType:
    | { name: string; color?: string | null; id?: string }
    | null
    | undefined;
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
  const card = "border-border bg-muted/30 rounded-lg border p-4";
  const label = "text-muted-foreground mb-1 text-sm font-medium";
  const label2 = "text-muted-foreground mb-2 text-sm font-medium";

  if (type === "draft") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={card}>
          <h3 className={label}>Created</h3>
          <p className="text-foreground">
            {formatDateFn(post.createdAt, false, userTimezone, userTimeFormat)}
          </p>
        </div>
        {queueType ? (
          <div className={card}>
            <h3 className={label2}>Queue Type</h3>
            <QueueTypeChip queueType={queueType} />
          </div>
        ) : null}
      </div>
    );
  }

  if (type === "scheduled") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {"scheduledAtUtc" in post && post.scheduledAtUtc ? (
          <div className={card}>
            <h3 className={label}>Scheduled For</h3>
            <p className="text-foreground">
              {formatScheduledDateFn(
                post.scheduledAtUtc,
                userTimezone,
                userTimeFormat
              )}
            </p>
          </div>
        ) : null}
        {queueType ? (
          <div className={card}>
            <h3 className={label2}>Queue Type</h3>
            <QueueTypeChip queueType={queueType} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {post.postedAt ? (
        <div className={card}>
          <h3 className={label}>Posted At</h3>
          <p className="text-foreground">
            {formatDateFn(post.postedAt, false, userTimezone, userTimeFormat)}
          </p>
        </div>
      ) : null}
      {queueType ? (
        <div className={card}>
          <h3 className={label2}>Queue Type</h3>
          <QueueTypeChip queueType={queueType} />
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
  type?: "draft" | "posted" | "scheduled";
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
  type = "posted",
  userTimezone,
  userTimeFormat = "12h",
}: PostDetailsModalProps) {
  const deleteFetcher = useFetcher();
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [activeMediaSrc, setActiveMediaSrc] = useState<string | null>(null);
  const [showEventData, setShowEventData] = useState(false);

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
  const showViewNote = type === "posted" && hasViewNoteLink(post);

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          hideCloseButton
          className="bg-card text-card-foreground border-border mx-4 flex max-h-[90vh] w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-2xl"
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
                className="text-foreground hover:bg-muted focus:ring-primary flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="bg-card flex-1 overflow-y-auto px-6 py-6">
            {post.fileUrl && post.fileUrl.length > 0 ? (
              <div className="mb-6">
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {getImageUrls(post.fileUrl).map((url, index) => (
                    <MediaThumbnail
                      // eslint-disable-next-line react/no-array-index-key -- Stable list of image URLs, no unique ID available
                      key={index}
                      src={url}
                      alt={`Post media ${index + 1}`}
                      className="ring-border h-48 w-auto flex-shrink-0 rounded-lg object-cover ring-1 shadow-sm"
                      onClick={() => {
                        setActiveMediaSrc(url);
                        setIsMediaOpen(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                  Caption
                </h3>
                <p className="text-foreground leading-relaxed">
                  {post.caption?.trim() ? post.caption : "No caption"}
                </p>
              </div>

              <PostDetailsMetadataGrid
                type={type}
                post={post}
                queueType={queueType}
                formatDateFn={formatDate}
                formatScheduledDateFn={formatScheduledDate}
                userTimezone={userTimezone}
                userTimeFormat={userTimeFormat}
              />

              {post.tags && post.tags.length > 0 && !post.repost ? (
                <div className="border-border bg-muted/30 rounded-lg border p-4">
                  <h3 className="text-muted-foreground mb-3 text-sm font-medium">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-muted text-foreground rounded-full px-3 py-1 text-sm font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {showStats && stats ? (
                <div className="border-border bg-muted/30 rounded-lg border p-4">
                  <h3 className="text-muted-foreground mb-3 text-sm font-medium">
                    Engagement Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div className="text-center">
                      <p className="text-foreground text-2xl font-bold">
                        {stats.likes}
                      </p>
                      <p className="text-muted-foreground text-sm">Likes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-foreground text-2xl font-bold">
                        {stats.replies}
                      </p>
                      <p className="text-muted-foreground text-sm">Replies</p>
                    </div>
                    <div className="text-center">
                      <p className="text-foreground text-2xl font-bold">
                        {stats.mentions}
                      </p>
                      <p className="text-muted-foreground text-sm">Mentions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-foreground text-2xl font-bold">
                        {stats.reposts}
                      </p>
                      <p className="text-muted-foreground text-sm">Reposts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-foreground text-2xl font-bold">
                        {stats.zaps}
                      </p>
                      <p className="text-muted-foreground text-sm">Zaps</p>
                    </div>
                    <div className="text-center">
                      <p className="text-foreground text-2xl font-bold">
                        {stats.satszapped}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Sats Zapped
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {type === "posted" && eventId ? (
                <section
                  className="border-border bg-muted/30 rounded-lg border p-4"
                  aria-labelledby="post-details-comments-heading"
                  aria-live="polite"
                  aria-busy={isThreadLoading}
                >
                  <h3
                    id="post-details-comments-heading"
                    className="text-muted-foreground mb-3 text-sm font-medium"
                  >
                    Comments ({directReplies.length})
                  </h3>
                  <div className="max-h-64 overflow-x-hidden overflow-y-auto">
                    <ChildRepliesPanel
                      isLoading={isThreadLoading}
                      replies={directReplies}
                      metadata={threadMetadata}
                    />
                  </div>
                </section>
              ) : null}

              {showSignedEvent && post.signedEvent ? (
                <div className="border-border bg-muted/30 rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-muted-foreground text-sm font-medium">
                      Signed Event Data
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowEventData(!showEventData)}
                      aria-expanded={showEventData}
                      aria-controls="signed-event-data"
                      className="text-primary focus:ring-primary text-xs hover:underline focus:ring-2 focus:ring-offset-1 focus:outline-none"
                    >
                      {showEventData ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showEventData ? (
                    <pre
                      id="signed-event-data"
                      className="bg-muted/50 text-foreground max-h-96 overflow-auto rounded-md p-3 text-xs break-words whitespace-pre-wrap"
                    >
                      {JSON.stringify(post.signedEvent, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-border bg-card/95 sticky bottom-0 border-t px-6 py-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-end gap-3">
              {type === "scheduled" && (onEdit || onReschedule) ? (
                <>
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(post)}
                      className="border-primary/30 bg-card text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-primary/25 inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    >
                      Edit
                    </button>
                  ) : null}
                  {onReschedule ? (
                    <button
                      type="button"
                      onClick={() => onReschedule(post)}
                      className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-primary/25 inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    >
                      Reschedule
                    </button>
                  ) : null}
                </>
              ) : null}
              {showViewNote ? (
                <Link
                  to={`https://primal.net/e/${post.signedEvent.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View note (opens in new tab)"
                  className="bg-muted text-foreground hover:bg-muted/80 focus:ring-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                >
                  View Note
                </Link>
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
                  className="border-destructive text-destructive hover:bg-destructive/10 focus:ring-primary focus:ring-offset-background inline-flex items-center rounded-lg border bg-transparent px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                >
                  {deleteFetcher.state !== "idle" &&
                  deleteFetcher.formData?.get("postId") === post.id
                    ? "Deleting..."
                    : getDeleteButtonLabel(type)}
                </button>
              </deleteFetcher.Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media full-screen modal */}
      <MediaModal
        src={activeMediaSrc ?? ""}
        isOpen={Boolean(isMediaOpen && activeMediaSrc)}
        onClose={() => setIsMediaOpen(false)}
      />
    </>
  );
}
