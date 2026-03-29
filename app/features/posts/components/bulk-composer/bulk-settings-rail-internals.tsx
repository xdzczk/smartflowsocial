import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import type {
  BulkBatchMode,
  BulkComposerStage,
} from "~/features/posts/bulk-composer/types";
import type { BulkPost, RepostConditions } from "~/features/posts/types";

import type { QueueType } from "../BulkPostCard";

import {
  BulkSettingsRailBuildDefaultsBlock,
  BulkSettingsRailBuildOptionsBlock,
  BulkSettingsRailBuildValidationBlock,
  BulkSettingsRailModeBlock,
  BulkSettingsRailReviewBatchOptionsBlock,
  BulkSettingsRailReviewDefaultsBlock,
  BulkSettingsRailReviewReadinessBlock,
  BulkSettingsRailSummaryBlock,
} from "./bulk-settings-rail-sections";

export interface BulkSettingsRailBodyProps {
  stage: BulkComposerStage;
  batchMode: BulkBatchMode;
  onBatchModeChange: (m: BulkBatchMode) => void;
  posts: BulkPost[];
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>;
  queueTypes: QueueType[];
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  selectedHashtagPresetId: string | null;
  useHashtagPresets: boolean;
  setUseHashtagPresets: (v: boolean) => void;
  scheduleIntervals: number[] | undefined;
  userTimezone: string;
  isProcessing: boolean;
  bulkScheduleRandomWindowMinutes: 0 | 5 | 10 | 15;
  setBulkScheduleRandomWindowMinutes: React.Dispatch<
    React.SetStateAction<0 | 5 | 10 | 15>
  >;
  bulkRepostConditions: RepostConditions | null;
  setBulkRepostConditions: React.Dispatch<
    React.SetStateAction<RepostConditions | null>
  >;
  showRepostConditions: boolean;
  validationResult: {
    isValid: boolean;
    errors: string[];
    byPost: Record<number, string[]>;
  };
  onJumpToPost: (index: number) => void;
  handleScheduleIntervalClick: (interval: number) => void;
  handleBulkQueueUpdate: (queueType: string) => void;
  handleHashtagPresetSelect: (
    presetId: string | null,
    hashtags: string
  ) => void;
  handleBulkRecyclableToggle: () => void;
  onRepostAll?: (delay: { value: number; unit: "hours" | "minutes" }) => void;
  readyCount: number;
  issueCount: number;
  unassignedCount: number;
  aggregateLines: {
    cap: number;
    sched: number;
    lines: Array<{ text: string; index: number }>;
  };
  reviewScheduleStartLabel: string;
  reviewScheduleIntervalLabel: string;
  reviewQueueDefaultLabel: string;
  randomizationLabel: string;
  reviewSummaryRows: Array<{ label: string; value: string }>;
  postsCount: number;
  repostAllOpen: boolean;
  setRepostAllOpen: (open: boolean) => void;
  repostAllValue: number;
  setRepostAllValue: React.Dispatch<React.SetStateAction<number>>;
  repostAllUnit: "hours" | "minutes";
  setRepostAllUnit: React.Dispatch<React.SetStateAction<"hours" | "minutes">>;
}

