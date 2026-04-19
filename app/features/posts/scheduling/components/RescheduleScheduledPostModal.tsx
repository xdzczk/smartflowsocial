import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useFetcher, useNavigate } from "@remix-run/react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { tryBackgroundReconnect } from "~/features/auth/signer";
import {
  canScheduleRepostQuoteForPost,
  type CalendarPost,
  type SignedEventForRepost,
  submitQuoteSchedule,
  submitRepostSchedule,
} from "~/features/posts/calendar";
import { PostPreviewSurface } from "~/features/posts/components/post-detail-modal/previews/PostPreviewSurface";
import { buildComposeEditUrl } from "~/features/posts/composer";
import { useComposerSignerReconnect } from "~/features/posts/composer/hooks/useComposerSignerReconnect";
import { NostrResignNotice } from "~/features/posts/scheduled/components/NostrResignNotice";
import { QueueSelector } from "~/features/posts/scheduled/components/QueueSelector";
import { ScheduledPostPreview } from "~/features/posts/scheduled/components/ScheduledPostPreview";
import { ScheduledTimeField } from "~/features/posts/scheduled/components/ScheduledTimeField";
import type {
  LongFormPostData,
  PostData,
  QueueType,
  RepostConditions,
  UserData,
} from "~/features/posts/types";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import {
  getClientDisplayErrorMessage,
  handleErrorSafely,
} from "~/lib/error-handler.client";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  describeSignerPhase,
  useSignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  addDays,
  addHours,
  clampDateTimeLocalToMin,
  formatForDateTimeLocal,
  formatForDisplay,
  fromDate,
  getNowForDateTimeLocal,
  getMinDatetimeLocalForSchedule,
  getMinScheduleTimestampMs,
  nowUTC,
  parseDateTimeLocal,
  toDate,
  toUnixTimestamp,
} from "~/lib/temporal";
import {
  rescheduleModalClientSchema,
  rescheduleLongformModalClientSchema,
} from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

const TOAST_POST_RESCHEDULED = "Post rescheduled";

function getInitialScheduledFor(
  post: PostData | LongFormPostData,
  isLongform: boolean,
  initialDateTime?: Date | null
): Date {
  if (initialDateTime && !Number.isNaN(initialDateTime.getTime())) {
    return initialDateTime;
  }
  try {
    const scheduledAtUtc = post.scheduledAtUtc;
    if (
      scheduledAtUtc instanceof Date &&
      !Number.isNaN(scheduledAtUtc.getTime())
    ) {
      return toDate(fromDate(scheduledAtUtc, "UTC"));
    }
    if (isLongform && "publishedAt" in post && post.publishedAt) {
      return toDate(fromDate(new Date(post.publishedAt), "UTC"));
    }
    return toDate(nowUTC());
  } catch {
    return toDate(nowUTC());
  }
}

