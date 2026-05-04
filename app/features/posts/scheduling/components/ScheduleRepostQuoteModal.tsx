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
import { FormControl, FormField, FormLabel } from "~/components/ui/form-field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { cancelSignerInFlight } from "~/features/auth/signer";
import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
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
  describeSignerPhase,
  shouldShowManualRecovery,
  useSignAttemptProgress,
  type SignAttemptProgress,
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

const SCHEDULE_REPOST_LABEL = "Schedule repost";
const SCHEDULE_QUOTE_LABEL = "Schedule quote";

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
  attemptId: string,
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
  const { signedEvent: repostSignedEvent } = await nostrAdapter.signEvent(
    {
      content: repostEvent.content,
      created_at: repostEvent.created_at,
      kind: repostEvent.kind,
      tags: repostEvent.tags,
    },
    { clearCacheOnError: false }
  );
  const formData = new FormData();
  formData.set("_action", "scheduleRepost");
  if (post?.id) {
    formData.set("postId", post.id);
  } else if (lookupSourceSignedEvent) {
    formData.set("sourceSignedEvent", JSON.stringify(lookupSourceSignedEvent));
  }
  formData.set("scheduledFor", scheduledForUnix.toString());
  formData.set("signedEvent", JSON.stringify(repostSignedEvent));
  formData.set("attemptId", attemptId);
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
  attemptId: string,
  fetcher: ReturnType<typeof useFetcher<{ success?: boolean; error?: string }>>
): Promise<void> {
  const tagArray: string[][] = [];
  const quoteEvent = buildQuoteEvent(
    signed,
    quoteCaption,
    scheduledForUnix,
    tagArray
  );
  const { signedEvent: quoteSignedEvent } = await nostrAdapter.signEvent(
    {
      content: quoteEvent.content,
      created_at: quoteEvent.created_at,
      kind: quoteEvent.kind,
      tags: quoteEvent.tags,
    },
    { clearCacheOnError: false }
  );
  const formData = new FormData();
  formData.set("_action", "scheduleQuote");
  if (post?.id) {
    formData.set("postId", post.id);
  } else if (lookupSourceSignedEvent) {
    formData.set("sourceSignedEvent", JSON.stringify(lookupSourceSignedEvent));
  }
  formData.set("scheduledFor", scheduledForUnix.toString());
  formData.set("signedEvent", JSON.stringify(quoteSignedEvent));
  formData.set("attemptId", attemptId);
  if (quoteCaption) {
    formData.set("quoteCaption", quoteCaption);
  }
  fetcher.submit(formData, { method: "post", action: "/dashboard/scheduled" });
}

