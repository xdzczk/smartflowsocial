/**
 * Draft edit form component
 */

import { useFetcher } from "@remix-run/react";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { getSelectedQueueStyle } from "~/features/posts/queueColors";
import type { PostData, QueueType, HashTagPreset } from "~/features/posts/types";
interface DraftEditFormProps {
  post: PostData;
  content: string;
  caption: string;
  selectedQueue: string;
  scheduledFor: string;
  useHashtagPresets: boolean;
  selectedHashtagPresetId: string | null;
  queueTypes: QueueType[];
  hashTagPresets: HashTagPreset[];
  isSubmitting: boolean;
  onContentChange: (value: string) => void;
  onQueueChange: (queue: string) => void;
  onScheduledForChange: (value: string) => void;
  onHashtagPresetSelect: (presetId: string | null, hashtags: string) => void;
  onUseHashtagPresetsChange: (value: boolean) => void;
  onResumeClick: () => void;
}

export function DraftEditForm({
  post,
  content,
  caption,
  selectedQueue,
  scheduledFor,
  useHashtagPresets,
  selectedHashtagPresetId,
  queueTypes,
  hashTagPresets,
  isSubmitting,
  onContentChange,
  onQueueChange,
  onScheduledForChange,
  onHashtagPresetSelect,
  onUseHashtagPresetsChange,
  onResumeClick,
}: DraftEditFormProps) {
  const fetcher = useFetcher();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Edit Content</h2>

      <fetcher.Form method="post" className="space-y-6">
        {/* Content/Caption */}
        <div>
          <Label htmlFor="content">
            {post.postType === "TEXT" ? "Content" : "Caption"}
          </Label>
          <Textarea
            id="content"
            name="content"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={
              post.postType === "TEXT"
                ? "Write your post content..."
                : "Add a caption..."
            }
            rows={6}
            disabled={isSubmitting}
          />
          <input type="hidden" name="caption" value={caption || content} />
        </div>

        {/* Queue Selection */}
        <div>
          <Label>Queue Type</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {queueTypes.map((queue) => {
              const queueName =
                typeof queue === "string" ? queue : queue.name;
              const queueColor =
                typeof queue === "object" ? queue.color : null;
              const isSelected = selectedQueue === queueName;

              if (queueColor) {
                return (
                  <button
                    key={queueName}
                    type="button"
                    onClick={() => onQueueChange(queueName)}
                    disabled={isSubmitting}
                    className="rounded-full border-2 px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: isSelected
                        ? queueColor
                        : `${queueColor}20`,
                      color: isSelected ? "white" : queueColor,
                      borderColor: queueColor,
                    }}
                  >
                    {queueName}
                  </button>
                );
              } else {
                return (
                  <button
                    key={queueName}
                    type="button"
                    onClick={() => onQueueChange(queueName)}
                    disabled={isSubmitting}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${getSelectedQueueStyle(queueName, isSelected)} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {queueName}
                  </button>
                );
              }
            })}
          </div>
          <input type="hidden" name="queueType" value={selectedQueue} />
        </div>

        {/* Hashtag Preset Toggle */}
        <HashtagPresetToggle
          presets={hashTagPresets}
          selectedPresetId={selectedHashtagPresetId}
          onSelect={onHashtagPresetSelect}
          disabled={isSubmitting}
          useHashtagPresets={useHashtagPresets}
          onUseHashtagPresetsChange={onUseHashtagPresetsChange}
          showQueuePreset={selectedQueue !== "unassigned"}
          queueType={queueTypes.find(
            (q) => (typeof q === "string" ? q : q.name) === selectedQueue,
          )}
        />

        {/* Hidden inputs for hashtag preset data */}
        {useHashtagPresets && selectedHashtagPresetId ? (
          <input
            type="hidden"
            name="hashTagPresetId"
            value={selectedHashtagPresetId}
          />
        ) : null}
        {useHashtagPresets ? (
          <input type="hidden" name="useHashtagPresets" value="on" />
        ) : null}

        {/* Schedule Time (for resume action) */}
        <div>
          <Label htmlFor="scheduledFor">Schedule For (Resume)</Label>
          <input
            type="datetime-local"
            id="scheduledFor"
            name="scheduledFor"
            value={scheduledFor}
            onChange={(e) => onScheduledForChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set a schedule time to resume this draft as a scheduled post
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="submit"
            name="_action"
            value="update"
            variant="outline"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>

          {scheduledFor ? (
            <Button
              type="button"
              onClick={onResumeClick}
              disabled={isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Resume & Schedule
            </Button>
          ) : null}
        </div>
      </fetcher.Form>

      {/* Draft Info */}
      <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Draft Status
            </h3>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              <p>
                This post is saved as a draft and is not signed. It cannot be
                published until you resume it and provide a schedule time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

