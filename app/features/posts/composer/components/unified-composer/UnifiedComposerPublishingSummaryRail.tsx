import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import { AlsoScheduleBlock } from "~/features/posts/components/AlsoScheduleBlock";
import { PublishingSummaryRail } from "~/features/posts/components/ConfidencePanel";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import {
  RailChip,
  RailChipGroup,
} from "~/features/posts/components/publishing-rail";
import type { TextPostFormData } from "~/features/posts/composer/hooks/composer-submit-types";
import type { QueueType, RepostConditions } from "~/features/posts/types";

import type { DelayAfterMain } from "../../../utils/delay-after-main";
import {
  ComposerQueueField,
  ComposerScheduleField,
  ComposerScheduleRandomWindowField,
  formatPublishSummaryOptionsLine,
  getPrimaryCtaLabelForMode,
  getPrimaryCtaPendingLabelForMode,
  getQueueNextSlotLabel,
  type ComposerPublishMode,
  type PublishPathSummary,
  type ReadinessPresentation,
} from "../composer";

import {
  QUEUE_SCHEDULE_RANDOM_WINDOW_OPTIONS,
  THREAD_CADENCE_MINUTES_CHIPS,
} from "./unified-composer-constants";

export interface UnifiedComposerPublishingSummaryRailProps {
  publishMode: ComposerPublishMode;
  onPublishModeChange: (next: ComposerPublishMode) => void;
  outcomeSentence: string;
  readinessForRail: ReadinessPresentation;
  composerStatus: ComposerStatus;
  relayCount: number;
  signerReady: boolean | null;
  signerLabel: string | null;
  handleRelayRailClick: () => void;
  queueTypes: Array<string | QueueType>;
  selectedQueue: string;
  setSelectedQueue: (q: string) => void;
  disabled: boolean;
  form: UseFormReturn<TextPostFormData>;
  formScheduledFor: string | undefined;
  schedulingScheduledFor: string | null;
  setSchedulingScheduledFor: (v: string) => void;
  scheduleIntervals: number[];
  handleScheduleIntervalClick: (intervalHours: string | number) => void;
  calculateQueueScheduleTime: (
    queueName: string
  ) => void | Promise<void> | Promise<string | null>;
  scheduleRandomWindowMinutes: number;
  setScheduleRandomWindowMinutes: (n: number) => void;
  userTimezone: string;
  selectedQueueType: string | QueueType | undefined;
  repostDelayList: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
  }>;
  setRepostDelayList: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; value: number; unit: DelayAfterMain["unit"] }>
    >
  >;
  repostConditions: RepostConditions | null;
  setRepostConditions: React.Dispatch<
    React.SetStateAction<RepostConditions | null>
  >;
  quoteEntries: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
    caption: string;
  }>;
  setQuoteEntries: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string;
        value: number;
        unit: DelayAfterMain["unit"];
        caption: string;
      }>
    >
  >;
  followUpSummaryLine: string;
  postStatusSummaryInline: string;
  publishSummaryTagsLine: string | undefined;
  isRecyclableVal: boolean;
  contentSummaryLines: string[];
  publishPath: PublishPathSummary;
  isThreadMode: boolean;
  threadDelayMinutes: number;
  setThreadDelayMinutes: (n: number) => void;
  setComposerTouched: (v: boolean) => void;
  threadSettingsLines: string[];
  displayRedIssues: string[];
  displayAmberIssues: string[];
  pristineHint: string | undefined;
  idleStatusLabel: string | undefined;
  primaryActionLoading: boolean;
  issueListLength: number;
  primarySubmitRef: React.RefObject<HTMLButtonElement | null>;
  draftSubmitRef: React.RefObject<HTMLButtonElement | null>;
  onPrimaryActionBlocked: () => void;
}

