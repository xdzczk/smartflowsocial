import { useMemo, useState } from "react";

import { ActionRail } from "~/components/action-rail/ActionRail";
import type {
  BulkBatchMode,
  BulkComposerStage,
} from "~/features/posts/bulk-composer/types";
import type { BulkPost, RepostConditions } from "~/features/posts/types";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

import type { QueueType } from "../BulkPostCard";

import {
  BulkSettingsRailBody,
  BulkSettingsRailFooter,
} from "./bulk-settings-rail-internals";
import {
  reviewBatchIntervalLabel,
  reviewBatchQueueDefaultLabel,
  reviewBatchStartLabel,
  reviewSummaryExtraRows,
} from "./bulk-settings-rail-stats";

export interface BulkSettingsRailProps {
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
  userTimeFormat?: "12h" | "24h";
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
  onSaveDraft: () => void;
  onReview: () => void;
  onBackToEdit: () => void;
  onSign: () => void;
  onSaveDraftReview: () => void;
  isSubmitting: boolean;
  isPreviewSubmitting: boolean;
  preparationProgress: { current: number; total: number; stage: string };
  postsCount: number;
  /** Signing / upload progress in review */
  isSigning: boolean;
  signingProgress: { current: number; total: number } | null;
  signingError?: string | null;
  onCancelSigning?: () => void;
  bulkExecutionBlocked?: boolean;
}

export function BulkSettingsRail({
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
  userTimeFormat = "12h",
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
  onSaveDraft,
  onReview,
  onBackToEdit,
  onSign,
  onSaveDraftReview,
  isSubmitting,
  isPreviewSubmitting,
  preparationProgress,
  postsCount,
  isSigning,
  signingProgress,
  signingError = null,
  onCancelSigning,
  bulkExecutionBlocked = false,
}: BulkSettingsRailProps) {
  const { dateLocale } = useFormattedDate();
  const [repostAllOpen, setRepostAllOpen] = useState(false);
  const [repostAllValue, setRepostAllValue] = useState(12);
  const [repostAllUnit, setRepostAllUnit] = useState<"hours" | "minutes">(
    "hours"
  );

  const readyCount = posts.filter(
    (_, i) => !validationResult.byPost[i]?.length
  ).length;
  const issueCount = posts.length - readyCount;
  const unassignedCount = posts.filter(
    (p) => !p.queueType || p.queueType === "unassigned"
  ).length;

  const aggregateLines = useMemo(() => {
    const cap = validationResult.errors.filter((e) =>
      e.includes("Caption is required")
    ).length;
    const sched = validationResult.errors.filter((e) =>
      e.includes("Schedule time")
    ).length;
    const unassigned =
      batchMode === "queue"
        ? posts.filter((p) => !p.queueType || p.queueType === "unassigned")
            .length
        : 0;
    return { cap, sched, unassigned };
  }, [validationResult, batchMode, posts]);

  const reviewScheduleStartLabel = useMemo(
    () =>
      reviewBatchStartLabel(posts, userTimezone, userTimeFormat, dateLocale),
    [posts, userTimezone, userTimeFormat, dateLocale]
  );
  const reviewScheduleIntervalLabel = useMemo(
    () => reviewBatchIntervalLabel(posts, userTimezone),
    [posts, userTimezone]
  );
  const reviewQueueDefaultLabel = useMemo(
    () => reviewBatchQueueDefaultLabel(posts),
    [posts]
  );
  const randomizationLabel =
    bulkScheduleRandomWindowMinutes > 0
      ? `±${bulkScheduleRandomWindowMinutes} min`
      : "Off";

  const reviewSummaryRows = useMemo(
    () =>
      stage === "review"
        ? reviewSummaryExtraRows({
            posts,
            batchMode,
            timezone: userTimezone,
            timeFormat: userTimeFormat,
            dateLocale,
          })
        : [],
    [stage, posts, batchMode, userTimezone, userTimeFormat, dateLocale]
  );

  const bodyProps = {
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
  };

  const footerProps = {
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
    bulkExecutionBlocked,
  };

  const body = <BulkSettingsRailBody {...bodyProps} />;
  const footer = <BulkSettingsRailFooter {...footerProps} />;

  return (
    <ActionRail ariaLabel="Bulk batch settings" footer={footer}>
      {body}
    </ActionRail>
  );
}