export interface RescheduleScheduledPostModalProps {
  post: PostData | LongFormPostData;
  onClose: () => void;
  onSuccess: () => void;
  user?: UserData;
  queueTypes?: QueueType[];
  userTimeFormat?: "12h" | "24h";
  initialDateTime?: Date | null;
  /** When true, confirm uses manual time override vs queue slot (calendar queue-scheduled items). */
  wasAutoScheduled?: boolean;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- reschedule flow: queue, signer, repost/quote
export function RescheduleScheduledPostModal({
  post,
  onClose,
  onSuccess,
  user,
  queueTypes = [],
  userTimeFormat = "12h",
  initialDateTime,
  wasAutoScheduled = false,
}: RescheduleScheduledPostModalProps) {
  const { dateLocale } = useFormattedDate();
  const navigate = useNavigate();
  const isLongform = "title" in post;
  const userTimezone = user?.timezone ?? "UTC";

  interface FetcherData {
    success?: boolean;
    error?: string;
    needsSigning?: boolean;
  }
  const fetcher = useFetcher<FetcherData>();
  const scheduleRepostQuoteFetcher = useFetcher<{
    success?: boolean;
    error?: string;
  }>();

  const [isSigningEvent, setIsSigningEvent] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const { signAttempt, signElapsedSeconds } =
    useSignAttemptProgress(isSigningEvent);
  const signPhaseStatus = describeSignerPhase(
    signAttempt?.phase,
    signElapsedSeconds,
    signAttempt?.timeoutMs
  );
  const lastRescheduleDataRef = useRef<{
    scheduledFor: Date;
    queueTypeId?: string;
  } | null>(null);

  const [scheduleRepostQuoteMode, setScheduleRepostQuoteMode] = useState<
    null | "repost" | "quote"
  >(null);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [repostQuoteScheduledFor, setRepostQuoteScheduledFor] = useState("");
  const [repostQuoteCaption, setRepostQuoteCaption] = useState("");
  const [repostQuoteConditions, setRepostQuoteConditions] =
    useState<RepostConditions | null>(null);

  const initialSnapshotRef = useRef<{
    scheduledFor: Date;
    queueTypeId: string;
  } | null>(null);

  const clearSigningState = () => {
    setIsSigningEvent(false);
    setSigningError(null);
  };
  const cancelSigningState = () => {
    lastRescheduleDataRef.current = null;
    clearSigningState();
  };
  const retryLastSign = (): boolean => {
    const data = lastRescheduleDataRef.current;
    if (!data) return false;
    lastRescheduleDataRef.current = null;
    void runRescheduleWithData(data);
    return true;
  };
  useComposerSignerReconnect(cancelSigningState, isSigningEvent, retryLastSign);

  const schema = isLongform
    ? rescheduleLongformModalClientSchema
    : rescheduleModalClientSchema;

  const defaultScheduledFor = getInitialScheduledFor(
    post,
    isLongform,
    initialDateTime
  );
  const currentScheduledFor = getInitialScheduledFor(post, isLongform);
  const defaultQueueId =
    !isLongform && "queueType" in post ? (post.queueType?.id ?? "") : "";

  const form = useZodForm(schema, {
    defaultValues: {
      scheduledFor: defaultScheduledFor,
      ...(!isLongform ? { queueTypeId: defaultQueueId } : {}),
    },
  });

  useEffect(() => {
    const next = getInitialScheduledFor(post, isLongform, initialDateTime);
    const qid =
      !isLongform && "queueType" in post ? (post.queueType?.id ?? "") : "";
    form.reset({
      scheduledFor: next,
      ...(!isLongform ? { queueTypeId: qid } : {}),
    });
    initialSnapshotRef.current = {
      scheduledFor: next,
      queueTypeId: qid,
    };
    setScheduleRepostQuoteMode(null);
    setShowAdvancedActions(false);
    setRepostQuoteScheduledFor("");
    setRepostQuoteCaption("");
    setRepostQuoteConditions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when post or initial slot changes
  }, [post.id, initialDateTime?.getTime(), isLongform]);

  const scheduledFor = form.watch("scheduledFor");
  const watchedQueue = !isLongform
    ? (form.watch() as { queueTypeId?: string }).queueTypeId
    : undefined;

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const d = fetcher.data;
    if (!d) return;
    if (d.success) {
      if (d.needsSigning) return;
      setIsSigningEvent(false);
      toast.success(TOAST_POST_RESCHEDULED);
      onSuccess();
      return;
    }
    if (d.error) {
      setIsSigningEvent(false);
      setSigningError(getClientDisplayErrorMessage(d.error));
    }
  }, [fetcher.state, fetcher.data, onSuccess]);

  useEffect(() => {
    if (scheduleRepostQuoteFetcher.data?.success) {
      toast.success(TOAST_POST_RESCHEDULED);
      setScheduleRepostQuoteMode(null);
      onSuccess();
    }
    if (scheduleRepostQuoteFetcher.data?.error) {
      toast.error(
        getClientDisplayErrorMessage(scheduleRepostQuoteFetcher.data.error)
      );
    }
  }, [scheduleRepostQuoteFetcher.data, scheduleRepostQuoteMode, onSuccess]);

  const formatDateTimeForInput = (date: Date) => {
    const zonedDateTime = fromDate(date, userTimezone);
    return formatForDateTimeLocal(zonedDateTime, userTimezone);
  };

  const formatDateTime = (date: Date) => {
    const zonedDateTime = fromDate(date, userTimezone);
    return formatForDisplay(
      zonedDateTime,
      userTimezone,
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
      userTimeFormat,
      dateLocale
    );
  };

  const runRescheduleWithData = async (data: {
    scheduledFor: Date;
    queueTypeId?: string;
  }) => {
    try {
      setIsSigningEvent(true);
      setSigningError(null);

      const scheduledZoned = fromDate(data.scheduledFor, "UTC");
      const newTimeUnix = toUnixTimestamp(scheduledZoned);

      const originalSignedEvent = post.signedEvent;
      const originalNostrEvent = post.nostrEvent;

      if (!originalSignedEvent || !originalNostrEvent) {
        throw new Error(
          "Original event not found. Cannot reschedule unsigned posts."
        );
      }

      const { nostrEvent, signedEvent } =
        await nostrAdapter.signEventWithOneRetry({
          content: originalSignedEvent.content,
          created_at: newTimeUnix,
          kind: originalSignedEvent.kind,
          tags: originalSignedEvent.tags,
        });

      lastRescheduleDataRef.current = null;
      const formData = new FormData();
      formData.append(
        "action",
        isLongform ? "rescheduleLongform" : "reschedule"
      );
      formData.append("postId", post.id);
      formData.append("newTime", newTimeUnix.toString());
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("nostrEvent", JSON.stringify(nostrEvent));

      if (!isLongform) {
        formData.append("overrideQueue", String(wasAutoScheduled));
        if (data.queueTypeId) {
          formData.append("queueTypeId", data.queueTypeId);
        }
      }

      fetcher.submit(formData, {
        method: "post",
        action: "/dashboard/calendar",
      });
    } catch (error: unknown) {
      const { handleAsyncErrorWithMessage, getErrorMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "Failed to sign event. Please try again.",
        {
          component: "RescheduleScheduledPostModal",
          action: "runRescheduleWithData",
        },
        false
      );
      lastRescheduleDataRef.current = null;
      setIsSigningEvent(false);
      setSigningError(
        getErrorMessage(error) || "Failed to sign event. Please try again."
      );
    }
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    lastRescheduleDataRef.current = data;
    await runRescheduleWithData(data);
  });

  const submitRepostQuote = (formData: FormData) => {
    scheduleRepostQuoteFetcher.submit(formData, {
      method: "post",
      action: "/dashboard/scheduled",
    });
  };

  const handleScheduleRepostQuoteConfirm = async () => {
    if (!repostQuoteScheduledFor.trim()) {
      toast.error("Please select a date and time.");
      return;
    }
    const originalSignedEvent = post.signedEvent as
      | { id: string; pubkey: string; content?: string; tags?: string[][] }
      | undefined;
    if (!originalSignedEvent?.id || !originalSignedEvent.pubkey) {
      toast.error("Original event not found. Cannot schedule repost/quote.");
      return;
    }
    try {
      setIsSigningEvent(true);
      setSigningError(null);
      const zoned = parseDateTimeLocal(repostQuoteScheduledFor, userTimezone);
      const utcZoned = zoned.withTimeZone("UTC");
      const scheduledForUnix = toUnixTimestamp(utcZoned);

      const minMs = getMinScheduleTimestampMs(
        userTimezone,
        post.scheduledAtUtc ?? undefined
      );
      if (utcZoned.epochMilliseconds < minMs) {
        toast.error(
          post.scheduledAtUtc
            ? "Repost/quote must be scheduled at or after the original post's scheduled time."
            : "Please select a date and time in the future."
        );
        return;
      }

      const ev = originalSignedEvent as SignedEventForRepost & {
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
        sig: string;
      };
      if (scheduleRepostQuoteMode === "repost") {
        await submitRepostSchedule(
          post.id,
          ev,
          scheduledForUnix,
          submitRepostQuote,
          repostQuoteConditions
        );
      } else if (scheduleRepostQuoteMode === "quote") {
        await submitQuoteSchedule(
          post.id,
          ev,
          scheduledForUnix,
          repostQuoteCaption,
          submitRepostQuote
        );
      }
    } catch (error) {
      handleErrorSafely(error, {
        component: "RescheduleScheduledPostModal",
        action: "handleScheduleRepostQuoteConfirm",
      });
      const msg = getClientDisplayErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
      setSigningError(msg);
      toast.error(msg);
    } finally {
      setIsSigningEvent(false);
    }
  };

  const canScheduleRepostQuote =
    canScheduleRepostQuoteForPost(
      isLongform,
      post as unknown as CalendarPost
    ) && !isPureRepostSourcePost(post as PostData);
  const mediaCount =
    "fileUrl" in post
      ? post.fileUrl.length
      : "image" in post && post.image
        ? 1
        : 0;
  const queueSummary =
    !isLongform && "queueType" in post
      ? (post.queueType?.name ?? "Manual (No Queue)")
      : "Long-form publishing";

  const requestClose = () => {
    if (scheduleRepostQuoteMode) {
      setScheduleRepostQuoteMode(null);
      return;
    }
    const snap = initialSnapshotRef.current;
    let dirty = false;
    if (snap) {
      const q = !isLongform ? String(watchedQueue ?? "") : "";
      dirty =
        q !== snap.queueTypeId ||
        snap.scheduledFor.getTime() !== scheduledFor.getTime();
    }
    if (dirty && !window.confirm("Discard your changes?")) return;
    onClose();
  };

  const rescheduleErrorMessage = getClientDisplayErrorMessage(
    fetcher.data?.error ?? signingError
  );
  const requiresFullEditor =
    /follow-up|parent|account|unsupported|invalid/i.test(
      rescheduleErrorMessage
    );
  const openFullEditor = () => {
    const editUrl =
      !isLongform && post.dependencyMode === "attached"
        ? buildComposeEditUrl({
            mode: "edit_follow_up",
            followUpActionId: post.id,
            ...(post.parentScheduledActionId
              ? { parentActionId: post.parentScheduledActionId }
              : {}),
          })
        : buildComposeEditUrl({
            mode: "edit_scheduled",
            scheduledActionId: post.id,
          });
    onClose();
    navigate(editUrl);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent
        className="bg-card text-card-foreground border-border/80 flex max-h-[90dvh] w-full max-w-[min(920px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl"
        hideCloseButton
        data-testid="reschedule-modal"
      >
        <DialogHeader className="border-border/70 bg-card/95 shrink-0 border-b px-6 py-4 text-left backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Reschedule post
              </DialogTitle>
              <DialogDescription className="text-xs">
                Currently scheduled for {formatDateTime(currentScheduledFor)}
              </DialogDescription>
            </div>
            <DialogPrimitive.Close
              type="button"
              className="ring-offset-background focus:ring-ring text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0 rounded-md border border-transparent p-1.5 transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
              aria-label="Close"
            >
              <X className={INLINE_ICON_SIZE_CLASS} aria-hidden />
            </DialogPrimitive.Close>
          </div>
        </DialogHeader>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row"
          data-testid="reschedule-modal-layout"
        >
          <aside
            className="border-border/70 bg-muted/10 min-h-0 shrink-0 border-b px-5 py-5 md:w-[38%] md:border-r md:border-b-0"
            data-testid="reschedule-identity-pane"
          >
            <div className="space-y-4">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Post identity
              </p>
              <PostPreviewSurface className="bg-card/70">
                <ScheduledPostPreview
                  post={post}
                  isLongform={isLongform}
                  imageClassName="mb-3 rounded-lg border border-border/70 bg-muted/20"
                  captionClassName="text-sm leading-relaxed"
                />
              </PostPreviewSurface>
              <dl className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">Media</dt>
                  <dd className="text-right text-sm font-medium">
                    {mediaCount} file{mediaCount === 1 ? "" : "s"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">Queue</dt>
                  <dd className="text-right text-sm font-medium">
                    {queueSummary}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">
                    Current time
                  </dt>
                  <dd className="text-right text-sm font-medium">
                    {formatDateTime(currentScheduledFor)}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
            {scheduleRepostQuoteMode ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  {scheduleRepostQuoteMode === "repost"
                    ? "Choose when to schedule the repost."
                    : "Choose when to schedule the quote and add an optional caption."}
                </p>
                <div>
                  <label
                    htmlFor="repostQuoteScheduledFor"
                    className="text-foreground mb-1 block text-sm font-medium"
                  >
                    Schedule at
                  </label>
                  <input
                    id="repostQuoteScheduledFor"
                    type="datetime-local"
                    value={repostQuoteScheduledFor}
                    onChange={(e) => {
                      const v = e.target.value;
                      const min = getMinDatetimeLocalForSchedule(
                        userTimezone,
                        post.scheduledAtUtc ?? undefined
                      );
                      setRepostQuoteScheduledFor(
                        clampDateTimeLocalToMin(v, min)
                      );
                    }}
                    min={getMinDatetimeLocalForSchedule(
                      userTimezone,
                      post.scheduledAtUtc ?? undefined
                    )}
                    className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                {scheduleRepostQuoteMode === "repost" ? (
                  <div className="border-border space-y-1.5 rounded-md border p-3">
                    <span className="text-muted-foreground text-xs">
                      Only repost if original gets (optional)
                    </span>
                    <div className="flex flex-wrap items-center gap-3 gap-y-1.5">
                      {(
                        [
                          { key: "minReactions" as const, label: "Reactions" },
                          { key: "minZaps" as const, label: "Zaps" },
                          { key: "minComments" as const, label: "Comments" },
                          { key: "minReposts" as const, label: "Reposts" },
                          { key: "minSats" as const, label: "Sats" },
                        ] as const
                      ).map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <label className="text-muted-foreground text-xs whitespace-nowrap">
                            {label}
                          </label>
                          <input
                            type="number"
                            min={0}
                            placeholder="—"
                            value={repostQuoteConditions?.[key] ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const v =
                                raw.trim() === ""
                                  ? undefined
                                  : Math.max(0, parseInt(raw, 10) || 0);
                              setRepostQuoteConditions((prev) => {
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
                {scheduleRepostQuoteMode === "quote" ? (
                  <div>
                    <label
                      htmlFor="repostQuoteCaption"
                      className="text-foreground mb-1 block text-sm font-medium"
                    >
                      Quote caption (optional)
                    </label>
                    <textarea
                      id="repostQuoteCaption"
                      value={repostQuoteCaption}
                      onChange={(e) => setRepostQuoteCaption(e.target.value)}
                      placeholder="Add your comment..."
                      rows={3}
                      className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
                {(scheduleRepostQuoteFetcher.data?.error ?? signingError) ? (
                  <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-3">
                    <div className="text-destructive text-sm">
                      {getClientDisplayErrorMessage(
                        scheduleRepostQuoteFetcher.data?.error ?? signingError
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <section
                  className="space-y-3"
                  data-testid="reschedule-time-section"
                >
                  <ScheduledTimeField
                    id="reschedule-scheduled-time"
                    valueDatetimeLocal={formatDateTimeForInput(scheduledFor)}
                    minDatetimeLocal={getNowForDateTimeLocal(userTimezone)}
                    emphasis="primary"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      try {
                        const zonedDateTime = parseDateTimeLocal(
                          e.target.value,
                          userTimezone
                        );
                        const utcZoned = zonedDateTime.withTimeZone("UTC");
                        form.setValue("scheduledFor", toDate(utcZoned), {
                          shouldValidate: true,
                        });
                      } catch {
                        try {
                          const dateObj = new Date(e.target.value);
                          const zoned = fromDate(dateObj, userTimezone);
                          const utcZoned = zoned.withTimeZone("UTC");
                          form.setValue("scheduledFor", toDate(utcZoned), {
                            shouldValidate: true,
                          });
                        } catch {
                          form.setValue(
                            "scheduledFor",
                            new Date(e.target.value),
                            {
                              shouldValidate: true,
                            }
                          );
                        }
                      }
                    }}
                    humanReadableLine={formatDateTime(scheduledFor)}
                  />
                </section>

                <section className="space-y-2.5">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    Quick shortcuts
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        form.setValue(
                          "scheduledFor",
                          toDate(addHours(fromDate(scheduledFor, "UTC"), 1))
                        )
                      }
                    >
                      +1h
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const tomorrow = addDays(
                          fromDate(scheduledFor, "UTC"),
                          1
                        );
                        const tomorrowMorning = tomorrow.with({
                          hour: 9,
                          minute: 0,
                          second: 0,
                          millisecond: 0,
                        });
                        form.setValue("scheduledFor", toDate(tomorrowMorning));
                      }}
                    >
                      Tomorrow morning
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        form.setValue(
                          "scheduledFor",
                          toDate(addDays(fromDate(scheduledFor, "UTC"), 7))
                        )
                      }
                    >
                      Next week same time
                    </Button>
                  </div>
                </section>

                {!isLongform ? (
                  <section className="space-y-2">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      Queue
                    </p>
                    <QueueSelector
                      id="reschedule-queue"
                      value={watchedQueue ?? ""}
                      onChange={(id) => {
                        (form.setValue as (n: string, v: string) => void)(
                          "queueTypeId",
                          id
                        );
                      }}
                      queueTypes={queueTypes}
                      className="bg-muted/20 border-border/70 rounded-lg border p-3"
                      labelClassName="text-muted-foreground text-xs font-medium"
                      selectClassName="text-sm"
                    />
                  </section>
                ) : null}

                <section className="space-y-2">
                  {wasAutoScheduled ? (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      This post followed a queue slot. Confirming applies your
                      selected time as a manual schedule.
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    If this post has attached follow-ups, their schedule will be
                    adjusted automatically.
                  </p>
                  <NostrResignNotice variant="scheduleChange" />
                </section>

                {canScheduleRepostQuote ? (
                  <section className="space-y-2">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
                      onClick={() => setShowAdvancedActions((prev) => !prev)}
                      data-testid="reschedule-advanced-toggle"
                    >
                      {showAdvancedActions ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Advanced actions
                    </button>
                    {showAdvancedActions ? (
                      <div className="bg-muted/20 border-border/70 space-y-2 rounded-lg border p-3">
                        <p className="text-foreground text-sm font-medium">
                          Also schedule
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setScheduleRepostQuoteMode("repost")}
                          >
                            Schedule repost
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setScheduleRepostQuoteMode("quote")}
                          >
                            Schedule quote
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {isSigningEvent ? (
                  <div className="bg-muted text-muted-foreground border-border/70 flex flex-col gap-2 rounded-lg border p-3 text-sm">
                    <span>
                      Waiting for signer approval…
                      {signPhaseStatus ? <> {signPhaseStatus}</> : null}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          cancelSigningState();
                          void tryBackgroundReconnect();
                        }}
                      >
                        Cancel signing
                      </Button>
                    </div>
                  </div>
                ) : null}

                {form.formState.errors.scheduledFor ? (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
                    {form.formState.errors.scheduledFor.message}
                  </div>
                ) : null}

                {(fetcher.data?.error ?? signingError) ? (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
                    <p>{rescheduleErrorMessage}</p>
                    {requiresFullEditor ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive mt-2 px-0 underline"
                        onClick={openFullEditor}
                      >
                        Open full editor to resolve
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="border-border/70 bg-card/95 shrink-0 border-t px-6 py-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {scheduleRepostQuoteMode ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setScheduleRepostQuoteMode(null);
                    setRepostQuoteScheduledFor("");
                    setRepostQuoteCaption("");
                    setRepostQuoteConditions(null);
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleScheduleRepostQuoteConfirm()}
                  disabled={
                    scheduleRepostQuoteFetcher.state !== "idle" ||
                    isSigningEvent ||
                    !repostQuoteScheduledFor.trim()
                  }
                >
                  {isSigningEvent ||
                  scheduleRepostQuoteFetcher.state === "submitting"
                    ? "Signing…"
                    : scheduleRepostQuoteMode === "repost"
                      ? "Schedule repost"
                      : "Schedule quote"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={requestClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={fetcher.state === "submitting" || isSigningEvent}
                >
                  {isSigningEvent
                    ? "Signing…"
                    : fetcher.state === "submitting"
                      ? "Saving…"
                      : "Confirm reschedule"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