function getConfirmButtonLabel(
  isSigning: boolean,
  signAttempt: SignAttemptProgress | null,
  signElapsedSeconds: number,
  isSubmitting: boolean,
  mode: "repost" | "quote"
): string {
  if (isSigning) {
    const phase = describeSignerPhase(
      signAttempt?.phase,
      signElapsedSeconds,
      signAttempt?.timeoutMs
    );
    return phase ? `Waiting for signer… ${phase}` : "Waiting for signer…";
  }
  if (isSubmitting) return "Signing...";
  return mode === "repost" ? SCHEDULE_REPOST_LABEL : SCHEDULE_QUOTE_LABEL;
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
  // Tracks the in-flight signing attempt so the fetcher.data effect can
  // mark it completed/failed once the server response lands.
  const inFlightAttemptIdRef = useRef<string | null>(null);
  const clearSigningState = useCallback(() => {
    setIsSigning(false);
    setSigningError(null);
  }, []);
  const cancelSigningState = useCallback(() => {
    pendingRetryRef.current = null;
    inFlightAttemptIdRef.current = null;
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
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const successMsg =
      mode === "repost"
        ? "Repost scheduled successfully!"
        : "Quote post scheduled successfully!";
    const attemptId = inFlightAttemptIdRef.current;
    if (fetcher.data.success) {
      if (attemptId) {
        signingAttempts.markCompleted(attemptId);
        inFlightAttemptIdRef.current = null;
      }
      toast.success(successMsg);
      onSuccess?.();
      onClose();
    } else if (fetcher.data.error) {
      const message = String(fetcher.data.error);
      if (attemptId) {
        signingAttempts.markFailed(attemptId, message);
        inFlightAttemptIdRef.current = null;
      }
      toast.error(message);
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
    setSigningError(null);
    setIsSigning(true);
    pendingRetryRef.current = () => void handleConfirm();

    // Stable across resumes for the same intent: same source event +
    // mode + target time => same dedupe slot. The user reopening the
    // modal with a different time is a fresh intent.
    const idempotencyKey = `schedule_${mode}:${signed.id}:${String(scheduledForUnix)}`;

    const result = await startRecoverableSign({
      intent: durableIntent(
        "schedule_repost_quote",
        idempotencyKey,
        mode === "repost" ? SCHEDULE_REPOST_LABEL : SCHEDULE_QUOTE_LABEL
      ),
      surface: `schedule_${mode}:${signed.id}`,
      performSignAndSubmit: async (submissionId) => {
        if (mode === "repost") {
          await signAndSubmitRepost(
            post,
            lookupSourceSignedEvent,
            signed,
            scheduledForUnix,
            submissionId,
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
            submissionId,
            fetcher
          );
        }
        inFlightAttemptIdRef.current = submissionId;
        // Returning here parks the attempt in `submitting`. The
        // fetcher.data effect promotes it to `completed` / `failed`.
      },
    });

    pendingRetryRef.current = null;
    submitInFlightRef.current = false;

    if (result.ok) return;

    setIsSigning(false);
    inFlightAttemptIdRef.current = null;

    if (result.reason === "fatal") {
      const msg = result.lastError ?? "Failed to sign. Please try again.";
      handleErrorSafely(new Error(msg), {
        component: "ScheduleRepostQuoteModal",
        action: "handleConfirm",
      });
      setSigningError(msg);
      toast.error(msg);
    } else if (result.reason === "expired") {
      const msg = "Recovery window expired before your signer reconnected.";
      setSigningError(msg);
      toast.error(msg);
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
        className="bg-scrim/50 fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-repost-quote-title"
      >
        <div className="border-border bg-surface-overlay shadow-3 w-full max-w-md rounded-xl border">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3
                id="schedule-repost-quote-title"
                className="text-text text-lg font-semibold"
              >
                {mode === "repost"
                  ? SCHEDULE_REPOST_LABEL
                  : SCHEDULE_QUOTE_LABEL}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-text-secondary hover:text-text"
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
              <p className="text-text-secondary text-sm">
                This post cannot be used to schedule a repost or quote.
              </p>
            ) : isRepostChainBlocked ? (
              <p className="text-text-secondary text-sm">
                You cannot schedule a repost or quote of a repost.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-text-secondary text-sm">
                  {mode === "repost"
                    ? "Choose when to schedule the repost."
                    : "Choose when to schedule the quote and add an optional caption."}
                </p>
                <FormField id="schedule-repost-quote-datetime">
                  <FormLabel>Schedule at</FormLabel>
                  <FormControl>
                    <Input
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
                    />
                  </FormControl>
                </FormField>
                {mode === "repost" ? (
                  <div className="border-border space-y-1.5 rounded-xs border p-3">
                    <span className="text-text-secondary text-xs">
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
                        <div key={key} className="cluster-tight.5">
                          <label className="text-text-secondary text-xs whitespace-nowrap">
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
                            className="border-border bg-canvas text-text w-20 rounded-md border px-2 py-1.5 text-sm"
                            aria-label={`Min ${label.toLowerCase()}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {mode === "quote" ? (
                  <FormField id="schedule-quote-caption">
                    <FormLabel>Quote caption (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        value={quoteCaption}
                        onChange={(e) => setQuoteCaption(e.target.value)}
                        placeholder="Add your comment..."
                        rows={3}
                      />
                    </FormControl>
                  </FormField>
                ) : null}
                {isSigning ? (
                  <div className="bg-surface-hover text-text-secondary flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span>
                      Waiting for signer approval…
                      {(() => {
                        const phase = describeSignerPhase(
                          signAttempt?.phase,
                          signElapsedSeconds,
                          signAttempt?.timeoutMs
                        );
                        return phase ? <> {phase}</> : null;
                      })()}
                      {shouldShowManualRecovery(signAttempt?.phase)
                        ? " - Open your remote signer to approve. If your session expired, reconnect from Settings."
                        : null}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-text-secondary hover:text-text shrink-0"
                      onClick={() => {
                        cancelSigningState();
                        cancelSignerInFlight();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
                {(fetcher.data?.error ?? signingError) ? (
                  <div className="border-danger/30 bg-danger/10 rounded-lg border p-3">
                    <div className="text-danger text-sm">
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
                className="text-text-secondary hover:text-text px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              {hasSignedEvent && !isRepostChainBlocked ? (
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={isSubmitting || isSigning || !scheduledFor.trim()}
                  className="bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
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
