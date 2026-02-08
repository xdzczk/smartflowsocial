import { useFetcher, Link } from "@remix-run/react";
import { useMemo, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { ChildRepliesPanel } from "~/features/engagement/components/ChildRepliesPanel";
import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";
import type {
  LongFormPostType,
  LongFormPostData,
} from "~/features/posts/server";
import { handleErrorSafely } from "~/lib/error-handler.client";
import { stripMarkdownToPlainText } from "~/lib/markdown-utils";
import { useThreadView } from "~/lib/query/hooks/useApiQuery";
import {
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
} from "~/lib/temporal";

import { MarkdownPreview } from "./MarkdownPreview";

function formatLongFormDate(
  dateInput: string | Date | number | undefined,
  userTimezone: string,
  userTimeFormat: "12h" | "24h"
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
      userTimeFormat
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
    return dateObj.toLocaleDateString("en-US", {
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

function LongFormStatusBadge({
  type,
}: {
  type: "draft" | "scheduled" | "posted";
}) {
  if (type === "draft") {
    return (
      <Badge
        variant="secondary"
        className="bg-muted text-foreground dark:bg-muted dark:text-foreground"
      >
        Draft
      </Badge>
    );
  }
  if (type === "scheduled") {
    return (
      <Badge
        variant="secondary"
        className="bg-muted text-foreground dark:bg-primary/90/10 dark:text-foreground"
      >
        Scheduled
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-success/20 text-success dark:bg-success/10 dark:text-success"
    >
      Published
    </Badge>
  );
}

const LONGFORM_MODAL_TITLE = "Article";

function LongFormDetailsSidebar({
  type,
  post,
  eventId,
  tz,
  userTimeFormat,
  directReplies,
  isThreadLoading,
  threadMetadata,
  showSignedEvent,
  showEventData,
  onToggleEventData,
}: {
  type: "draft" | "scheduled" | "posted";
  post: LongFormPostType | LongFormPostData;
  eventId: string | null | undefined;
  tz: string;
  userTimeFormat: "12h" | "24h";
  directReplies: ChildReply[];
  isThreadLoading: boolean;
  threadMetadata: Record<string, unknown>;
  showSignedEvent: boolean;
  showEventData: boolean;
  onToggleEventData: () => void;
}) {
  const dateLabel =
    type === "posted"
      ? "Published"
      : type === "scheduled"
        ? "Scheduled For"
        : "Created";
  const dateValue =
    type === "posted"
      ? (post.publishedAt ?? undefined)
      : type === "scheduled"
        ? (post.scheduledAtUtc ?? undefined)
        : post.createdAt;

  return (
    <div className="border-border dark:border-border w-80 overflow-y-auto border-l">
      <div className="space-y-6 p-6">
        <div>
          <h3 className="text-muted-foreground dark:text-foreground mb-3 text-sm font-medium">
            Article Details
          </h3>
          <div className="space-y-4">
            <div>
              <span className="text-muted-foreground dark:text-foreground text-xs">
                Status
              </span>
              <div className="mt-1">
                <LongFormStatusBadge type={type} />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground dark:text-foreground text-xs">
                {dateLabel}
              </span>
              <p className="text-foreground mt-1 text-sm dark:text-white">
                {formatLongFormDate(dateValue, tz, userTimeFormat)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground dark:text-foreground text-xs">
                Reading Time
              </span>
              <p className="text-foreground mt-1 text-sm dark:text-white">
                {getLongFormReadingTime(post.content ?? undefined)}
              </p>
            </div>
            {post.tags.length > 0 ? (
              <div>
                <span className="text-muted-foreground dark:text-foreground text-xs">
                  Tags
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="dark:bg-card bg-muted text-muted-foreground dark:text-foreground rounded px-2 py-1 text-xs"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {type === "posted" && eventId ? (
          <section
            className="dark:bg-card bg-muted/30 border-border mt-6 rounded-lg border p-4"
            aria-labelledby="longform-comments-heading"
            aria-live="polite"
            aria-busy={isThreadLoading}
          >
            <h3
              id="longform-comments-heading"
              className="text-muted-foreground dark:text-foreground mb-3 text-sm font-medium"
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
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-muted-foreground dark:text-foreground text-sm font-medium">
                Signed Event Data
              </h3>
              <button
                type="button"
                onClick={onToggleEventData}
                aria-expanded={showEventData}
                aria-controls="longform-signed-event-data"
                className="text-primary dark:text-muted-foreground focus:ring-ring text-xs hover:underline focus:ring-2 focus:ring-offset-0 focus:outline-none"
              >
                {showEventData ? "Hide" : "Show"}
              </button>
            </div>
            {showEventData ? (
              <div
                id="longform-signed-event-data"
                className="dark:bg-card bg-muted rounded-lg p-3"
              >
                <pre className="text-foreground dark:text-foreground max-h-64 overflow-auto text-xs break-words whitespace-pre-wrap">
                  {JSON.stringify(post.signedEvent, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface LongFormDetailsModalProps {
  post: LongFormPostType | LongFormPostData;
  onClose: () => void;
  onEdit?: (post: LongFormPostType | LongFormPostData) => void;
  onReschedule?: (post: LongFormPostType | LongFormPostData) => void;
  type: "draft" | "scheduled" | "posted";
  showSignedEvent?: boolean;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
}

export default function LongFormDetailsModal({
  post,
  onClose,
  onEdit,
  onReschedule,
  type,
  showSignedEvent = false,
  userTimezone = "UTC",
  userTimeFormat = "12h",
}: LongFormDetailsModalProps) {
  const [showEventData, setShowEventData] = useState(false);
  const deleteFetcher = useFetcher();

  const postWithEvent = post as {
    nostrEventId?: string;
    signedEvent?: { id?: string };
  };
  const eventId =
    type === "posted"
      ? (postWithEvent.nostrEventId ??
        (postWithEvent.signedEvent &&
        typeof postWithEvent.signedEvent === "object" &&
        "id" in postWithEvent.signedEvent &&
        typeof postWithEvent.signedEvent.id === "string"
          ? postWithEvent.signedEvent.id
          : undefined))
      : null;

  const { data: threadData, isPending: isThreadLoading } = useThreadView(
    eventId ?? null
  );

  const directReplies = useMemo((): ChildReply[] => {
    const rootId = eventId ?? "";
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
  }, [eventId, threadData?.events]);

  const threadMetadata = threadData?.metadata ?? {};
  const tz = userTimezone;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="dark:bg-card border-border flex max-h-[90dvh] w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-xl bg-white p-0 shadow-2xl"
      >
        {/* Header */}
        <div className="dark:border-border dark:bg-card/95 border-border sticky top-0 z-10 border-b bg-white/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-foreground text-xl font-semibold dark:text-white">
                {LONGFORM_MODAL_TITLE}
              </DialogTitle>
              <LongFormStatusBadge type={type} />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground focus:ring-ring flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Preview Panel */}
          <div className="flex-1 overflow-y-auto">
            {/* Article Preview - Primal/NOSTR style */}
            <div className="mx-auto max-w-3xl p-6">
              {/* Author Header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(255,77%,51%)] to-[hsl(255,97%,51%)] text-lg font-semibold text-white">
                  A
                </div>
                <div>
                  <div className="text-foreground font-semibold dark:text-white">
                    You
                  </div>
                </div>
                <div className="ml-auto">
                  <svg
                    className="text-foreground h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </div>
              </div>

              {/* Date and Reading Time */}
              <div className="text-muted-foreground dark:text-foreground mb-4 flex items-center gap-2 text-sm">
                <span>
                  {formatLongFormDate(
                    type === "posted"
                      ? (post.publishedAt ?? undefined)
                      : type === "scheduled"
                        ? (post.scheduledAtUtc ?? undefined)
                        : post.createdAt,
                    tz,
                    userTimeFormat
                  )}
                </span>
                <span>•</span>
                <span>{getLongFormReadingTime(post.content ?? undefined)}</span>
                <span>•</span>
                <span>via SmartFlow</span>
                <div className="ml-auto">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-foreground mb-6 text-3xl leading-tight font-bold dark:text-white">
                {post.title ?? "Untitled Article"}
              </h1>

              {/* Cover Image */}
              {post.image ? (
                <div className="mb-6 overflow-hidden rounded-2xl">
                  <img
                    src={post.image}
                    alt="Cover"
                    className="h-80 w-full object-cover"
                  />
                </div>
              ) : null}

              {/* Summary */}
              {post.summary ? (
                <div className="dark:bg-card bg-muted mb-6 rounded-xl p-6">
                  <p className="text-muted-foreground dark:text-foreground text-lg leading-relaxed font-medium">
                    {post.summary}
                  </p>
                </div>
              ) : null}

              {/* Content */}
              <div
                className="text-foreground dark:text-white"
                style={{
                  fontSize: "1.1rem",
                  lineHeight: "1.7",
                  color: "inherit",
                }}
              >
                <MarkdownPreview source={post.content ?? ""} />
              </div>

              {/* Tags */}
              {post.tags.length > 0 ? (
                <div className="border-border dark:border-border mt-8 flex items-center gap-2 border-t pt-6">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-primary dark:text-muted-foreground cursor-pointer text-sm hover:underline"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <LongFormDetailsSidebar
            type={type}
            post={post}
            eventId={eventId}
            tz={tz}
            userTimeFormat={userTimeFormat}
            directReplies={directReplies}
            isThreadLoading={isThreadLoading}
            threadMetadata={threadMetadata}
            showSignedEvent={showSignedEvent}
            showEventData={showEventData}
            onToggleEventData={() => setShowEventData((v) => !v)}
          />
        </div>

        {/* Footer */}
        <div className="dark:border-border dark:bg-card/95 border-border sticky bottom-0 border-t bg-white/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-3">
              {type === "scheduled" && (onEdit || onReschedule) ? (
                <>
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(post)}
                      className="dark:bg-card border-primary/30 text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-ring dark:border-border dark:text-foreground dark:hover:bg-muted/50 inline-flex items-center rounded-lg border bg-white px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
                    >
                      Edit
                    </button>
                  ) : null}
                  {onReschedule ? (
                    <button
                      type="button"
                      onClick={() => onReschedule(post)}
                      className="dark:bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-ring dark:border-border dark:text-success dark:hover:bg-muted/50 inline-flex items-center rounded-lg border bg-white px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
                    >
                      Reschedule
                    </button>
                  ) : null}
                </>
              ) : null}
              {type === "posted" &&
              (post.nostrEventId ??
                (typeof post.signedEvent === "object" &&
                post.signedEvent !== null &&
                "id" in post.signedEvent
                  ? (post.signedEvent as { id?: string }).id
                  : undefined)) ? (
                <Link
                  to={`https://primal.net/a/${String(post.nostrEventId ?? (typeof post.signedEvent === "object" && post.signedEvent !== null && "id" in post.signedEvent ? (post.signedEvent as { id?: string }).id : "") ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View article (opens in new tab)"
                  className="dark:bg-muted dark:hover:bg-muted/80 bg-muted hover:bg-muted focus:ring-ring inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
                >
                  View Article
                </Link>
              ) : null}

              {type === "draft" ? (
                <Link
                  to={`/dashboard/drafts/longform/edit/${post.id}`}
                  className="dark:bg-card border-border text-foreground hover:bg-muted focus:ring-ring dark:border-border dark:text-foreground dark:hover:bg-muted/50 inline-flex items-center rounded-lg border bg-white px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
                >
                  Edit Draft
                </Link>
              ) : null}
            </div>

            <div className="flex gap-3">
              <deleteFetcher.Form
                method="post"
                onClick={(e) => e.stopPropagation()}
              >
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="_action" value="deleteLongForm" />
                <button
                  type="submit"
                  disabled={deleteFetcher.state !== "idle"}
                  className="dark:bg-card border-destructive text-destructive hover:bg-destructive/10 focus:ring-ring dark:border-destructive dark:text-destructive dark:hover:bg-destructive/10/50 inline-flex items-center rounded-lg border bg-white px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none disabled:opacity-50"
                >
                  {deleteFetcher.state !== "idle" &&
                  deleteFetcher.formData?.get("postId") === post.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </deleteFetcher.Form>

              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
