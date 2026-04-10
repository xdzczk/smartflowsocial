/**
 * Modal to schedule a single repost or quote from an existing (posted) post.
 * User picks time (and optional quote caption), client builds event, signs, submits to /dashboard/scheduled.
 */

import { useFetcher } from "@remix-run/react";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import {
  requestNewSignerSession,
  tryBackgroundReconnect,
} from "~/features/auth/signer";
import type { SignedEvent } from "~/features/nostr/types";
import { useComposerSignerReconnect } from "~/features/posts/composer/hooks/useComposerSignerReconnect";
import type { PostData, RepostConditions } from "~/features/posts/types";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "~/features/posts/utils/repost-quote-events.client";
import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  formatAttemptElapsed,
  useSignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  clampDateTimeLocalToMin,
  getMinDatetimeLocalForSchedule,
  getMinScheduleTimestampMs,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";
import type { UserData } from "~/lib/validation/user-data";

interface SignedEventShape {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

function validateScheduleInput(
  post: PostData | null,
  lookupSourceSignedEvent: SignedEvent | null,
  mode: "repost" | "quote" | null,
  scheduledFor: string,
  userTimezone: string
): { scheduledForUnix: number; signed: SignedEventShape } | string {
  if (!mode || !scheduledFor.trim()) {
    return "Please select a date and time.";
  }
  const originalSignedEvent = post?.signedEvent ?? lookupSourceSignedEvent;
  if (post && isPureRepostSourcePost(post)) {
    return "You cannot schedule a repost or quote of a repost.";
  }
  if (!post && lookupSourceSignedEvent?.kind === 6) {
    return "You cannot schedule a repost or quote of a repost.";
  }
  if (
    !originalSignedEvent ||
    typeof originalSignedEvent !== "object" ||
    !("id" in originalSignedEvent) ||
    !("pubkey" in originalSignedEvent)
  ) {
    return "Original event not found. Cannot schedule repost/quote.";
  }
  const zoned = parseDateTimeLocal(scheduledFor, userTimezone);
  const utcZoned = zoned.withTimeZone("UTC");
  const scheduledForUnix = toUnixTimestamp(utcZoned);
  const notBeforeUtc =
    post?.scheduledAtUtc != null
      ? post.scheduledAtUtc instanceof Date
        ? post.scheduledAtUtc
        : new Date(post.scheduledAtUtc)
      : undefined;
  const minMs = getMinScheduleTimestampMs(userTimezone, notBeforeUtc);
  if (utcZoned.epochMilliseconds < minMs) {
    return notBeforeUtc
      ? "Repost/quote must be scheduled at or after the original post's scheduled time."
      : "Please select a date and time in the future.";
  }
  const signed = originalSignedEvent as SignedEventShape;
  return { scheduledForUnix, signed };
}

async function signAndSubmitRepost(
  post: PostData | null,
  lookupSourceSignedEvent: SignedEvent | null,
  signed: SignedEventShape,
  scheduledForUnix: number,
  fetcher: ReturnType<typeof useFetcher<{ success?: boolean; error?: string }>>,
  repostConditions?: {
    minReactions?: number;
    minZaps?: number;
    minComments?: number;
    minReposts?: number;
    minSats?: number;
  } | null
): Promise<void> {
  const repostEvent = buildKind6RepostEvent(signed, scheduledForUnix);
  const { signedEvent: repostSignedEvent } =
    await nostrAdapter.signEventWithOneRetry({
      content: repostEvent.content,
      created_at: repostEvent.created_at,
      kind: repostEvent.kind,
      tags: repostEvent.tags,
    });
  const formData = new FormData();
  formData.set("_action", "scheduleRepost");
  if (post?.id) {
    formData.set("postId", post.id);
  } else if (lookupSourceSignedEvent) {
    formData.set("sourceSignedEvent", JSON.stringify(lookupSourceSignedEvent));
  }
  formData.set("scheduledFor", scheduledForUnix.toString());
  formData.set("signedEvent", JSON.stringify(repostSignedEvent));
  if (repostConditions) {
    if (repostConditions.minReactions != null)
      formData.set("minReactions", String(repostConditions.minReactions));
    if (repostConditions.minZaps != null)
      formData.set("minZaps", String(repostConditions.minZaps));
    if (repostConditions.minComments != null)
      formData.set("minComments", String(repostConditions.minComments));
    if (repostConditions.minReposts != null)
      formData.set("minReposts", String(repostConditions.minReposts));
    if (repostConditions.minSats != null)
      formData.set("minSats", String(repostConditions.minSats));
  }
  fetcher.submit(formData, { method: "post", action: "/dashboard/scheduled" });
}

async function signAndSubmitQuote(
  post: PostData | null,
  lookupSourceSignedEvent: SignedEvent | null,
  signed: SignedEventShape,
  scheduledForUnix: number,
  quoteCaption: string,
  fetcher: ReturnType<typeof useFetcher<{ success?: boolean; error?: string }>>
): Promise<void> {
  const tagArray: string[][] = [];
  const quoteEvent = buildQuoteEvent(
    signed,
    quoteCaption,
    scheduledForUnix,
    tagArray
  );
  const { signedEvent: quoteSignedEvent } =
    await nostrAdapter.signEventWithOneRetry({
      content: quoteEvent.content,
      created_at: quoteEvent.created_at,
      kind: quoteEvent.kind,
      tags: quoteEvent.tags,
    });
  const formData = new FormData();
  formData.set("_action", "scheduleQuote");
  if (post?.id) {
    formData.set("postId", post.id);
  } else if (lookupSourceSignedEvent) {
    formData.set("sourceSignedEvent", JSON.stringify(lookupSourceSignedEvent));
  }
  formData.set("scheduledFor", scheduledForUnix.toString());
  formData.set("signedEvent", JSON.stringify(quoteSignedEvent));
  if (quoteCaption) {
    formData.set("quoteCaption", quoteCaption);
  }
  fetcher.submit(formData, { method: "post", action: "/dashboard/scheduled" });
}

function getConfirmButtonLabel(
  isSigning: boolean,
  signAttempt: {
    attempt: number;
    maxAttempts: number;
    timeoutMs?: number;
  } | null,
  signElapsedSeconds: number,
  isSubmitting: boolean,
  mode: "repost" | "quote"
): string {
  if (isSigning) {
    return signAttempt
      ? `Waiting for signer… Attempt ${signAttempt.attempt} of ${signAttempt.maxAttempts} · ${formatAttemptElapsed(signElapsedSeconds, signAttempt.timeoutMs)}`
      : "Signing...";
  }
  if (isSubmitting) return "Signing...";
  return mode === "repost" ? "Schedule repost" : "Schedule quote";
}

interface ScheduleRepostQuoteModalProps {
  open: boolean;
  /** Your published/scheduled post (e.g. Published page). */
  post: PostData | null;
  /**
   * When scheduling from lookup of an arbitrary note (no app `post` row),
   * pass the source note; omit when `post` is set.
   */
  lookupSourceSignedEvent?: SignedEvent | null;
  mode: "repost" | "quote" | null;
  onClose: () => void;
  onSuccess?: () => void;
  user?: UserData | null;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- schedule repost/quote modal: validation, signing, conditions
export function ScheduleRepostQuoteModal({
  open,
  post,
  lookupSourceSignedEvent = null,
  mode,
  onClose,
  onSuccess,
  user,
}: ScheduleRepostQuoteModalProps) {
  const [scheduledFor, setScheduledFor] = useState("");
  const [quoteCaption, setQuoteCaption] = useState("");
  const [repostConditions, setRepostConditions] =
    useState<RepostConditions | null>(null);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const { signAttempt, signElapsedSeconds } = useSignAttemptProgress(isSigning);

  const pendingRetryRef = useRef<(() => void) | null>(null);
  const submitInFlightRef = useRef(false);
  const clearSigningState = useCallback(() => {
    setIsSigning(false);
    setSigningError(null);
  }, []);
  const cancelSigningState = useCallback(() => {
    pendingRetryRef.current = null;
    clearSigningState();
  }, [clearSigningState]);
  const retryLastSign = useCallback((): boolean => {
    const fn = pendingRetryRef.current;
    if (!fn) return false;
    pendingRetryRef.current = null;
    fn();
    return true;
  }, []);
  useComposerSignerReconnect(cancelSigningState, isSigning, retryLastSign);

  const fetcher = useFetcher<{
    success?: boolean;
    postId?: string;
    error?: string;
  }>();

  const userTimezone = user?.timezone ?? "Etc/UTC";

  useEffect(() => {
    if (fetcher.state === "idle" || !fetcher.data) return;
    const successMsg =
      mode === "repost"
        ? "Repost scheduled successfully!"
        : "Quote post scheduled successfully!";
    if (fetcher.data.success) {
      toast.success(successMsg);
      onSuccess?.();
      onClose();
    } else if (fetcher.data.error) {
      toast.error(String(fetcher.data.error));
    }
  }, [fetcher.data, fetcher.state, mode, onClose, onSuccess]);

  const handleConfirm = async () => {
    if (submitInFlightRef.current) return;
    const validation = validateScheduleInput(
      post,
      lookupSourceSignedEvent,
      mode,
      scheduledFor,
      userTimezone
    );
    if (typeof validation === "string") {
      toast.error(validation);
      return;
    }
    const { scheduledForUnix, signed } = validation;
    if ((!post && !lookupSourceSignedEvent) || !mode) return;
    submitInFlightRef.current = true;
    try {
      setSigningError(null);
      setIsSigning(true);
      pendingRetryRef.current = () => void handleConfirm();
      if (mode === "repost") {
        await signAndSubmitRepost(
          post,
          lookupSourceSignedEvent,
          signed,
          scheduledForUnix,
          fetcher,
          repostConditions
        );
      } else {
        await signAndSubmitQuote(
          post,
          lookupSourceSignedEvent,
          signed,
          scheduledForUnix,
          quoteCaption,
          fetcher
        );
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
    } finally {
      pendingRetryRef.current = null;
      setIsSigning(false);
      submitInFlightRef.current = false;
    }
  };

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";
  const hasSignedEvent = [
    Boolean(
      post?.signedEvent &&
      typeof post.signedEvent === "object" &&
      "id" in post.signedEvent &&
      "pubkey" in post.signedEvent
    ),
    Boolean(
      lookupSourceSignedEvent &&
      "id" in lookupSourceSignedEvent &&
      "pubkey" in lookupSourceSignedEvent
    ),
  ].some(Boolean);

  const isRepostChainBlocked = post
    ? isPureRepostSourcePost(post)
    : Boolean(lookupSourceSignedEvent?.kind === 6);

  const modalContent =
    !open || typeof document === "undefined" ? null : (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-repost-quote-title"
      >
        <div className="border-border bg-card w-full max-w-md rounded-lg border shadow-xl">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3
                id="schedule-repost-quote-title"
                className="text-foreground text-lg font-semibold"
              >
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

            {!hasSignedEvent ? (
              <p className="text-muted-foreground text-sm">
                This post cannot be used to schedule a repost or quote.
              </p>
            ) : isRepostChainBlocked ? (
              <p className="text-muted-foreground text-sm">
                You cannot schedule a repost or quote of a repost.
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
                    onChange={(e) => {
                      const v = e.target.value;
                      const notBefore =
                        post?.scheduledAtUtc != null
                          ? post.scheduledAtUtc instanceof Date
                            ? post.scheduledAtUtc
                            : new Date(post.scheduledAtUtc)
                          : undefined;
                      const min = getMinDatetimeLocalForSchedule(
                        userTimezone,
                        notBefore
                      );
                      setScheduledFor(clampDateTimeLocalToMin(v, min));
                    }}
                    min={getMinDatetimeLocalForSchedule(
                      userTimezone,
                      post?.scheduledAtUtc != null
                        ? post.scheduledAtUtc instanceof Date
                          ? post.scheduledAtUtc
                          : new Date(post.scheduledAtUtc)
                        : undefined
                    )}
                    className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2"
                  />
                </div>
                {mode === "repost" ? (
                  <div className="border-border space-y-1.5 rounded border p-3">
                    <span className="text-muted-foreground text-xs">
                      Only repost if original gets (optional)
                    </span>
                    <div className="flex flex-wrap items-center gap-3 gap-y-1.5">
                      {[
                        { key: "minReactions" as const, label: "Reactions" },
                        { key: "minZaps" as const, label: "Zaps" },
                        { key: "minComments" as const, label: "Comments" },
                        { key: "minReposts" as const, label: "Reposts" },
                        { key: "minSats" as const, label: "Sats" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <label className="text-muted-foreground text-xs whitespace-nowrap">
                            {label}
                          </label>
                          <input
                            type="number"
                            min={0}
                            placeholder="—"
                            value={repostConditions?.[key] ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const v =
                                raw.trim() === ""
                                  ? undefined
                                  : Math.max(0, parseInt(raw, 10) || 0);
                              setRepostConditions((prev) => {
                                if (v === undefined) {
                                  const next = prev ? { ...prev } : {};
                                  delete next[key];
                                  return Object.keys(next).length > 0
                                    ? next
                                    : null;
                                }
                                return { ...prev, [key]: v };
                              });
                            }}
                            className="border-border bg-background text-foreground w-20 rounded-md border px-2 py-1.5 text-sm"
                            aria-label={`Min ${label.toLowerCase()}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
                {isSigning ? (
                  <div className="bg-muted text-muted-foreground flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span>
                      Waiting for signer approval…
                      {signAttempt ? (
                        <>
                          {" "}
                          Attempt {signAttempt.attempt} of{" "}
                          {signAttempt.maxAttempts} ·{" "}
                          {formatAttemptElapsed(
                            signElapsedSeconds,
                            signAttempt.timeoutMs
                          )}
                        </>
                      ) : null}
                      {" — "}
                      If you’re using a remote signer, open it to approve the
                      request. To use a new session in the signer app, click
                      &quot;Use new session&quot;.
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          void requestNewSignerSession(cancelSigningState)
                        }
                      >
                        Use new session
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          cancelSigningState();
                          void tryBackgroundReconnect();
                        }}
                      >
                        Cancel
                      </Button>
                    </span>
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
              {hasSignedEvent && !isRepostChainBlocked ? (
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={isSubmitting || isSigning || !scheduledFor.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {getConfirmButtonLabel(
                    isSigning,
                    signAttempt,
                    signElapsedSeconds,
                    isSubmitting,
                    mode ?? "repost"
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );

  if (!open || typeof document === "undefined") return null;

  return createPortal(modalContent, document.body);
}
