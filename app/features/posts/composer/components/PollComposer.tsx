/**
 * NIP-88 poll composer (kind 1068): question, options, schedule/publish via newpost action.
 */

import { useFetcher } from "@remix-run/react";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { createSubmissionId } from "~/features/auth/signing/signing-attempts.client";
import { PublishingSummaryRail } from "~/features/posts/components/ConfidencePanel";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import { TagsChipRow } from "~/features/posts/components/TagsChipRow";
import { trackComposerEvent } from "~/features/posts/composer/utils/composer-analytics.client";
import { usePostScheduling } from "~/features/posts/scheduling";
import { useScheduleOverlapWarning } from "~/features/posts/scheduling/hooks/useScheduleOverlapWarning";
import {
  defaultIncludeHashtagsForQueueSelection,
  type QueueType,
} from "~/features/posts/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { applyRandomScheduleWindow } from "~/lib/schedule-random";
import {
  formatForDateTimeLocal,
  fromUnixTimestamp,
  nowMillis,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

import { useLocalDraft } from "../hooks/useComposerLocalDraft";
import { useComposerSignerReconnect } from "../hooks/useComposerSignerReconnect";
import { useComposerState } from "../hooks/useComposerState";
import { PollComposerPreviewBlock } from "../preview/PollComposerPreviewBlock";
import {
  appendRelayOverride,
  appendSubmissionId,
} from "../services/build-publish-formdata.client";
import type { InitialPollRestore } from "../types/initial-poll-restore";

import {
  ComposerCanvasDivider,
  ComposerCanvasSectionLabel,
  ComposerErrors,
  ComposerLeftCanvas,
  composerCanvasFieldStackClass,
  type ComposerPublishMode,
  buildPublishPathSummary,
  buildPublishingOutcomeSentence,
  formatPollPostStatusSummaryInline,
  formatPublishSummaryOptionsLine,
  getReadinessPresentation,
  resolveComposerIssueDisplayPhase,
  getPollSubmitActionForMode,
  getPrimaryCtaLabelForMode,
  getPrimaryCtaPendingLabelForMode,
  getQueueNextSlotLabel,
} from "./composer";
import {
  ACTION_POST_POLL,
  ACTION_SCHEDULE_POLL,
  parseScheduledTime,
} from "./composer/composer-submit-utils";
import {
  POLL_COMPOSER_MAX_OPTIONS,
  POLL_COMPOSER_MIN_OPTIONS,
  POLL_COMPOSER_SCHEDULE_FUTURE_MSG,
  POLL_MAX_HOURS_AFTER_PUBLISH,
  type PollEndMode,
  newPollOptionRowId,
  parseTopicTagValues,
  pollQuestionForSignedEvent,
  randomScheduleHalfWidthSeconds,
  resolvePollEndsAtUnixForSubmit,
} from "./poll-composer/poll-composer-utils";
import { getPollComposerModeSpecificSection } from "./poll-composer/PollComposerRailScheduleSection";

export interface PollComposerProps {
  queueTypes?: Array<string | QueueType>;
  hashTagPresets?: Array<{ id: string; name: string; tags: string }>;
  onQueueTypeChange?: (queueType: string) => void;
  selectedHashTagPresetId?: string | null | undefined;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
  relayOverride?: string[];
  relayCount?: number;
  onComposerStatusChange?: (status: ComposerStatus) => void;
  onRelayClick?: () => void;
  defaultRelays: string[];
  scheduleIntervals?: number[];
  initialScheduledFor?: string | null;
  publishMode?: ComposerPublishMode;
  onPublishModeChange?: (next: ComposerPublishMode) => void;
  onDraftStateLabelChange?: (label: string) => void;
  skipLocalDraftRestore?: boolean;
  /** Queue name when opening compose (e.g. from draft loader). */
  initialQueue?: string;
  /** Server-built poll fields when resuming `/dashboard/compose?type=poll&draftId=…`. */
  initialPollRestore?: InitialPollRestore | null;
  initialDraftId?: string | null;
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- poll composer intentionally orchestrates many mode-specific UI states */
export function PollComposer({
  queueTypes = [],
  hashTagPresets = [],
  onQueueTypeChange,
  selectedHashTagPresetId,
  onHashtagPresetChange,
  relayOverride,
  relayCount: relayCountProp = 0,
  onComposerStatusChange,
  onRelayClick,
  defaultRelays,
  scheduleIntervals: scheduleIntervalsProp,
  initialScheduledFor = null,
  publishMode = "now",
  onPublishModeChange,
  onDraftStateLabelChange,
  skipLocalDraftRestore = false,
  initialQueue = "unassigned",
  initialPollRestore = null,
  initialDraftId = null,
}: PollComposerProps) {
  const fetcher = useFetcher();
  const user = useOptionalUser();
  const userTimezone = user?.timezone ?? "UTC";

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [optionRowIds, setOptionRowIds] = useState<string[]>(() => [
    newPollOptionRowId(),
    newPollOptionRowId(),
  ]);
  const [pollType, setPollType] = useState<"singlechoice" | "multiplechoice">(
    "singlechoice"
  );
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [pollEndMode, setPollEndMode] = useState<PollEndMode>("relative");
  const [pollEndHoursAfterPublish, setPollEndHoursAfterPublish] = useState(24);
  const [selectedHashtags, setSelectedHashtags] = useState("");
  const [includeHashtagsInNoteBody, setIncludeHashtagsInNoteBody] =
    useState(true);
  const [
    hasManualIncludeHashtagsPreference,
    setHasManualIncludeHashtagsPreference,
  ] = useState(false);
  const [hashTagPresetId, setHashTagPresetId] = useState<string | null>(null);
  const [isRecyclable, setIsRecyclable] = useState(false);
  const [scheduleRandomWindowMinutes, setScheduleRandomWindowMinutes] =
    useState(0);
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [composerTouched, setComposerTouched] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [publishSubmitInFlight, setPublishSubmitInFlight] = useState(false);
  const [lastPublishFailed, setLastPublishFailed] = useState(false);
  const pollDraftStorageKey = "composer-newpost-poll-draft";
  const {
    restored: pollDraftRestored,
    saveSnapshot: savePollDraftSnapshot,
    flushSnapshot: flushPollDraftSnapshot,
    clearSnapshot: clearPollDraftSnapshot,
  } = useLocalDraft<{
    question: string;
    options: string[];
    pollType: "singlechoice" | "multiplechoice";
    endsAtLocal: string;
    pollEndMode?: PollEndMode;
    pollEndHoursAfterPublish?: number;
    selectedHashtags: string;
    hashTagPresetId: string | null;
    isRecyclable: boolean;
    selectedQueue: string;
    scheduledFor: string;
    publishMode: ComposerPublishMode;
    scheduleRandomWindowMinutes?: number;
    includeHashtagsInNoteBody?: boolean;
    savedAt: number;
  }>(
    pollDraftStorageKey,
    skipLocalDraftRestore || Boolean(initialDraftId),
    1500
  );
  const appliedPollRestoreRef = useRef(false);
  const serverPollRestoreAppliedRef = useRef(false);

  const {
    selectedQueue,
    setSelectedQueue,
    scheduledFor,
    setScheduledFor,
    timeError,
    handleScheduleIntervalClick,
    scheduleIntervals,
    calculateQueueScheduleTime,
  } = usePostScheduling({
    queueTypes,
    scheduleIntervals: scheduleIntervalsProp,
    userTimezone,
    initialQueue,
    onQueueTypeChange,
  });

  const appliedInitialScheduleRef = useRef(false);
  useEffect(() => {
    if (!initialScheduledFor || appliedInitialScheduleRef.current) return;
    appliedInitialScheduleRef.current = true;
    setScheduledFor(initialScheduledFor);
  }, [initialScheduledFor, setScheduledFor]);

  const selectedQueueType = queueTypes.find(
    (q) => (typeof q === "string" ? q : q.name) === selectedQueue
  );
  const queueTypeId =
    typeof selectedQueueType === "object" ? selectedQueueType.id : null;

  const applyQueueDefaultScheduleRandom = useCallback(
    (queueName: string) => {
      const qt = queueTypes.find(
        (q) => (typeof q === "string" ? q : q.name) === queueName
      );
      const window =
        typeof qt === "object" &&
        qt.scheduleConfig &&
        typeof qt.scheduleConfig === "object" &&
        "scheduleRandomWindowMinutes" in qt.scheduleConfig
          ? ((qt.scheduleConfig as { scheduleRandomWindowMinutes?: number })
              .scheduleRandomWindowMinutes ?? 0)
          : 0;
      setScheduleRandomWindowMinutes(
        typeof window === "number" && window >= 0 && window <= 15 ? window : 0
      );
    },
    [queueTypes]
  );

  const handlePollQueueChange = useCallback(
    (queueName: string) => {
      setSelectedQueue(queueName);
      applyQueueDefaultScheduleRandom(queueName);
    },
    [applyQueueDefaultScheduleRandom, setSelectedQueue]
  );

  const prevPublishModeRef = useRef(publishMode);
  useEffect(() => {
    const prev = prevPublishModeRef.current;
    prevPublishModeRef.current = publishMode;
    if (prev !== "queue" || publishMode === "queue") return;
    setSelectedQueue("unassigned");
    setScheduledFor("");
    applyQueueDefaultScheduleRandom("unassigned");
  }, [
    applyQueueDefaultScheduleRandom,
    publishMode,
    setSelectedQueue,
    setScheduledFor,
  ]);

  const pollQueueEffectFirstRef = useRef(true);
  useEffect(() => {
    if (pollQueueEffectFirstRef.current) {
      pollQueueEffectFirstRef.current = false;
      return;
    }
    if (hasManualIncludeHashtagsPreference) {
      return;
    }
    setIncludeHashtagsInNoteBody(
      defaultIncludeHashtagsForQueueSelection(selectedQueue, queueTypes)
    );
  }, [selectedQueue, queueTypes, hasManualIncludeHashtagsPreference]);

  const relayUrls =
    relayOverride && relayOverride.length > 0 ? relayOverride : defaultRelays;

  const relayCount =
    relayCountProp > 0
      ? relayCountProp
      : relayUrls.length > 0
        ? relayUrls.length
        : 0;

  const trimmedOptions = useMemo(
    () => options.map((o) => o.trim()).filter((o) => o.length > 0),
    [options]
  );

  const hasContent =
    question.trim().length > 0 &&
    trimmedOptions.length >= POLL_COMPOSER_MIN_OPTIONS;
  const canSubmit = trimmedOptions.length >= POLL_COMPOSER_MIN_OPTIONS;
  const hasScheduleTime = scheduledFor.trim().length > 0;
  const shouldCheckScheduleOverlap =
    (publishMode === "schedule" || publishMode === "queue") && hasScheduleTime;
  const { warning: scheduleOverlapWarning } = useScheduleOverlapWarning({
    scheduledFor,
    queueTypeId,
    enabled: shouldCheckScheduleOverlap,
  });
  const isSubmitting = fetcher.state !== "idle";

  /** Latest possible `created_at` (unix sec) for validation: nominal + random window when scheduling. */
  const latestPublishUnixSecForPollEnd =
    publishMode === "now"
      ? Math.floor(nowMillis() / 1000)
      : scheduledFor.trim()
        ? (() => {
            try {
              const zdt = parseDateTimeLocal(scheduledFor.trim(), userTimezone);
              const nominal = Math.floor(toUnixTimestamp(zdt));
              const w = randomScheduleHalfWidthSeconds(
                scheduleRandomWindowMinutes
              );
              return nominal + w;
            } catch {
              return null;
            }
          })()
        : null;

  const nominalPublishUnixSecForPreview =
    publishMode === "now"
      ? Math.floor(nowMillis() / 1000)
      : scheduledFor.trim()
        ? (() => {
            try {
              return Math.floor(
                toUnixTimestamp(
                  parseDateTimeLocal(scheduledFor.trim(), userTimezone)
                )
              );
            } catch {
              return null;
            }
          })()
        : null;

  const composerStatus = useComposerState({
    hasContent,
    canSubmit,
    hasScheduleTime,
    isSigning,
    isSubmitting,
    publishSubmitInFlight,
    lastPublishFailed,
  });

  useEffect(() => {
    onComposerStatusChange?.(composerStatus);
  }, [composerStatus, onComposerStatusChange]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as { error?: string };
      if (typeof data.error === "string") {
        setLastPublishFailed(true);
        toast.error(data.error);
        trackComposerEvent("composer_publish_failed", { source: "poll" });
      }
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    trackComposerEvent("composer_queue_selected", { queue: selectedQueue });
  }, [selectedQueue]);

  const clearSigningState = useCallback(() => {
    setIsSigning(false);
    setSigningError(null);
  }, []);

  useComposerSignerReconnect(clearSigningState, isSigning);

  const disabled = isSubmitting || isSigning;

  async function submitPoll(actionType: string): Promise<void> {
    setSigningError(null);
    setLastPublishFailed(false);
    const q = question.trim();
    if (!q) {
      toast.error("Enter a poll question.");
      return;
    }
    const tagLine = selectedHashtags.trim();
    const appendTagsToQuestion = includeHashtagsInNoteBody;
    const questionForEvent = pollQuestionForSignedEvent(
      q,
      tagLine,
      appendTagsToQuestion
    );
    if (trimmedOptions.length < POLL_COMPOSER_MIN_OPTIONS) {
      toast.error(`Add at least ${POLL_COMPOSER_MIN_OPTIONS} options.`);
      return;
    }
    if (relayUrls.length === 0) {
      toast.error("Select at least one relay for the poll.");
      return;
    }

    let scheduledTimeMs: number;
    if (actionType === ACTION_POST_POLL) {
      scheduledTimeMs = nowMillis();
    } else {
      let effectiveScheduled = scheduledFor;
      if (
        publishMode === "queue" &&
        selectedQueue !== "unassigned" &&
        !effectiveScheduled.trim()
      ) {
        const computed = await calculateQueueScheduleTime(selectedQueue);
        if (computed) effectiveScheduled = computed;
      }
      if (!effectiveScheduled.trim()) {
        toast.error("Pick a schedule time or select a queue.");
        return;
      }
      scheduledTimeMs = await parseScheduledTime(
        effectiveScheduled,
        userTimezone
      );
      if (scheduledTimeMs < Date.now()) {
        toast.error(POLL_COMPOSER_SCHEDULE_FUTURE_MSG);
        return;
      }
    }

    const nominalUnix = Math.floor(scheduledTimeMs / 1000);
    const effectiveRandomMinutes = scheduleRandomWindowMinutes;
    const createdUnix =
      actionType !== ACTION_POST_POLL && effectiveRandomMinutes > 0
        ? applyRandomScheduleWindow(nominalUnix, effectiveRandomMinutes)
        : nominalUnix;
    const endsResolved = await resolvePollEndsAtUnixForSubmit({
      pollEndMode,
      pollEndHoursAfterPublish,
      endsAtLocal,
      createdUnix,
      userTimezone,
    });
    if (!endsResolved.ok) {
      toast.error(endsResolved.message);
      return;
    }
    const endsAtUnix = endsResolved.endsAtUnix;

    setIsSigning(true);
    setPublishSubmitInFlight(true);
    try {
      const { nostrEvent, signedEvent } = await nostrAdapter.signPollEvent(
        {
          question: questionForEvent,
          created_at: createdUnix,
          optionLabels: trimmedOptions,
          pollType,
          relayUrls,
          endsAt: endsAtUnix,
          topicTagValues: parseTopicTagValues(selectedHashtags),
        },
        { clearCacheOnError: false }
      );

      const fd = new FormData();
      fd.set("_action", actionType);
      fd.set("contentType", "poll");
      fd.set("content", questionForEvent);
      fd.set(
        "includeHashtagsInNoteBody",
        String(Boolean(includeHashtagsInNoteBody))
      );
      fd.set("queueType", selectedQueue);
      if (queueTypeId) fd.set("queueTypeId", queueTypeId);
      if (isRecyclable) fd.set("isRecyclable", "on");
      if (hashTagPresetId) {
        fd.set("useHashtagPresets", "on");
        fd.set("hashTagPresetId", hashTagPresetId);
      }
      fd.set("signedEvent", JSON.stringify(signedEvent));
      fd.set("nostrEvent", JSON.stringify(nostrEvent));
      appendRelayOverride(fd, relayOverride);
      appendSubmissionId(fd, createSubmissionId());
      if (actionType === ACTION_SCHEDULE_POLL && effectiveRandomMinutes > 0) {
        fd.set("nominalScheduledFor", String(nominalUnix));
      }

      fetcher.submit(fd, { method: "post" });
    } catch (e) {
      setLastPublishFailed(true);
      setSigningError(
        e instanceof Error ? e.message : "Could not sign poll. Try again."
      );
      toast.error("Signing failed");
    } finally {
      setIsSigning(false);
    }
  }

  const pollAction = getPollSubmitActionForMode(publishMode);
  const primaryLabel = isSigning
    ? "Waiting for signer…"
    : isSubmitting
      ? pollAction === ACTION_SCHEDULE_POLL
        ? "Scheduling..."
        : "Posting..."
      : getPrimaryCtaLabelForMode(publishMode, "poll");
  const deferrableBlockers: string[] = [];
  if (question.trim().length === 0) {
    deferrableBlockers.push("Question is required");
  }
  if (trimmedOptions.length < POLL_COMPOSER_MIN_OPTIONS) {
    deferrableBlockers.push(
      `At least ${POLL_COMPOSER_MIN_OPTIONS} poll options are required`
    );
  }
  if (publishMode === "schedule" && !hasScheduleTime) {
    deferrableBlockers.push("Publish time is required");
  }
  if (publishMode === "queue" && selectedQueue === "unassigned") {
    deferrableBlockers.push("Choose a queue");
  }
  if (timeError) deferrableBlockers.push(timeError);
  if (relayCount <= 0) deferrableBlockers.push("No relays selected");

  if (pollEndMode === "relative") {
    if (
      !Number.isFinite(pollEndHoursAfterPublish) ||
      pollEndHoursAfterPublish < 1 ||
      pollEndHoursAfterPublish > POLL_MAX_HOURS_AFTER_PUBLISH
    ) {
      deferrableBlockers.push(
        `Poll end: set hours after publish (1–${POLL_MAX_HOURS_AFTER_PUBLISH})`
      );
    }
  } else if (endsAtLocal.trim()) {
    if (latestPublishUnixSecForPollEnd == null) {
      if (publishMode === "queue" && selectedQueue !== "unassigned") {
        deferrableBlockers.push(
          "Poll end is set: waiting for queue slot (or pick schedule time)"
        );
      }
    } else {
      try {
        const endZdt = parseDateTimeLocal(endsAtLocal.trim(), userTimezone);
        const endUnix = Math.floor(toUnixTimestamp(endZdt));
        if (endUnix <= latestPublishUnixSecForPollEnd) {
          deferrableBlockers.push(
            "Poll end must be after publish time (including schedule and random window)"
          );
        }
      } catch {
        deferrableBlockers.push("Poll end: invalid date and time");
      }
    }
  }

  const blockers = deferrableBlockers;
  const issueDisplayPhase = resolveComposerIssueDisplayPhase(
    publishAttempted,
    composerTouched
  );
  const displayRedIssues =
    issueDisplayPhase === "blocking" ? [...deferrableBlockers] : [];
  const displayAmberIssues = [
    ...(issueDisplayPhase === "soft" ? [...deferrableBlockers] : []),
    ...(scheduleOverlapWarning ? [scheduleOverlapWarning] : []),
  ];

  const pristineHint =
    issueDisplayPhase === "pristine" &&
    user != null &&
    deferrableBlockers.length > 0
      ? "Content required to publish. Finish the poll, relays, and schedule (if needed) to continue."
      : undefined;
  const idleStatusLabel =
    issueDisplayPhase === "pristine" &&
    user != null &&
    deferrableBlockers.length > 0
      ? "Draft"
      : undefined;

  const readinessForRail =
    displayRedIssues.length > 0
      ? getReadinessPresentation(publishMode, displayRedIssues, user != null)
      : displayAmberIssues.length > 0
        ? ({
            tone: "warn",
            headline: "Missing requirements",
          } as const)
        : getReadinessPresentation(publishMode, [], user != null);

  const contentSummaryLines = [
    `${question.trim().length} characters (question)`,
    `${trimmedOptions.length} options`,
    selectedHashtags.trim() ? `Tags: ${selectedHashtags.trim()}` : "Tags: none",
  ];
  const publishPath = buildPublishPathSummary(
    relayCount,
    user != null ? "NIP-07" : "Not connected",
    selectedQueue
  );
  const pollQueueNextSlotLabel = getQueueNextSlotLabel(scheduledFor);

  const pollEndDatetimeLocalMin =
    pollEndMode === "absolute" &&
    latestPublishUnixSecForPollEnd != null &&
    Number.isFinite(latestPublishUnixSecForPollEnd)
      ? formatForDateTimeLocal(
          fromUnixTimestamp(latestPublishUnixSecForPollEnd, userTimezone).add({
            minutes: 1,
          }),
          userTimezone
        )
      : undefined;

  const relativePollEndPreviewLabel =
    pollEndMode === "relative" &&
    nominalPublishUnixSecForPreview != null &&
    Number.isFinite(pollEndHoursAfterPublish) &&
    pollEndHoursAfterPublish >= 1
      ? formatForDateTimeLocal(
          fromUnixTimestamp(
            nominalPublishUnixSecForPreview +
              Math.floor(pollEndHoursAfterPublish * 3600),
            userTimezone
          ),
          userTimezone
        )
      : null;

  const postStatusSummaryInline = formatPollPostStatusSummaryInline(
    question.trim().length,
    trimmedOptions.length,
    selectedHashtags,
    isRecyclable
  );

  const outcomeSentence = buildPublishingOutcomeSentence({
    publishMode,
    relayCount,
    signerReady: user != null,
    scheduledFor,
    hasScheduleTime: hasScheduleTime,
    selectedQueue,
    queueNextSlotLabel: publishMode === "queue" ? pollQueueNextSlotLabel : null,
  });

  const primaryActionLoading = isSubmitting || isSigning;
  const signerStatusContent = (
    <ComposerErrors
      isSigning={isSigning}
      signerLabel={null}
      inRail
      onCancelSigning={clearSigningState}
      signingError={signingError}
      onDismissSigningError={() => {
        setSigningError(null);
        setLastPublishFailed(false);
      }}
      onRetry={() => {
        void submitPoll(pollAction);
      }}
      disabled={disabled}
      signerReady={user != null}
    />
  );

  useEffect(() => {
    if (
      !pollDraftRestored ||
      skipLocalDraftRestore ||
      initialDraftId ||
      appliedPollRestoreRef.current
    )
      return;
    appliedPollRestoreRef.current = true;
    setQuestion(pollDraftRestored.question);
    setOptions(
      pollDraftRestored.options.length >= POLL_COMPOSER_MIN_OPTIONS
        ? pollDraftRestored.options
        : ["", ""]
    );
    setOptionRowIds(
      (pollDraftRestored.options.length >= POLL_COMPOSER_MIN_OPTIONS
        ? pollDraftRestored.options
        : ["", ""]
      ).map(() => newPollOptionRowId())
    );
    setPollType(pollDraftRestored.pollType);
    setEndsAtLocal(pollDraftRestored.endsAtLocal);
    setPollEndMode(pollDraftRestored.pollEndMode ?? "relative");
    setPollEndHoursAfterPublish(
      typeof pollDraftRestored.pollEndHoursAfterPublish === "number" &&
        pollDraftRestored.pollEndHoursAfterPublish >= 1
        ? pollDraftRestored.pollEndHoursAfterPublish
        : 24
    );
    setSelectedHashtags(pollDraftRestored.selectedHashtags);
    setHasManualIncludeHashtagsPreference(true);
    setIncludeHashtagsInNoteBody(
      pollDraftRestored.includeHashtagsInNoteBody !== false
    );
    setHashTagPresetId(pollDraftRestored.hashTagPresetId);
    setIsRecyclable(pollDraftRestored.isRecyclable);
    setSelectedQueue(pollDraftRestored.selectedQueue);
    setScheduledFor(pollDraftRestored.scheduledFor);
    setScheduleRandomWindowMinutes(
      pollDraftRestored.scheduleRandomWindowMinutes ?? 0
    );
    trackComposerEvent("composer_draft_restored", {
      source: "poll",
      mode: "local",
    });
  }, [
    pollDraftRestored,
    setScheduledFor,
    setSelectedQueue,
    skipLocalDraftRestore,
    initialDraftId,
  ]);

  useEffect(() => {
    if (
      !initialPollRestore ||
      !initialDraftId ||
      serverPollRestoreAppliedRef.current
    ) {
      return;
    }
    serverPollRestoreAppliedRef.current = true;
    setQuestion(initialPollRestore.question);
    setOptions(
      initialPollRestore.options.length >= POLL_COMPOSER_MIN_OPTIONS
        ? initialPollRestore.options
        : ["", ""]
    );
    setOptionRowIds(
      (initialPollRestore.options.length >= POLL_COMPOSER_MIN_OPTIONS
        ? initialPollRestore.options
        : ["", ""]
      ).map(() => newPollOptionRowId())
    );
    setPollType(initialPollRestore.pollType);
    if (initialPollRestore.endsAtUnix != null) {
      setPollEndMode("absolute");
      setEndsAtLocal(
        formatForDateTimeLocal(
          fromUnixTimestamp(initialPollRestore.endsAtUnix, userTimezone),
          userTimezone
        )
      );
    } else {
      setEndsAtLocal("");
    }
    setSelectedHashtags(initialPollRestore.selectedHashtags);
    setHasManualIncludeHashtagsPreference(true);
    setIncludeHashtagsInNoteBody(
      initialPollRestore.includeHashtagsInNoteBody !== false
    );
    setHashTagPresetId(initialPollRestore.hashTagPresetId);
    setIsRecyclable(Boolean(initialPollRestore.isRecyclable));
    setSelectedQueue(initialPollRestore.queueType);
    applyQueueDefaultScheduleRandom(initialPollRestore.queueType);
    trackComposerEvent("composer_draft_restored", {
      source: "poll",
      mode: "server",
    });
  }, [
    initialPollRestore,
    initialDraftId,
    userTimezone,
    setSelectedQueue,
    applyQueueDefaultScheduleRandom,
  ]);

  useEffect(() => {
    const snapshot = {
      question,
      options,
      pollType,
      endsAtLocal,
      pollEndMode,
      pollEndHoursAfterPublish,
      selectedHashtags,
      includeHashtagsInNoteBody,
      hashTagPresetId,
      isRecyclable,
      selectedQueue,
      scheduledFor,
      publishMode,
      scheduleRandomWindowMinutes,
    };
    savePollDraftSnapshot(snapshot);
  }, [
    question,
    options,
    pollType,
    endsAtLocal,
    pollEndMode,
    pollEndHoursAfterPublish,
    selectedHashtags,
    includeHashtagsInNoteBody,
    hashTagPresetId,
    isRecyclable,
    selectedQueue,
    scheduledFor,
    publishMode,
    scheduleRandomWindowMinutes,
    savePollDraftSnapshot,
  ]);

  useEffect(() => {
    const flush = () => {
      flushPollDraftSnapshot({
        question,
        options,
        pollType,
        endsAtLocal,
        pollEndMode,
        pollEndHoursAfterPublish,
        selectedHashtags,
        includeHashtagsInNoteBody,
        hashTagPresetId,
        isRecyclable,
        selectedQueue,
        scheduledFor,
        publishMode,
        scheduleRandomWindowMinutes,
      });
    };
    const onHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [
    question,
    options,
    pollType,
    endsAtLocal,
    pollEndMode,
    pollEndHoursAfterPublish,
    selectedHashtags,
    includeHashtagsInNoteBody,
    hashTagPresetId,
    isRecyclable,
    selectedQueue,
    scheduledFor,
    publishMode,
    scheduleRandomWindowMinutes,
    flushPollDraftSnapshot,
  ]);

  useEffect(() => {
    if (!onDraftStateLabelChange) return;
    if (isSubmitting) {
      onDraftStateLabelChange("Saving…");
      return;
    }
    if (!skipLocalDraftRestore) {
      onDraftStateLabelChange("Saved locally");
      return;
    }
    onDraftStateLabelChange("");
  }, [isSubmitting, skipLocalDraftRestore, onDraftStateLabelChange]);

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const data = fetcher.data as { error?: string } | undefined;
    if (data?.error) return;
    if (!publishSubmitInFlight) return;
    clearPollDraftSnapshot();
  }, [
    fetcher.state,
    fetcher.data,
    publishSubmitInFlight,
    clearPollDraftSnapshot,
  ]);

  // Defer setState to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (blockers.length === 0 && publishAttempted) {
      queueMicrotask(() => setPublishAttempted(false));
    }
  }, [blockers.length, publishAttempted]);

  useEffect(() => {
    if (
      question.trim().length > 0 ||
      trimmedOptions.some((o) => o.trim().length > 0) ||
      selectedHashtags.trim().length > 0
    ) {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [question, trimmedOptions, selectedHashtags]);

  useEffect(() => {
    if (publishMode !== "now") {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [publishMode]);

  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [selectedQueue]);

  useEffect(() => {
    if (scheduledFor.trim()) {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [scheduledFor]);

  const handleRelayRailClick = useCallback(() => {
    setComposerTouched(true);
    onRelayClick?.();
  }, [onRelayClick]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="mb-4 min-w-0 flex-1 lg:mb-0">
        <ComposerLeftCanvas>
          <div className={composerCanvasFieldStackClass}>
            <ComposerCanvasSectionLabel
              as="label"
              className="mb-0"
              htmlFor="poll-question"
            >
              Question
            </ComposerCanvasSectionLabel>
            <div className="focus-within:bg-surface-hover/50 focus-within:ring-border-subtle rounded-md transition-colors focus-within:ring-1">
              <textarea
                id="poll-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={disabled}
                rows={4}
                className="text-text placeholder:text-text-tertiary/85 min-h-[7.5rem] w-full resize-y border-0 bg-transparent px-0.5 pt-0.5 pb-1 text-base leading-relaxed shadow-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="What do you want to ask?"
              />
            </div>
          </div>

          <ComposerCanvasDivider />

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <ComposerCanvasSectionLabel as="span" className="mb-0">
                Options
              </ComposerCanvasSectionLabel>
              <p className="text-text-tertiary text-[10px] leading-snug">
                {options.length} of {POLL_COMPOSER_MAX_OPTIONS} · paste multiple
                lines to fill options
              </p>
            </div>
            <div className="border-border-subtle bg-surface-hover/40 border-l-brand/30 overflow-hidden rounded-lg border border-l-2">
              <ul className="divide-border-subtle divide-y">
                {options.map((opt, i) => (
                  <li
                    key={optionRowIds[i] ?? `opt-fallback-${i}`}
                    className="flex items-center gap-2 py-2 pr-1 pl-2 sm:pl-2.5"
                  >
                    <span
                      className="text-text-tertiary/70 w-5 shrink-0 text-center text-[11px] tabular-nums"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOptions((prev) =>
                          prev.map((p, j) => (j === i ? v : p))
                        );
                      }}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData("text");
                        if (!pasted.includes("\n")) return;
                        e.preventDefault();
                        const rows = pasted
                          .split("\n")
                          .map((r) => r.trim())
                          .filter(Boolean)
                          .slice(0, POLL_COMPOSER_MAX_OPTIONS);
                        if (rows.length < 2) return;
                        setOptions(rows);
                        setOptionRowIds(rows.map(() => newPollOptionRowId()));
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (options.length >= POLL_COMPOSER_MAX_OPTIONS) return;
                        if (i !== options.length - 1) return;
                        setOptions((prev) => [...prev, ""]);
                        setOptionRowIds((ids) => [
                          ...ids,
                          newPollOptionRowId(),
                        ]);
                      }}
                      disabled={disabled}
                      placeholder={`Option ${i + 1}`}
                      className="border-border-subtle bg-canvas/70 h-8 flex-1 border text-sm shadow-none"
                      aria-label={`Poll option ${i + 1}`}
                    />
                    {options.length > POLL_COMPOSER_MIN_OPTIONS ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        aria-label={`Remove option ${i + 1}`}
                        className="text-text-secondary h-8 w-8 shrink-0 opacity-70 hover:opacity-100"
                        onClick={() => {
                          setOptions((prev) => prev.filter((_, j) => j !== i));
                          setOptionRowIds((prev) =>
                            prev.filter((_, j) => j !== i)
                          );
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="w-8 shrink-0" aria-hidden />
                    )}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={
                  disabled || options.length >= POLL_COMPOSER_MAX_OPTIONS
                }
                className="text-text-secondary hover:text-text border-border-subtle h-9 w-full rounded-none rounded-b-lg border-t border-dashed text-xs font-normal"
                onClick={() => {
                  setOptions((o) => [...o, ""]);
                  setOptionRowIds((ids) => [...ids, newPollOptionRowId()]);
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add option
              </Button>
            </div>
          </div>

          <ComposerCanvasDivider />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={composerCanvasFieldStackClass}>
              <label
                htmlFor="poll-type"
                className="text-text-secondary text-xs font-medium"
              >
                Voting mode
              </label>
              <select
                id="poll-type"
                value={pollType}
                onChange={(e) =>
                  setPollType(
                    e.target.value === "multiplechoice"
                      ? "multiplechoice"
                      : "singlechoice"
                  )
                }
                disabled={disabled}
                className="border-border bg-surface-hover/40 text-text-secondary shadow-1 h-9 w-full rounded-md border px-2.5 text-xs"
              >
                <option value="singlechoice">Single choice</option>
                <option value="multiplechoice">Multiple choice</option>
              </select>
            </div>
            <div className={composerCanvasFieldStackClass}>
              <label
                htmlFor="poll-end-mode"
                className="text-text-secondary text-xs font-medium"
              >
                Poll end
              </label>
              <select
                id="poll-end-mode"
                value={pollEndMode}
                onChange={(e) =>
                  setPollEndMode(
                    e.target.value === "relative" ? "relative" : "absolute"
                  )
                }
                disabled={disabled}
                className="border-border bg-surface-hover/40 text-text-secondary shadow-1 h-9 w-full rounded-md border px-2.5 text-xs"
              >
                <option value="relative">Hours after publish</option>
                <option value="absolute">Date and time</option>
              </select>
            </div>
          </div>
          {pollEndMode === "absolute" ? (
            <div className={composerCanvasFieldStackClass}>
              <label
                htmlFor="poll-ends"
                className="text-text-secondary text-xs font-medium"
              >
                Closes at
              </label>
              <Input
                id="poll-ends"
                type="datetime-local"
                value={endsAtLocal}
                min={pollEndDatetimeLocalMin}
                onChange={(e) => setEndsAtLocal(e.target.value)}
                disabled={disabled}
                className="border-border bg-surface-hover/40 shadow-1 h-9 text-xs"
              />
              <p className="text-text-tertiary text-[10px] leading-snug">
                Must be after publish time from the rail (Now, Schedule, or
                Queue), including any schedule random window.
              </p>
            </div>
          ) : (
            <div className={composerCanvasFieldStackClass}>
              <label
                htmlFor="poll-ends-hours"
                className="text-text-secondary text-xs font-medium"
              >
                Hours after publish
              </label>
              <Input
                id="poll-ends-hours"
                type="number"
                inputMode="numeric"
                min={1}
                max={POLL_MAX_HOURS_AFTER_PUBLISH}
                step={1}
                value={pollEndHoursAfterPublish}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return;
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  setPollEndHoursAfterPublish(n);
                }}
                disabled={disabled}
                className="border-border bg-surface-hover/40 shadow-1 h-9 text-xs"
              />
              {relativePollEndPreviewLabel ? (
                <p className="text-text-secondary text-[10px] leading-snug">
                  Estimated close (from current publish time):{" "}
                  <span className="text-text font-medium tabular-nums">
                    {relativePollEndPreviewLabel.replace("T", " ")}
                  </span>
                  {publishMode !== "now" && scheduleRandomWindowMinutes > 0 ? (
                    <span>
                      {" "}
                      · closes {pollEndHoursAfterPublish} hour
                      {pollEndHoursAfterPublish === 1 ? "" : "s"} after the
                      actual publish moment (slot may shift slightly)
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="text-text-tertiary text-[10px] leading-snug">
                  Uses the same publish time as in the rail (Now, Schedule, or
                  Queue). The poll closes this many hours after the post goes
                  live.
                </p>
              )}
            </div>
          )}

          <ComposerCanvasDivider />

          <div className="flex flex-col gap-4 sm:gap-5">
            <PollComposerPreviewBlock
              question={question}
              options={options}
              optionRowIds={optionRowIds}
              pollType={pollType}
              tagsLine={selectedHashtags}
              includeHashtagsInNoteBody={includeHashtagsInNoteBody}
              pollEndMode={pollEndMode}
              endsAtLocal={endsAtLocal}
              pollEndHoursAfterPublish={pollEndHoursAfterPublish}
              publishMode={publishMode}
              scheduledFor={scheduledFor}
              userTimezone={userTimezone}
            />
            <ComposerCanvasDivider />
            <TagsChipRow
              tags={selectedHashtags}
              onTagsChange={(t) => {
                setSelectedHashtags(t);
                if (!t.trim()) {
                  setHashTagPresetId(null);
                }
              }}
              presets={hashTagPresets}
              selectedPresetId={
                hashTagPresetId ?? selectedHashTagPresetId ?? null
              }
              onPresetSelect={(id, tags) => {
                setHashTagPresetId(id);
                setSelectedHashtags(tags);
                onHashtagPresetChange?.(id, tags);
              }}
              disabled={disabled}
              includeHashtagsInNoteBody={includeHashtagsInNoteBody}
              onIncludeHashtagsInNoteBodyChange={(value) => {
                setHasManualIncludeHashtagsPreference(true);
                setIncludeHashtagsInNoteBody(value);
              }}
            />
          </div>
        </ComposerLeftCanvas>
      </div>

      <PublishingSummaryRail
        publishMode={publishMode}
        onPublishModeChange={onPublishModeChange ?? (() => void 0)}
        statusContent={signerStatusContent}
        outcomeSentence={outcomeSentence}
        readiness={readinessForRail}
        sessionStrip={{
          composerStatus,
          relayCount,
          onRelayClick: handleRelayRailClick,
          signerLabel: user != null ? "NIP-07" : "Not connected",
        }}
        modeSpecificSection={getPollComposerModeSpecificSection({
          publishMode,
          disabled,
          queueTypes,
          selectedQueue,
          handlePollQueueChange,
          selectedQueueType,
          scheduledFor,
          setScheduledFor,
          scheduleIntervals,
          handleScheduleIntervalClick,
          calculateQueueScheduleTime,
          scheduleRandomWindowMinutes,
          setScheduleRandomWindowMinutes,
          userTimezone,
          pollQueueNextSlotLabel,
        })}
        recyclableControl={{
          switchId: "poll-recyclable",
          checked: isRecyclable,
          onCheckedChange: setIsRecyclable,
          disabled,
        }}
        postStatusSummaryInline={postStatusSummaryInline}
        publishSummaryOptionsLine={formatPublishSummaryOptionsLine({
          followUpSummaryLine: "None",
          showRecyclable: true,
          isRecyclable,
        })}
        contentSummaryLines={contentSummaryLines}
        publishPath={publishPath}
        issues={displayRedIssues}
        warnings={displayAmberIssues}
        pristineHint={pristineHint}
        idleStatusLabel={idleStatusLabel}
        primaryActionLabel={primaryLabel}
        primaryActionLoading={primaryActionLoading}
        primaryActionLoadingLabel={getPrimaryCtaPendingLabelForMode(
          publishMode,
          "poll"
        )}
        onPrimaryAction={() => {
          void submitPoll(pollAction);
        }}
        onPrimaryActionBlocked={() => setPublishAttempted(true)}
        primaryActionDisabled={
          user == null ||
          disabled ||
          !hasContent ||
          !canSubmit ||
          blockers.length > 0
        }
        secondaryActionLabel="Save draft"
        onSecondaryAction={() => {
          flushPollDraftSnapshot({
            question,
            options,
            pollType,
            endsAtLocal,
            pollEndMode,
            pollEndHoursAfterPublish,
            selectedHashtags,
            includeHashtagsInNoteBody,
            hashTagPresetId,
            isRecyclable,
            selectedQueue,
            scheduledFor,
            publishMode,
            scheduleRandomWindowMinutes,
          });
          trackComposerEvent("composer_draft_saved", {
            source: "poll",
            mode: "local",
          });
        }}
        secondaryActionDisabled={disabled}
      />
    </div>
  );
}
