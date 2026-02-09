/**
 * Modal to schedule a single repost or quote from an existing (posted) post.
 * User picks time (and optional quote caption), client builds event, signs, submits to /dashboard/scheduled.
 */

import { useFetcher } from "@remix-run/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { handleErrorSafely } from "~/lib/error-handler.client";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { parseDateTimeLocal, toUnixTimestamp } from "~/lib/temporal";
import type { UserData } from "~/lib/validation/user-data";

import type { PostData } from "../types";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "../utils/repost-quote-events.client";

interface ScheduleRepostQuoteModalProps {
  open: boolean;
  post: PostData | null;
  mode: "repost" | "quote" | null;
  onClose: () => void;
  onSuccess?: () => void;
  user?: UserData | null;
}

export function ScheduleRepostQuoteModal({
  open,
  post,
  mode,
  onClose,
  onSuccess,
  user,
}: ScheduleRepostQuoteModalProps) {
  const [scheduledFor, setScheduledFor] = useState("");
  const [quoteCaption, setQuoteCaption] = useState("");
  const [signingError, setSigningError] = useState<string | null>(null);

  const fetcher = useFetcher<{
    success?: boolean;
    postId?: string;
    error?: string;
  }>();

  const userTimezone = user?.timezone ?? "Etc/UTC";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.success) {
      toast.success(
        mode === "repost"
          ? "Repost scheduled successfully!"
          : "Quote post scheduled successfully!"
      );
      onSuccess?.();
      onClose();
    }
    if (fetcher.data.error) {
      toast.error(String(fetcher.data.error));
    }
  }, [fetcher.data, fetcher.state, mode, onClose, onSuccess]);

  const handleConfirm = async () => {
    if (!post || !mode || !scheduledFor.trim()) {
      toast.error("Please select a date and time.");
      return;
    }
    const originalSignedEvent = post.signedEvent;
    if (
      !originalSignedEvent ||
      typeof originalSignedEvent !== "object" ||
      !("id" in originalSignedEvent) ||
      !("pubkey" in originalSignedEvent)
    ) {
      toast.error("Original event not found. Cannot schedule repost/quote.");
      return;
    }
    try {
      setSigningError(null);
      const zoned = parseDateTimeLocal(scheduledFor, userTimezone);
      const utcZoned = zoned.withTimeZone("UTC");
      const scheduledForUnix = toUnixTimestamp(utcZoned);

      const signed = originalSignedEvent as {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
        sig: string;
      };

      if (mode === "repost") {
        const repostEvent = buildKind6RepostEvent(signed, scheduledForUnix);
        const { signedEvent: repostSignedEvent } = await nostrAdapter.signEvent(
          {
            content: repostEvent.content,
            created_at: repostEvent.created_at,
            kind: repostEvent.kind,
            tags: repostEvent.tags,
          }
        );
        const formData = new FormData();
        formData.set("_action", "scheduleRepost");
        formData.set("postId", post.id);
        formData.set("scheduledFor", scheduledForUnix.toString());
        formData.set("signedEvent", JSON.stringify(repostSignedEvent));
        fetcher.submit(formData, {
          method: "post",
          action: "/dashboard/scheduled",
        });
      } else {
        const tagArray: string[][] = [];
        const quoteEvent = buildQuoteEvent(
          signed,
          quoteCaption,
          scheduledForUnix,
          tagArray
        );
        const { signedEvent: quoteSignedEvent } = await nostrAdapter.signEvent({
          content: quoteEvent.content,
          created_at: quoteEvent.created_at,
          kind: quoteEvent.kind,
          tags: quoteEvent.tags,
        });
        const formData = new FormData();
        formData.set("_action", "scheduleQuote");
        formData.set("postId", post.id);
        formData.set("scheduledFor", scheduledForUnix.toString());
        formData.set("signedEvent", JSON.stringify(quoteSignedEvent));
        if (quoteCaption) {
          formData.set("quoteCaption", quoteCaption);
        }
        fetcher.submit(formData, {
          method: "post",
          action: "/dashboard/scheduled",
        });
      }
    } catch (error) {
      handleErrorSafely(error, {
        component: "ScheduleRepostQuoteModal",
        action: "handleConfirm",
      });
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to sign. Please try again.";
      setSigningError(msg);
      toast.error(msg);
    }
  };

  if (!open) return null;

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";
  const hasSignedEvent =
    post?.signedEvent &&
    typeof post.signedEvent === "object" &&
    "id" in post.signedEvent &&
    "pubkey" in post.signedEvent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="border-border bg-card w-full max-w-md rounded-lg border shadow-xl">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-foreground text-lg font-semibold">
              {mode === "repost" ? "Schedule repost" : "Schedule quote"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X
                className="h-6 w-6"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </button>
          </div>

          {!post || !hasSignedEvent ? (
            <p className="text-muted-foreground text-sm">
              This post cannot be used to schedule a repost or quote.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {mode === "repost"
                  ? "Choose when to schedule the repost."
                  : "Choose when to schedule the quote and add an optional caption."}
              </p>
              <div>
                <label
                  htmlFor="schedule-repost-quote-datetime"
                  className="text-foreground mb-1 block text-sm font-medium"
                >
                  Schedule at
                </label>
                <input
                  id="schedule-repost-quote-datetime"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2"
                />
              </div>
              {mode === "quote" ? (
                <div>
                  <label
                    htmlFor="schedule-quote-caption"
                    className="text-foreground mb-1 block text-sm font-medium"
                  >
                    Quote caption (optional)
                  </label>
                  <textarea
                    id="schedule-quote-caption"
                    value={quoteCaption}
                    onChange={(e) => setQuoteCaption(e.target.value)}
                    placeholder="Add your comment..."
                    rows={3}
                    className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2"
                  />
                </div>
              ) : null}
              {(fetcher.data?.error ?? signingError) ? (
                <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-3">
                  <div className="text-destructive text-sm">
                    {fetcher.data?.error ?? signingError}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            {post && hasSignedEvent ? (
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={isSubmitting || !scheduledFor.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {isSubmitting
                  ? "Signing..."
                  : mode === "repost"
                    ? "Schedule repost"
                    : "Schedule quote"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
