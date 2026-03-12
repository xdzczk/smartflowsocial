/**
 * Main content area of the bulk composer modal (form or confirmation).
 */

import type { FetcherWithComponents } from "@remix-run/react";
import { Hash, Loader2 } from "lucide-react";

import {
  type BulkPost,
  type PreparedEvent,
  type QueueType,
} from "~/features/posts/server";
import type { RepostConditions } from "~/features/posts/types";
import {
  BulkPostsActionButtons,
  BulkPostsSchedulingPanel,
  PostConfirmation,
} from "~/features/posts/ui";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import {
  isRepostOrQuote,
  type BulkComposerMode,
  type BulkComposerUser,
} from "../../utils/bulk-composer-modal.utils";

import { BulkComposerFormTableSection } from "./BulkComposerFormTableSection";

export interface BulkComposerModalContentProps {
  isLoadingContext: boolean;
  displayedHashtags: string | string[];
  showConfirmation: boolean;
  mode: BulkComposerMode;
  posts: BulkPost[];
  prepareEvents: (e: React.FormEvent<HTMLFormElement>) => void;
  validationResult: {
    isValid: boolean;
    errors: string[];
    byPost: Record<number, string[]>;
  };
  preparationProgress: { current: number; total: number; stage: string };
  isProcessing: boolean;
  isSubmitting: boolean;
  isPreviewSubmitting: boolean;
  scheduleIntervals: number[] | undefined;
  queueTypes: QueueType[];
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  selectedHashtagPresetId: string | null;
  useHashtagPresets: boolean;
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>;
  setUseHashtagPresets: (v: boolean) => void;
  submitAction: string;
  extraFormData: Record<string, string>;
  submitFetcher: FetcherWithComponents<unknown>;
  preparedEvents: PreparedEvent[];
  user: BulkComposerUser | null;
  previewData: Map<
    number,
    Array<{ url: string; isVideo: boolean; file: File }>
  >;
  handleScheduleIntervalClick: (interval: number) => void;
  handleBulkQueueUpdate: (queueType: string) => Promise<void>;
  handleHashtagPresetSelect: (
    presetId: string | null,
    hashtags: string
  ) => void;
  handleBulkRecyclableToggle: () => void;
  handleCaptionChange: (index: number, value: string) => void;
  handleDateChange: (index: number, value: string) => void;
  handleIsRecyclableChange: (index: number, checked: boolean) => void;
  handleRemovePost: (index: number) => void;
  handleQueueTypeChange: (index: number, value: string) => Promise<void>;
  handleMediaClick: (mediaSrc: string) => void;
  handleRowFileSelect: (index: number, file: File | null) => Promise<void>;
  handleRowFileRemove: (index: number, mediaIndex: number) => void;
  repostConditions: RepostConditions | null;
  setRepostConditions: React.Dispatch<
    React.SetStateAction<RepostConditions | null>
  >;
}

