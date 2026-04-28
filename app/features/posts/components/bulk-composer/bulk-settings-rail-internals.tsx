import { Loader2 } from "lucide-react";

import { ActionRailActions } from "~/components/action-rail";
import { Button } from "~/components/ui/button";
import type {
  BulkBatchMode,
  BulkComposerStage,
} from "~/features/posts/bulk-composer/types";
import type { BulkPost, RepostConditions } from "~/features/posts/types";
import { cn } from "~/lib/utils";

import type { QueueType } from "../BulkPostCard";

import {
  BulkSettingsRailBuildDefaultsBlock,
  BulkSettingsRailBuildOptionsBlock,
  BulkSettingsRailBuildValidationBlock,
  BulkSettingsRailReviewBatchOptionsBlock,
  BulkSettingsRailReviewDefaultsBlock,
  BulkSettingsRailReviewReadinessBlock,
  BulkSettingsRailScrollBody,
  BulkSettingsRailSummaryBlock,
} from "./bulk-settings-rail-sections";
import { BulkBatchModeTabs } from "./BulkBatchModeTabs";

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
    unassigned: number;
  };
  reviewScheduleStartLabel: string;
  reviewScheduleIntervalLabel: string;
  reviewQueueDefaultLabel: string;
  randomizationLabel: string;
  reviewSummaryRows: Array<{ label: string; value: string }>;
  postsCount: number;
  isSigning: boolean;
  signingProgress: { current: number; total: number } | null;
  signingError: string | null;
  onCancelSigning?: () => void;
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
    isSigning,
    signingProgress,
    signingError,
    onCancelSigning,
    repostAllOpen,
    setRepostAllOpen,
    repostAllValue,
    setRepostAllValue,
    repostAllUnit,
    setRepostAllUnit,
  } = props;

  return (
    <div className="flex flex-col text-xs">
      {stage === "review" && isSigning ? (
        <div className="bg-surface-hover/35 text-text-secondary border-border/70 mx-4 mt-3 mb-1.5 flex flex-col gap-1.5 rounded-lg border p-2.5 text-[11px] leading-snug">
          <span>
            Signer approval required.
            {signingProgress ? (
              <span className="ml-1">
                Post {signingProgress.current} of {signingProgress.total}
              </span>
            ) : null}
          </span>
          {onCancelSigning ? (
            <span className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelSigning}
              >
                Cancel
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}
      {stage === "review" && signingError ? (
        <div className="border-danger bg-danger/10 text-danger mx-4 mt-3 mb-1.5 rounded-md border px-2.5 py-2 text-[11px] leading-snug">
          {signingError}
        </div>
      ) : null}
      <div className="shrink-0">
        <BulkBatchModeTabs
          value={batchMode}
          disabled={stage === "review"}
          onValueChange={onBatchModeChange}
        />
      </div>
      <BulkSettingsRailScrollBody>
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
            postsCount={postsCount}
            batchMode={batchMode}
          />
        ) : (
          <BulkSettingsRailReviewReadinessBlock
            validationResult={validationResult}
            postsCount={postsCount}
            issueCount={issueCount}
            posts={posts}
            batchMode={batchMode}
            onJumpToPost={onJumpToPost}
          />
        )}
      </BulkSettingsRailScrollBody>
    </div>
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
  /** Free / teams: bulk execute is server-blocked; keep button disabled with clear affordance */
  bulkExecutionBlocked?: boolean;
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
  bulkExecutionBlocked = false,
  onSaveDraft,
  onReview,
  onBackToEdit,
  onSaveDraftReview,
  onSign,
}: BulkSettingsRailFooterProps) {
  if (stage === "build") {
    return (
      <ActionRailActions
        secondaryLabel="Save draft"
        onSecondaryClick={onSaveDraft}
        secondaryDisabled={
          postsCount === 0 ||
          isSubmitting ||
          isProcessing ||
          isPreviewSubmitting
        }
        primaryLabel={
          postsCount === 0
            ? "Add posts to review"
            : `Review ${postsCount} post${postsCount !== 1 ? "s" : ""}`
        }
        onPrimaryClick={onReview}
        primaryDisabled={
          postsCount === 0 ||
          isSubmitting ||
          isProcessing ||
          isPreviewSubmitting ||
          !validationResult.isValid
        }
        primaryLoading={isPreviewSubmitting}
        primaryLoadingLabel={preparationProgress.stage || "Preparing…"}
      />
    );
  }

  const signBlocked =
    bulkExecutionBlocked ||
    isSubmitting ||
    isSigning ||
    !validationResult.isValid ||
    postsCount === 0;

  return (
    <ActionRailActions
      secondaryLabel="Back to edit"
      onSecondaryClick={onBackToEdit}
      secondaryDisabled={isSubmitting || isSigning}
      secondSecondaryLabel="Save draft"
      onSecondSecondaryClick={onSaveDraftReview}
      secondSecondaryDisabled={isSubmitting || isSigning}
      primaryButton={
        <Button
          type="button"
          size="sm"
          variant="default"
          aria-disabled={signBlocked}
          className={cn(
            "h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none",
            signBlocked
              ? "bg-action-primary/80 text-action-primary-foreground hover:bg-action-primary/80 pointer-events-auto cursor-not-allowed opacity-95"
              : "bg-action-primary text-action-primary-foreground hover:bg-action-primary/90"
          )}
          onClick={() => {
            if (!signBlocked) onSign();
          }}
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
          ) : postsCount === 0 ? (
            "Add posts to sign"
          ) : bulkExecutionBlocked ? (
            "Upgrade to sign and schedule"
          ) : (
            `Sign and schedule ${postsCount} post${postsCount !== 1 ? "s" : ""}`
          )}
        </Button>
      }
    />
  );
}