export function UnifiedComposerPublishingSummaryRail({
  publishMode,
  onPublishModeChange,
  outcomeSentence,
  readinessForRail,
  composerStatus,
  relayCount,
  signerReady,
  signerLabel,
  handleRelayRailClick,
  queueTypes,
  selectedQueue,
  setSelectedQueue,
  disabled,
  form,
  formScheduledFor,
  schedulingScheduledFor,
  setSchedulingScheduledFor,
  scheduleIntervals,
  handleScheduleIntervalClick,
  calculateQueueScheduleTime,
  scheduleRandomWindowMinutes,
  setScheduleRandomWindowMinutes,
  userTimezone,
  selectedQueueType,
  repostDelayList,
  setRepostDelayList,
  repostConditions,
  setRepostConditions,
  quoteEntries,
  setQuoteEntries,
  followUpSummaryLine,
  postStatusSummaryInline,
  publishSummaryTagsLine,
  isRecyclableVal,
  contentSummaryLines,
  publishPath,
  isThreadMode,
  threadDelayMinutes,
  setThreadDelayMinutes,
  setComposerTouched,
  threadSettingsLines,
  displayRedIssues,
  displayAmberIssues,
  pristineHint,
  idleStatusLabel,
  primaryActionLoading,
  issueListLength,
  primarySubmitRef,
  draftSubmitRef,
  onPrimaryActionBlocked,
}: UnifiedComposerPublishingSummaryRailProps) {
  const queueNextSlotLabel = getQueueNextSlotLabel(
    formScheduledFor ?? schedulingScheduledFor ?? ""
  );

  const modeSpecificSection =
    publishMode === "now"
      ? undefined
      : {
          lines:
            publishMode === "queue"
              ? [
                  ...(selectedQueueType &&
                  typeof selectedQueueType === "object" &&
                  (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
                    selectedQueueType.scheduleType === "WEEKLY_SLOTS") &&
                  queueNextSlotLabel
                    ? [`Next slot (estimate): ${queueNextSlotLabel}`]
                    : []),
                ]
              : [],
          controls:
            publishMode === "queue" ? (
              <div className="space-y-3">
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
                      ? getQueueNextSlotLabel(
                          formScheduledFor ?? schedulingScheduledFor ?? ""
                        )
                      : undefined
                  }
                />
                {selectedQueue !== "unassigned" ? (
                  <ComposerScheduleRandomWindowField
                    scheduleRandomWindowMinutes={scheduleRandomWindowMinutes}
                    onScheduleRandomWindowMinutesChange={
                      setScheduleRandomWindowMinutes
                    }
                    disabled={disabled}
                    windowOptions={QUEUE_SCHEDULE_RANDOM_WINDOW_OPTIONS}
                    label="Randomize within queue slot"
                    idPrefix="queue-schedule-randomize"
                    description="Optional jitter around the next slot time. Cadence still follows the nominal slot. Queue settings load a default; change here for this post only."
                  />
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <ComposerScheduleField
                  value={formScheduledFor ?? ""}
                  onValueChange={(v) => {
                    form.setValue("scheduledFor", v);
                    setSchedulingScheduledFor(v);
                  }}
                  scheduleIntervals={scheduleIntervals}
                  queueTypes={queueTypes}
                  selectedQueue={selectedQueue}
                  onScheduleIntervalClick={handleScheduleIntervalClick}
                  onCalculateNextSlot={() =>
                    void calculateQueueScheduleTime(selectedQueue)
                  }
                  scheduleRandomWindowMinutes={scheduleRandomWindowMinutes}
                  onScheduleRandomWindowMinutesChange={
                    setScheduleRandomWindowMinutes
                  }
                  disabled={disabled}
                  userTimezone={userTimezone}
                />
              </div>
            ),
        };

  const followUpChildren: ReactNode = (
    <AlsoScheduleBlock
      repostDelayList={repostDelayList}
      onRepostDelayListChange={setRepostDelayList}
      repostConditions={repostConditions}
      onRepostConditionsChange={setRepostConditions}
      quoteEntries={quoteEntries}
      onQuoteEntriesChange={setQuoteEntries}
      disabled={disabled}
    />
  );

  return (
    <PublishingSummaryRail
      publishMode={publishMode}
      onPublishModeChange={onPublishModeChange}
      outcomeSentence={outcomeSentence}
      readiness={readinessForRail}
      sessionStrip={{
        composerStatus,
        relayCount,
        onRelayClick: handleRelayRailClick,
        signerLabel: signerReady === false ? "Not connected" : signerLabel,
      }}
      modeSpecificSection={modeSpecificSection}
      followUp={{
        summaryLine: followUpSummaryLine,
        children: followUpChildren,
      }}
      postStatusSummaryInline={postStatusSummaryInline}
      publishSummaryTagsLine={publishSummaryTagsLine}
      publishSummaryOptionsLine={formatPublishSummaryOptionsLine({
        followUpSummaryLine: followUpSummaryLine,
        showRecyclable: true,
        isRecyclable: isRecyclableVal,
      })}
      contentSummaryLines={contentSummaryLines}
      publishPath={publishPath}
      recyclableControl={{
        switchId: "composer-recyclable",
        checked: isRecyclableVal,
        onCheckedChange: (checked) =>
          form.setValue("isRecyclable", checked === true),
        disabled,
      }}
      threadSettingsSection={
        isThreadMode
          ? {
              title: "Thread settings",
              lines: threadSettingsLines,
              controls: (
                <RailChipGroup>
                  {THREAD_CADENCE_MINUTES_CHIPS.map((v) => (
                    <RailChip
                      key={v}
                      type="button"
                      selected={threadDelayMinutes === v}
                      onClick={() => {
                        setComposerTouched(true);
                        setThreadDelayMinutes(v);
                      }}
                      disabled={disabled}
                    >
                      {v}m
                    </RailChip>
                  ))}
                </RailChipGroup>
              ),
            }
          : undefined
      }
      issues={displayRedIssues}
      warnings={displayAmberIssues}
      pristineHint={pristineHint}
      idleStatusLabel={idleStatusLabel}
      primaryActionLabel={getPrimaryCtaLabelForMode(
        publishMode,
        isThreadMode ? "thread" : "post"
      )}
      primaryActionLoading={primaryActionLoading}
      primaryActionLoadingLabel={getPrimaryCtaPendingLabelForMode(
        publishMode,
        isThreadMode ? "thread" : "post"
      )}
      onPrimaryAction={() => primarySubmitRef.current?.click()}
      onPrimaryActionBlocked={onPrimaryActionBlocked}
      primaryActionDisabled={
        disabled || signerReady === false || issueListLength > 0
      }
      secondaryActionLabel="Save draft"
      onSecondaryAction={() => draftSubmitRef.current?.click()}
      secondaryActionDisabled={disabled}
    />
  );
}