export function BulkComposerModalContent({
  isLoadingContext,
  displayedHashtags,
  showConfirmation,
  mode,
  posts,
  prepareEvents,
  validationResult,
  preparationProgress,
  isProcessing,
  isSubmitting,
  isPreviewSubmitting,
  scheduleIntervals,
  queueTypes,
  hashTagPresets,
  selectedHashtagPresetId,
  useHashtagPresets,
  setPosts,
  setUseHashtagPresets,
  submitAction,
  extraFormData,
  submitFetcher,
  preparedEvents,
  user,
  previewData,
  handleScheduleIntervalClick,
  handleBulkQueueUpdate,
  handleHashtagPresetSelect,
  handleBulkRecyclableToggle,
  handleCaptionChange,
  handleDateChange,
  handleIsRecyclableChange,
  handleRemovePost,
  handleQueueTypeChange,
  handleMediaClick,
  handleRowFileSelect,
  handleRowFileRemove,
  repostConditions,
  setRepostConditions,
}: BulkComposerModalContentProps) {
  const showActions = !isRepostOrQuote(mode);
  const userTimezone = user?.timezone ?? "UTC";

  if (isLoadingContext) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {displayedHashtags && String(displayedHashtags).length <= 80 ? (
        <div className="bg-muted text-foreground mb-4 inline-flex items-center gap-1 rounded px-2 py-1 text-xs leading-4 font-semibold">
          <Hash
            className="inline-block size-4 opacity-75"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          <span>{displayedHashtags}</span>
        </div>
      ) : null}

      {!showConfirmation ? (
        <form
          onSubmit={prepareEvents}
          className="w-full"
          encType="multipart/form-data"
        >
          {showActions ? (
            <BulkPostsActionButtons
              posts={posts}
              isProcessing={isProcessing}
              scheduleIntervals={scheduleIntervals}
              queueTypes={queueTypes}
              hashTagPresets={hashTagPresets}
              selectedHashtagPresetId={selectedHashtagPresetId}
              useHashtagPresets={useHashtagPresets}
              handleScheduleIntervalClick={handleScheduleIntervalClick}
              handleBulkQueueUpdate={(qt) => {
                void handleBulkQueueUpdate(qt);
              }}
              handleHashtagPresetSelect={handleHashtagPresetSelect}
              setUseHashtagPresets={setUseHashtagPresets}
              handleBulkRecyclableToggle={handleBulkRecyclableToggle}
              onRepostAll={(delay) =>
                setPosts((prev) =>
                  prev.map((p) => ({
                    ...p,
                    repostSchedules: [{ value: delay.value, unit: delay.unit }],
                  }))
                )
              }
            />
          ) : null}

          {posts.length > 0 && showActions ? (
            <BulkPostsSchedulingPanel
              posts={posts}
              setPosts={setPosts}
              scheduleIntervals={scheduleIntervals}
              userTimezone={userTimezone}
              disabled={isProcessing}
            />
          ) : null}

          {posts.length > 0 && showActions ? (
            <div className="border-border bg-muted/30 mb-4 rounded-lg border p-4">
              <span className="text-muted-foreground mb-2 block text-sm font-medium">
                Only repost if original gets (applies to all reposts)
              </span>
              <div className="flex flex-wrap items-center gap-3 gap-y-2">
                {[
                  { key: "minReactions" as const, label: "Reactions" },
                  { key: "minZaps" as const, label: "Zaps" },
                  { key: "minComments" as const, label: "Comments" },
                  { key: "minReposts" as const, label: "Reposts" },
                  { key: "minSats" as const, label: "Sats" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <label
                      htmlFor={`bulk-modal-repost-cond-${key}`}
                      className="text-muted-foreground text-xs whitespace-nowrap"
                    >
                      {label}
                    </label>
                    <input
                      id={`bulk-modal-repost-cond-${key}`}
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
                            return Object.keys(next).length > 0 ? next : null;
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

          {posts.length > 0 ? (
            <BulkComposerFormTableSection
              posts={posts}
              validationResult={validationResult}
              preparationProgress={preparationProgress}
              isSubmitting={isSubmitting}
              isProcessing={isProcessing}
              isPreviewSubmitting={isPreviewSubmitting}
              queueTypes={queueTypes}
              previewData={previewData}
              showActions={showActions}
              userTimezone={userTimezone}
              handleCaptionChange={handleCaptionChange}
              handleDateChange={handleDateChange}
              handleIsRecyclableChange={handleIsRecyclableChange}
              handleRemovePost={handleRemovePost}
              handleQueueTypeChange={handleQueueTypeChange}
              handleMediaClick={handleMediaClick}
              handleRowFileSelect={handleRowFileSelect}
              handleRowFileRemove={handleRowFileRemove}
            />
          ) : null}
        </form>
      ) : (
        <PostConfirmation
          preparedEvents={preparedEvents}
          posts={posts}
          postsCount={posts.length}
          submitAction={submitAction}
          extraFormData={extraFormData}
          repostConditions={repostConditions}
          fetcher={submitFetcher}
          userTimezone={userTimezone}
          userTimeFormat={user?.timeFormat === "24h" ? "24h" : "12h"}
        />
      )}
    </>
  );
}
