import type { Dispatch, SetStateAction } from "react";

import { PublishingSummaryRail } from "~/features/posts/components/ConfidencePanel";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import {
  formatPublishSummaryOptionsLine,
  getPrimaryCtaLabelForMode,
  getPrimaryCtaPendingLabelForMode,
  type ComposerPublishMode,
  type PublishPathSummary,
  type ReadinessPresentation,
} from "~/features/posts/composer/components/composer";
import type { LongformQuoteEntry } from "~/features/posts/hooks/useLongFormSubmission";
import { TemplateSettingsRail } from "~/features/templates/components/TemplateSettingsRail";

import { AlsoScheduleLongformQuote } from "../AlsoScheduleLongformQuote";
import { LongFormPublishingOptions } from "../LongFormPublishingOptions";

import type {
  LongFormHashTagPreset,
  LongFormQueueType,
} from "./longform-post-types";

export interface LongFormPostSummaryRailsProps {
  isTemplateMode: boolean;
  templateName: string;
  templateLastUpdatedLabel: string | null;
  title: string;
  summary: string | undefined;
  image: string;
  wordCount: number;
  templateRailWarnings: string[];
  primaryActionLoading: boolean;
  handleSaveAsTemplate: () => void;
  templateArticleSaveBusy: boolean;
  editTemplateContext: { templateId: string; longFormPostId: string } | null;
  onTemplateDeleteClick?: () => void;
  publishMode: ComposerPublishMode;
  onPublishModeChange?: (next: ComposerPublishMode) => void;
  outcomeSentence: string;
  readinessForRail: ReadinessPresentation;
  composerStatus: ComposerStatus;
  relayCount: number;
  onRelayClick?: () => void;
  handleRelayRailClick: () => void;
  longformQueueNextSlotLabel: string | undefined;
  queueTypes: Array<string | LongFormQueueType>;
  selectedQueueType: string;
  updateDisplayedHashtags: (name: string) => void;
  scheduledFor: string | null;
  setScheduledFor: (v: string | null) => void;
  scheduleIntervals: number[];
  handleScheduleIntervalClick: (intervalHours: number) => void;
  calculateQueueScheduleTime: (
    queueName: string
  ) => void | Promise<void> | Promise<string | null>;
  hashTagPresets: LongFormHashTagPreset[];
  useHashtagPresets: boolean;
  selectedHashtagPresetId: string | null;
  selectedHashtags: string;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
  onUseHashtagPresetsChange?: (value: boolean) => void;
  userTimezone: string;
  longformFollowUpSummary: string;
  quoteEntries: LongformQuoteEntry[];
  setQuoteEntries: Dispatch<SetStateAction<LongformQuoteEntry[]>>;
  fetcherState: string;
  isSigning: boolean;
  contentSummaryLines: string[];
  publishPath: PublishPathSummary;
  displayRedIssues: string[];
  displayAmberIssues: string[];
  pristineHint: string | undefined;
  idleStatusLabel: string | undefined;
  isFormValid: boolean;
  issueList: string[];
  handleSchedule: (mode: "publish" | "schedule") => void;
  setPublishAttempted: (v: boolean) => void;
  generateSummaryFromContent: (content: string) => string;
  content: string;
  onPreview?: (data: {
    title: string;
    summary: string;
    content: string;
    image: string;
  }) => void;
  secondaryIsSaveDraft: boolean;
  handleSaveDraft: () => void;
  flushSync: () => void;
}