export function BulkSettingsRailBody(props: BulkSettingsRailBodyProps) {
  const {
    stage,
    batchMode,
    onBatchModeChange,
    posts,
    setPosts,
    queueTypes,
    hashTagPresets,
    selectedHashtagPresetId,
    useHashtagPresets,
    setUseHashtagPresets,
    scheduleIntervals,
    userTimezone,
    isProcessing,
    bulkScheduleRandomWindowMinutes,
    setBulkScheduleRandomWindowMinutes,
    bulkRepostConditions,
    setBulkRepostConditions,
    showRepostConditions,
    validationResult,
    onJumpToPost,
    handleScheduleIntervalClick,
    handleBulkQueueUpdate,
    handleHashtagPresetSelect,
    handleBulkRecyclableToggle,
    onRepostAll,
    readyCount,
    issueCount,
    unassignedCount,
    aggregateLines,
    reviewScheduleStartLabel,
    reviewScheduleIntervalLabel,
    reviewQueueDefaultLabel,
    randomizationLabel,
    reviewSummaryRows,
    postsCount,
    repostAllOpen,
    setRepostAllOpen,
    repostAllValue,
    setRepostAllValue,
    repostAllUnit,
    setRepostAllUnit,
  } = props;

  return (
    <>
      <BulkSettingsRailModeBlock
        stage={stage}
        batchMode={batchMode}
        onBatchModeChange={onBatchModeChange}
      />

      {stage === "build" && posts.length > 0 ? (
        <BulkSettingsRailBuildDefaultsBlock
          batchMode={batchMode}
          posts={posts}
          setPosts={setPosts}
          scheduleIntervals={scheduleIntervals}
          userTimezone={userTimezone}
          isProcessing={isProcessing}
          bulkScheduleRandomWindowMinutes={bulkScheduleRandomWindowMinutes}
          setBulkScheduleRandomWindowMinutes={
            setBulkScheduleRandomWindowMinutes
          }
          queueTypes={queueTypes}
          unassignedCount={unassignedCount}
          handleBulkQueueUpdate={handleBulkQueueUpdate}
          handleScheduleIntervalClick={handleScheduleIntervalClick}
        />
      ) : null}

      {stage === "review" && posts.length > 0 ? (
        <BulkSettingsRailReviewDefaultsBlock
          batchMode={batchMode}
          reviewScheduleStartLabel={reviewScheduleStartLabel}
          reviewScheduleIntervalLabel={reviewScheduleIntervalLabel}
          reviewQueueDefaultLabel={reviewQueueDefaultLabel}
          randomizationLabel={randomizationLabel}
        />
      ) : null}

      {stage === "build" && posts.length > 0 ? (
        <BulkSettingsRailBuildOptionsBlock
          posts={posts}
          isProcessing={isProcessing}
          onRepostAll={onRepostAll}
          repostAllOpen={repostAllOpen}
          setRepostAllOpen={setRepostAllOpen}
          repostAllValue={repostAllValue}
          setRepostAllValue={setRepostAllValue}
          repostAllUnit={repostAllUnit}
          setRepostAllUnit={setRepostAllUnit}
          showRepostConditions={showRepostConditions}
          bulkRepostConditions={bulkRepostConditions}
          setBulkRepostConditions={setBulkRepostConditions}
          hashTagPresets={hashTagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          handleHashtagPresetSelect={handleHashtagPresetSelect}
          useHashtagPresets={useHashtagPresets}
          setUseHashtagPresets={setUseHashtagPresets}
          handleBulkRecyclableToggle={handleBulkRecyclableToggle}
        />
      ) : null}

      {stage === "review" ? (
        <BulkSettingsRailReviewBatchOptionsBlock
          posts={posts}
          useHashtagPresets={useHashtagPresets}
        />
      ) : null}

      <BulkSettingsRailSummaryBlock
        postsCount={postsCount}
        readyCount={readyCount}
        issueCount={issueCount}
        unassignedCount={unassignedCount}
        reviewSummaryRows={reviewSummaryRows}
      />

      {stage === "build" ? (
        <BulkSettingsRailBuildValidationBlock
          validationResult={validationResult}
          posts={posts}
          onJumpToPost={onJumpToPost}
          aggregateLines={aggregateLines}
        />
      ) : (
        <BulkSettingsRailReviewReadinessBlock
          validationResult={validationResult}
          postsCount={postsCount}
          issueCount={issueCount}
          aggregateLines={aggregateLines}
          onJumpToPost={onJumpToPost}
        />
      )}
    </>
  );
}

export interface BulkSettingsRailFooterProps {
  stage: BulkComposerStage;
  postsCount: number;
  isSubmitting: boolean;
  isProcessing: boolean;
  isPreviewSubmitting: boolean;
  validationResult: { isValid: boolean };
  preparationProgress: { current: number; total: number; stage: string };
  isSigning: boolean;
  signingProgress: { current: number; total: number } | null;
  onSaveDraft: () => void;
  onReview: () => void;
  onBackToEdit: () => void;
  onSaveDraftReview: () => void;
  onSign: () => void;
}

export function BulkSettingsRailFooter({
  stage,
  postsCount,
  isSubmitting,
  isProcessing,
  isPreviewSubmitting,
  validationResult,
  preparationProgress,
  isSigning,
  signingProgress,
  onSaveDraft,
  onReview,
  onBackToEdit,
  onSaveDraftReview,
  onSign,
}: BulkSettingsRailFooterProps) {
  return (
    <div className="border-border bg-card/80 space-y-2 border-t p-3 backdrop-blur-sm">
      {stage === "build" ? (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={
              postsCount === 0 ||
              isSubmitting ||
              isProcessing ||
              isPreviewSubmitting
            }
            onClick={onSaveDraft}
          >
            Save draft
          </Button>
          <Button
            type="button"
            className="w-full"
            disabled={
              postsCount === 0 ||
              isSubmitting ||
              isProcessing ||
              isPreviewSubmitting ||
              !validationResult.isValid
            }
            onClick={onReview}
          >
            {isPreviewSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {preparationProgress.stage || "Preparing…"}
              </span>
            ) : (
              `Review ${postsCount} post${postsCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isSubmitting || isSigning}
            onClick={onBackToEdit}
          >
            Back to edit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isSubmitting || isSigning}
            onClick={onSaveDraftReview}
          >
            Save draft
          </Button>
          <Button
            type="button"
            className="w-full"
            disabled={
              isSubmitting ||
              isSigning ||
              !validationResult.isValid ||
              postsCount === 0
            }
            onClick={() => onSign()}
          >
            {isSigning ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Signing…
                {signingProgress
                  ? ` (${signingProgress.current}/${signingProgress.total})`
                  : ""}
              </span>
            ) : isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Submitting…
              </span>
            ) : (
              `Sign and schedule ${postsCount} post${postsCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </>
      )}
    </div>
  );
}
