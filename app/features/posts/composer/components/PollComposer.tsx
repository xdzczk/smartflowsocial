/**
 * NIP-88 poll composer (kind 1068): question, options, schedule/publish via newpost action.
 */

import { useFetcher, useNavigate } from "@remix-run/react";
import { BarChart3, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PublishingSummaryRail } from "~/features/posts/components/ConfidencePanel";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import { TagsChipRow } from "~/features/posts/components/TagsChipRow";
import { trackComposerEvent } from "~/features/posts/composer/utils/composer-analytics.client";
import { DraftPickerModal } from "~/features/posts/drafts";
import { usePostScheduling } from "~/features/posts/scheduling";
import type { QueueType } from "~/features/posts/types";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { nowMillis } from "~/lib/temporal";

import { useLocalDraft } from "../hooks/useComposerLocalDraft";
import { useComposerSignerReconnect } from "../hooks/useComposerSignerReconnect";
import { useComposerState } from "../hooks/useComposerState";

import {
  ComposerErrors,
  ComposerQueueField,
  ComposerScheduleField,
  PollOutputPanel,
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

const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;
const COMPOSER_SCHEDULE_FUTURE = "Schedule time must be in the future.";

function newPollOptionRowId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseTopicTagValues(hashtagLine: string): string[] {
  return hashtagLine
    .split(/\s+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/^#/u, ""));
}

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
  /** When set (including empty), show "Drafts / Templates" with template-only picker. */
  composerTemplates?: Array<{ id: string; name: string | null }>;
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
  composerTemplates,
}: PollComposerProps) {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const user = useOptionalUser();
  const draftTemplatesPickerEnabled = composerTemplates !== undefined;
  const [draftTemplatesPickerOpen, setDraftTemplatesPickerOpen] =
    useState(false);
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
  const [selectedHashtags, setSelectedHashtags] = useState("");
  const [hashTagPresetId, setHashTagPresetId] = useState<string | null>(null);
  const [isRecyclable, setIsRecyclable] = useState(false);
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
    selectedHashtags: string;
    hashTagPresetId: string | null;
    isRecyclable: boolean;
    selectedQueue: string;
    scheduledFor: string;
    publishMode: ComposerPublishMode;
    savedAt: number;
  }>(pollDraftStorageKey, skipLocalDraftRestore, 1500);
  const appliedPollRestoreRef = useRef(false);

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
    initialQueue: "unassigned",
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
    question.trim().length > 0 && trimmedOptions.length >= MIN_OPTIONS;
  const canSubmit = trimmedOptions.length >= MIN_OPTIONS;
  const hasScheduleTime = scheduledFor.trim().length > 0;
  const isSubmitting = fetcher.state !== "idle";

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
    if (trimmedOptions.length < MIN_OPTIONS) {
      toast.error(`Add at least ${MIN_OPTIONS} options.`);
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
        toast.error(COMPOSER_SCHEDULE_FUTURE);
        return;
      }
    }

    const nominalUnix = Math.floor(scheduledTimeMs / 1000);
    let endsAtUnix: number | undefined;
    if (endsAtLocal.trim()) {
      const endMs = await parseScheduledTime(endsAtLocal, userTimezone);
      endsAtUnix = Math.floor(endMs / 1000);
      if (endsAtUnix <= nominalUnix) {
        toast.error("Poll end time must be after publish time.");
        return;
      }
    }

    setIsSigning(true);
    setPublishSubmitInFlight(true);
    try {
      const { nostrEvent, signedEvent } =
        await nostrAdapter.signPollEventWithOneRetry({
          question: q,
          created_at: nominalUnix,
          optionLabels: trimmedOptions,
          pollType,
          relayUrls,
          endsAt: endsAtUnix,
          topicTagValues: parseTopicTagValues(selectedHashtags),
        });

      const fd = new FormData();
      fd.set("_action", actionType);
      fd.set("contentType", "poll");
      fd.set("content", q);
      fd.set("queueType", selectedQueue);
      if (queueTypeId) fd.set("queueTypeId", queueTypeId);
      if (isRecyclable) fd.set("isRecyclable", "on");
      if (hashTagPresetId) {
        fd.set("useHashtagPresets", "on");
        fd.set("hashTagPresetId", hashTagPresetId);
      }
      fd.set("signedEvent", JSON.stringify(signedEvent));
      fd.set("nostrEvent", JSON.stringify(nostrEvent));
      if (relayOverride && relayOverride.length > 0) {
        fd.set("relays", JSON.stringify(relayOverride));
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
  if (trimmedOptions.length < MIN_OPTIONS) {
    deferrableBlockers.push(
      `At least ${MIN_OPTIONS} poll options are required`
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

  const blockers = deferrableBlockers;
  const issueDisplayPhase = resolveComposerIssueDisplayPhase(
    publishAttempted,
    composerTouched
  );
  const displayRedIssues =
    issueDisplayPhase === "blocking" ? [...deferrableBlockers] : [];
  const displayAmberIssues =
    issueDisplayPhase === "soft" ? [...deferrableBlockers] : [];

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

  useEffect(() => {
    if (
      !pollDraftRestored ||
      skipLocalDraftRestore ||
      appliedPollRestoreRef.current
    )
      return;
    appliedPollRestoreRef.current = true;
    setQuestion(pollDraftRestored.question);
    setOptions(
      pollDraftRestored.options.length >= MIN_OPTIONS
        ? pollDraftRestored.options
        : ["", ""]
    );
    setOptionRowIds(
      (pollDraftRestored.options.length >= MIN_OPTIONS
        ? pollDraftRestored.options
        : ["", ""]
      ).map(() => newPollOptionRowId())
    );
    setPollType(pollDraftRestored.pollType);
    setEndsAtLocal(pollDraftRestored.endsAtLocal);
    setSelectedHashtags(pollDraftRestored.selectedHashtags);
    setHashTagPresetId(pollDraftRestored.hashTagPresetId);
    setIsRecyclable(pollDraftRestored.isRecyclable);
    setSelectedQueue(pollDraftRestored.selectedQueue);
    setScheduledFor(pollDraftRestored.scheduledFor);
    onDraftStateLabelChange?.("Restored local draft");
    trackComposerEvent("composer_draft_restored", {
      source: "poll",
      mode: "local",
    });
  }, [
    pollDraftRestored,
    setScheduledFor,
    setSelectedQueue,
    skipLocalDraftRestore,
    onDraftStateLabelChange,
  ]);

  useEffect(() => {
    const snapshot = {
      question,
      options,
      pollType,
      endsAtLocal,
      selectedHashtags,
      hashTagPresetId,
      isRecyclable,
      selectedQueue,
      scheduledFor,
      publishMode,
    };
    savePollDraftSnapshot(snapshot);
  }, [
    question,
    options,
    pollType,
    endsAtLocal,
    selectedHashtags,
    hashTagPresetId,
    isRecyclable,
    selectedQueue,
    scheduledFor,
    publishMode,
    savePollDraftSnapshot,
  ]);

  useEffect(() => {
    const flush = () => {
      flushPollDraftSnapshot({
        question,
        options,
        pollType,
        endsAtLocal,
        selectedHashtags,
        hashTagPresetId,
        isRecyclable,
        selectedQueue,
        scheduledFor,
        publishMode,
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
    selectedHashtags,
    hashTagPresetId,
    isRecyclable,
    selectedQueue,
    scheduledFor,
    publishMode,
    flushPollDraftSnapshot,
  ]);

  useEffect(() => {
    if (!onDraftStateLabelChange) return;
    onDraftStateLabelChange(isSubmitting ? "Saving..." : "Saved");
  }, [isSubmitting, onDraftStateLabelChange]);

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
      <div className="border-border bg-card/30 min-w-0 flex-1 rounded-xl border p-6">
        <div className="text-muted-foreground mb-4 flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden />
            NIP-88 poll
          </div>
          {draftTemplatesPickerEnabled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDraftTemplatesPickerOpen(true)}
              aria-label="Drafts / Templates"
            >
              <FolderOpen
                className={`mr-1 ${INLINE_ICON_SIZE_CLASS}`}
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
              Drafts / Templates
            </Button>
          ) : null}
        </div>
        <div className="space-y-4">
          <ComposerErrors
            isSigning={isSigning}
            signerLabel={null}
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

          <div className="space-y-2">
            <Label htmlFor="poll-question">Question</Label>
            <textarea
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={disabled}
              rows={3}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="What do you want to ask?"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Options ({options.length}/{MAX_OPTIONS})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || options.length >= MAX_OPTIONS}
                onClick={() => {
                  setOptions((o) => [...o, ""]);
                  setOptionRowIds((ids) => [...ids, newPollOptionRowId()]);
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add option
              </Button>
            </div>
            <ul className="space-y-2">
              {options.map((opt, i) => (
                <li
                  key={optionRowIds[i] ?? `opt-fallback-${i}`}
                  className="flex gap-2"
                >
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
                        .slice(0, MAX_OPTIONS);
                      if (rows.length < 2) return;
                      setOptions(rows);
                      setOptionRowIds(rows.map(() => newPollOptionRowId()));
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (options.length >= MAX_OPTIONS) return;
                      if (i !== options.length - 1) return;
                      setOptions((prev) => [...prev, ""]);
                      setOptionRowIds((ids) => [...ids, newPollOptionRowId()]);
                    }}
                    disabled={disabled}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1"
                  />
                  {options.length > MIN_OPTIONS ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() => {
                        setOptions((prev) => prev.filter((_, j) => j !== i));
                        setOptionRowIds((prev) =>
                          prev.filter((_, j) => j !== i)
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="poll-type">Voting mode</Label>
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
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="singlechoice">Single choice</option>
                <option value="multiplechoice">Multiple choice</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="poll-ends">Poll end</Label>
              <Input
                id="poll-ends"
                type="datetime-local"
                value={endsAtLocal}
                onChange={(e) => setEndsAtLocal(e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>

          <PollOutputPanel
            question={question}
            options={options}
            optionRowIds={optionRowIds}
            tagsLine={selectedHashtags}
            pollTypeLabel={
              pollType === "multiplechoice"
                ? "Multiple choice"
                : "Single choice"
            }
          />

          <div className="mt-4">
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
            />
          </div>

          <div className="text-muted-foreground text-xs">
            Primary publish action is available in the Publishing Summary rail.
          </div>
        </div>
      </div>

      <PublishingSummaryRail
        publishMode={publishMode}
        onPublishModeChange={onPublishModeChange ?? (() => void 0)}
        outcomeSentence={outcomeSentence}
        readiness={readinessForRail}
        sessionStrip={{
          composerStatus,
          relayCount,
          onRelayClick: handleRelayRailClick,
          signerLabel: user != null ? "NIP-07" : "Not connected",
          saveStateLabel: isSubmitting
            ? "Saving…"
            : "All changes saved locally",
        }}
        modeSpecificSection={
          publishMode === "now"
            ? undefined
            : {
                title: publishMode === "queue" ? "Queue" : "Schedule",
                lines:
                  publishMode === "queue"
                    ? [
                        ...(selectedQueueType &&
                        typeof selectedQueueType === "object" &&
                        (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
                          selectedQueueType.scheduleType === "WEEKLY_SLOTS") &&
                        pollQueueNextSlotLabel
                          ? [`Next slot (estimate): ${pollQueueNextSlotLabel}`]
                          : []),
                      ]
                    : [],
                controls:
                  publishMode === "queue" ? (
                    <div className="space-y-2">
                      <ComposerQueueField
                        queueTypes={queueTypes}
                        value={selectedQueue}
                        onChange={setSelectedQueue}
                        disabled={disabled}
                        nextSlot={
                          selectedQueueType &&
                          typeof selectedQueueType === "object" &&
                          (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
                            selectedQueueType.scheduleType === "WEEKLY_SLOTS")
                            ? getQueueNextSlotLabel(scheduledFor)
                            : undefined
                        }
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ComposerScheduleField
                        layout="minimal"
                        value={scheduledFor}
                        onValueChange={setScheduledFor}
                        scheduleIntervals={scheduleIntervals}
                        queueTypes={queueTypes}
                        selectedQueue={selectedQueue}
                        onScheduleIntervalClick={handleScheduleIntervalClick}
                        onCalculateNextSlot={() => {
                          void calculateQueueScheduleTime(selectedQueue);
                        }}
                        scheduleRandomWindowMinutes={0}
                        onScheduleRandomWindowMinutesChange={() => void 0}
                        postOptionsOpen={false}
                        onPostOptionsOpenChange={() => void 0}
                        isThreadMode={false}
                        onThreadModeChange={() => void 0}
                        alsoScheduleRepost={false}
                        onAlsoScheduleRepostChange={() => void 0}
                        repostDelayList={[]}
                        onRepostDelayListChange={(_value) => void _value}
                        repostConditions={null}
                        onRepostConditionsChange={() => void 0}
                        alsoScheduleQuote={false}
                        onAlsoScheduleQuoteChange={() => void 0}
                        quoteEntries={[]}
                        onQuoteEntriesChange={(_value) => void _value}
                        disabled={disabled}
                        userTimezone={userTimezone}
                        showThreadModeToggle={false}
                      />
                    </div>
                  ),
              }
        }
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
            selectedHashtags,
            hashTagPresetId,
            isRecyclable,
            selectedQueue,
            scheduledFor,
            publishMode,
          });
          onDraftStateLabelChange?.("Saved locally");
          trackComposerEvent("composer_draft_saved", {
            source: "poll",
            mode: "local",
          });
        }}
        secondaryActionDisabled={disabled}
      />
      {draftTemplatesPickerEnabled ? (
        <DraftPickerModal
          open={draftTemplatesPickerOpen}
          onClose={() => setDraftTemplatesPickerOpen(false)}
          type="short"
          shortDraftFilter="poll"
          onSelect={(id) =>
            navigate(
              `/dashboard/compose?type=poll&draftId=${encodeURIComponent(id)}`
            )
          }
          draftsAndTemplates={{
            templates: composerTemplates,
            onSelectTemplate: (templateId) =>
              navigate(
                `/dashboard/compose?type=poll&templateId=${encodeURIComponent(templateId)}`
              ),
          }}
        />
      ) : null}
    </div>
  );
}