export function LongFormPostSummaryRails(props: LongFormPostSummaryRailsProps) {
  const {
    isTemplateMode,
    templateName,
    templateLastUpdatedLabel,
    title,
    summary,
    image,
    wordCount,
    templateRailWarnings,
    primaryActionLoading,
    handleSaveAsTemplate,
    templateArticleSaveBusy,
    editTemplateContext,
    onTemplateDeleteClick,
    publishMode,
    onPublishModeChange,
    outcomeSentence,
    readinessForRail,
    composerStatus,
    relayCount,
    onRelayClick,
    handleRelayRailClick,
    longformQueueNextSlotLabel,
    queueTypes,
    selectedQueueType,
    updateDisplayedHashtags,
    scheduledFor,
    setScheduledFor,
    scheduleIntervals,
    handleScheduleIntervalClick,
    calculateQueueScheduleTime,
    hashTagPresets,
    useHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtags,
    onHashtagPresetChange,
    onUseHashtagPresetsChange,
    userTimezone,
    longformFollowUpSummary,
    quoteEntries,
    setQuoteEntries,
    fetcherState,
    isSigning,
    contentSummaryLines,
    publishPath,
    displayRedIssues,
    displayAmberIssues,
    pristineHint,
    idleStatusLabel,
    isFormValid,
    issueList,
    handleSchedule,
    setPublishAttempted,
    generateSummaryFromContent,
    content,
    onPreview,
    secondaryIsSaveDraft,
    handleSaveDraft,
    flushSync,
  } = props;

  if (isTemplateMode) {
    return (
      <TemplateSettingsRail
        variant="article"
        typeLabel="Article"
        templateName={templateName}
        lastUpdatedLabel={templateLastUpdatedLabel ?? undefined}
        summaryRows={[
          {
            label: "Title",
            value: title.trim() ? "Present" : "Missing",
          },
          {
            label: "Summary",
            value: (summary ?? "").trim() ? "Present" : "Missing",
          },
          {
            label: "Cover",
            value: image ? "Present" : "Missing",
          },
          {
            label: "Body words",
            value: String(wordCount),
          },
        ]}
        warnings={templateRailWarnings}
        saveLabel="Save template"
        saveLoading={primaryActionLoading}
        saveLoadingLabel="Saving…"
        onSaveTemplate={() => handleSaveAsTemplate()}
        saveDisabled={!templateName.trim() || templateArticleSaveBusy}
        useTemplateHref={
          editTemplateContext?.templateId
            ? `/dashboard/compose?type=article&templateId=${encodeURIComponent(editTemplateContext.templateId)}`
            : null
        }
        showDelete={Boolean(onTemplateDeleteClick)}
        onDeleteTemplate={onTemplateDeleteClick}
        deleteDisabled={templateArticleSaveBusy}
      />
    );
  }

  return (
    <PublishingSummaryRail
      publishMode={publishMode}
      onPublishModeChange={onPublishModeChange ?? (() => void 0)}
      outcomeSentence={outcomeSentence}
      readiness={readinessForRail}
      sessionStrip={{
        composerStatus,
        relayCount,
        signerLabel: "NIP-07",
        onRelayClick: onRelayClick ? handleRelayRailClick : undefined,
      }}
      modeSpecificSection={
        publishMode === "now"
          ? undefined
          : {
              lines:
                publishMode === "queue"
                  ? [
                      ...(longformQueueNextSlotLabel
                        ? [
                            `Next slot (estimate): ${longformQueueNextSlotLabel}`,
                          ]
                        : []),
                    ]
                  : [],
              controls: (
                <LongFormPublishingOptions
                  layout="rail"
                  queueTypes={queueTypes}
                  selectedQueueType={selectedQueueType}
                  onQueueTypeChange={(name) => {
                    updateDisplayedHashtags(name);
                  }}
                  scheduledFor={scheduledFor}
                  onScheduledForChange={setScheduledFor}
                  scheduleIntervals={scheduleIntervals}
                  onScheduleIntervalClick={(intervalHours) => {
                    handleScheduleIntervalClick(
                      typeof intervalHours === "number"
                        ? intervalHours
                        : Number(intervalHours)
                    );
                  }}
                  onNextSlotClick={() => {
                    const run = calculateQueueScheduleTime(selectedQueueType);
                    void run;
                  }}
                  hashTagPresets={hashTagPresets}
                  useHashtagPresets={useHashtagPresets}
                  selectedHashtagPresetId={selectedHashtagPresetId}
                  selectedHashtags={selectedHashtags}
                  onHashtagPresetChange={
                    onHashtagPresetChange ??
                    ((_presetId, _hashtags) => {
                      /* no-op default */
                    })
                  }
                  onUseHashtagPresetsChange={
                    onUseHashtagPresetsChange ??
                    (() => {
                      void 0;
                    })
                  }
                  userTimezone={userTimezone}
                  showHashtagPresets={false}
                  hideScheduleControls={publishMode === "queue"}
                  hideQueueControls={publishMode === "schedule"}
                />
              ),
            }
      }
      followUp={{
        summaryLine: longformFollowUpSummary,
        children: (
          <AlsoScheduleLongformQuote
            quoteEntries={quoteEntries}
            onQuoteEntriesChange={setQuoteEntries}
            disabled={fetcherState !== "idle" || isSigning}
          />
        ),
      }}
      publishSummaryOptionsLine={formatPublishSummaryOptionsLine({
        followUpSummaryLine: longformFollowUpSummary,
        showRecyclable: false,
      })}
      contentSummaryLines={contentSummaryLines}
      contentSummaryDisplay="stacked"
      publishPath={publishPath}
      issues={displayRedIssues}
      warnings={displayAmberIssues}
      pristineHint={pristineHint}
      idleStatusLabel={idleStatusLabel}
      primaryActionLabel={getPrimaryCtaLabelForMode(publishMode, "article")}
      primaryActionLoading={primaryActionLoading}
      primaryActionLoadingLabel={getPrimaryCtaPendingLabelForMode(
        publishMode,
        "article"
      )}
      onPrimaryAction={() => {
        flushSync();
        const mode = publishMode === "now" ? "publish" : "schedule";
        handleSchedule(mode);
      }}
      onPrimaryActionBlocked={() => setPublishAttempted(true)}
      primaryActionDisabled={
        fetcherState !== "idle" ||
        !isFormValid ||
        isSigning ||
        issueList.length > 0
      }
      secondaryActionLabel={secondaryIsSaveDraft ? "Save draft" : "Preview"}
      onSecondaryAction={
        secondaryIsSaveDraft
          ? () => {
              handleSaveDraft();
            }
          : onPreview
            ? () =>
                onPreview({
                  title,
                  summary: summary ?? generateSummaryFromContent(content),
                  content,
                  image,
                })
            : undefined
      }
      secondaryActionDisabled={fetcherState !== "idle" || isSigning}
    />
  );
}
