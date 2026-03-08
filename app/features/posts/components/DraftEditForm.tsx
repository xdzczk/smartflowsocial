/**
 * Draft edit form component
 */

import { useFetcher } from "@remix-run/react";
import { AlertTriangle } from "lucide-react";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { getNowForDateTimeLocal } from "~/lib/temporal";

import { getQueueColorBundle, getSelectedQueueStyle } from "../queue-colors";
import type {
  PostData,
  QueueType,
  HashTagPreset,
  RepostConditions,
} from "../types";
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
  alsoScheduleRepost?: boolean;
  onAlsoScheduleRepostChange?: (value: boolean) => void;
  repostDelayList?: Array<{
    id: string;
    value: number;
    unit: "hours" | "minutes";
  }>;
  onRepostDelayListChange?: (
    value: Array<{ id: string; value: number; unit: "hours" | "minutes" }>
  ) => void;
  repostConditions?: RepostConditions | null;
  onRepostConditionsChange?: (value: RepostConditions | null) => void;
  alsoScheduleQuote?: boolean;
  onAlsoScheduleQuoteChange?: (value: boolean) => void;
  userTimezone?: string;
  quoteEntries?: Array<{
    id: string;
    value: number;
    unit: "hours" | "minutes";
    caption: string;
  }>;
  onQuoteEntriesChange?: (
    value: Array<{
      id: string;
      value: number;
      unit: "hours" | "minutes";
      caption: string;
    }>
  ) => void;
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
  alsoScheduleRepost = false,
  onAlsoScheduleRepostChange,
  repostDelayList = [{ id: "default-repost", value: 2, unit: "hours" }],
  onRepostDelayListChange,
  repostConditions,
  onRepostConditionsChange,
  alsoScheduleQuote = false,
  onAlsoScheduleQuoteChange,
  userTimezone = "UTC",
  quoteEntries = [
    { id: "default-quote", value: 2, unit: "hours" as const, caption: "" },
  ],
  onQuoteEntriesChange,
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
          <input
            type="hidden"
            id="draft-caption-hidden"
            name="caption"
            value={caption || content}
          />
        </div>

        {/* Queue Selection */}
        <div>
          <Label htmlFor="draft-queue-type">Queue Type</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {queueTypes.map((queue) => {
              const queueName = typeof queue === "string" ? queue : queue.name;
              const colorToken =
                typeof queue === "object"
                  ? (queue as { colorToken?: string | null }).colorToken
                  : null;
              const isSelected = selectedQueue === queueName;

              if (colorToken) {
                const bundle = getQueueColorBundle(colorToken);
                return (
                  <button
                    key={queueName}
                    type="button"
                    onClick={() => onQueueChange(queueName)}
                    disabled={isSubmitting}
                    className="rounded-md border-2 px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: isSelected
                        ? bundle.accent
                        : bundle.surface,
                      color: isSelected ? "white" : bundle.accent,
                      borderColor: bundle.accent,
                    }}
                  >
                    {queueName}
                  </button>
                );
              }
              return (
                <button
                  key={queueName}
                  type="button"
                  onClick={() => onQueueChange(queueName)}
                  disabled={isSubmitting}
                  className={`rounded-md border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${getSelectedQueueStyle(queueName, isSelected)} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {queueName}
                </button>
              );
            })}
          </div>
          <input
            type="hidden"
            id="draft-queue-type"
            name="queueType"
            value={selectedQueue}
          />
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
            (q) => (typeof q === "string" ? q : q.name) === selectedQueue
          )}
        />

        {/* Hidden inputs for hashtag preset data */}
        {useHashtagPresets && selectedHashtagPresetId ? (
          <input
            type="hidden"
            id="draft-hashtag-preset-id-hidden"
            name="hashTagPresetId"
            value={selectedHashtagPresetId}
          />
        ) : null}
        {useHashtagPresets ? (
          <input
            type="hidden"
            id="draft-use-hashtag-presets-hidden"
            name="useHashtagPresets"
            value="on"
          />
        ) : null}

        {/* Schedule Time (for resume action) */}
        <div>
          <Label htmlFor="scheduledFor">Schedule For (Resume)</Label>
          <input
            type="datetime-local"
            id="scheduledFor"
            name="scheduledFor"
            value={scheduledFor}
            onChange={(e) => {
              const v = e.target.value;
              const min = getNowForDateTimeLocal(userTimezone);
              onScheduledForChange(v && v < min ? min : v);
            }}
            min={getNowForDateTimeLocal(userTimezone)}
            className="dark:bg-card dark:text-foreground border-border text-foreground mt-1 block w-full rounded-lg border p-2"
            disabled={isSubmitting}
          />
          <p className="text-muted-foreground dark:text-foreground mt-1 text-sm">
            Set a schedule time to resume this draft as a scheduled post
          </p>
        </div>

        {/* Also schedule repost/quote */}
        <div className="border-border bg-muted/30 space-y-3 rounded-lg border p-4">
          <div className="text-foreground text-sm font-medium">
            Also schedule when resuming
          </div>
          {onAlsoScheduleRepostChange ? (
            <>
              <label
                htmlFor="draft-also-schedule-repost"
                className="flex items-center gap-2"
              >
                <Checkbox
                  id="draft-also-schedule-repost"
                  checked={alsoScheduleRepost}
                  onCheckedChange={(c) =>
                    onAlsoScheduleRepostChange(c === true)
                  }
                />
                <span className="text-sm">Schedule a repost</span>
              </label>
              {alsoScheduleRepost && onRepostDelayListChange ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    When after main post (one per repost)
                  </Label>
                  {repostDelayList.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="number"
                        min={1}
                        value={item.value}
                        onChange={(e) => {
                          const v = Math.max(
                            1,
                            parseInt(e.target.value, 10) || 1
                          );
                          onRepostDelayListChange(
                            repostDelayList.map((h, i) =>
                              i === idx ? { ...h, value: v } : h
                            )
                          );
                        }}
                        className="dark:bg-card dark:text-foreground border-border text-foreground w-20 rounded-lg border p-2 text-sm"
                        disabled={isSubmitting}
                        aria-label="Delay value"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => {
                          const unit = e.target.value as "hours" | "minutes";
                          onRepostDelayListChange(
                            repostDelayList.map((h, i) =>
                              i === idx ? { ...h, unit } : h
                            )
                          );
                        }}
                        className="dark:bg-card dark:text-foreground border-border text-foreground w-24 rounded-lg border p-2 text-sm"
                        disabled={isSubmitting}
                        aria-label="Hours or minutes"
                      >
                        <option value="hours">hours</option>
                        <option value="minutes">minutes</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          onRepostDelayListChange(
                            repostDelayList.length > 1
                              ? repostDelayList.filter((_, i) => i !== idx)
                              : repostDelayList
                          )
                        }
                        disabled={isSubmitting || repostDelayList.length <= 1}
                        className="text-muted-foreground hover:text-foreground text-xs"
                        aria-label="Remove repost"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      onRepostDelayListChange([
                        ...repostDelayList,
                        { id: crypto.randomUUID(), value: 24, unit: "hours" },
                      ])
                    }
                    disabled={isSubmitting}
                    className="text-primary text-xs hover:underline"
                  >
                    Add another repost
                  </button>
                  {onRepostConditionsChange ? (
                    <div className="border-border mt-3 space-y-1.5 rounded border p-3">
                      <span className="text-muted-foreground text-xs">
                        Only repost if original gets (optional)
                      </span>
                      <div className="flex flex-wrap items-center gap-3 gap-y-1.5">
                        {[
                          { key: "minReactions" as const, label: "Reactions" },
                          { key: "minZaps" as const, label: "Zaps" },
                          { key: "minComments" as const, label: "Comments" },
                          { key: "minReposts" as const, label: "Reposts" },
                          { key: "minSats" as const, label: "Sats" },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <label className="text-muted-foreground text-xs whitespace-nowrap">
                              {label}
                            </label>
                            <input
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
                                onRepostConditionsChange(
                                  v !== undefined
                                    ? { ...repostConditions, [key]: v }
                                    : (() => {
                                        const next = repostConditions
                                          ? { ...repostConditions }
                                          : {};
                                        delete next[key];
                                        return Object.keys(next).length > 0
                                          ? next
                                          : null;
                                      })()
                                );
                              }}
                              disabled={isSubmitting}
                              className="bg-card border-border text-foreground w-20 rounded-md border px-2 py-1.5 text-sm"
                              aria-label={`Min ${label.toLowerCase()}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <label
                htmlFor="draft-also-schedule-quote"
                className="flex items-center gap-2"
              >
                <Checkbox
                  id="draft-also-schedule-quote"
                  checked={alsoScheduleQuote}
                  onCheckedChange={(c) =>
                    onAlsoScheduleQuoteChange?.(c === true)
                  }
                />
                <span className="text-sm">Schedule a quote</span>
              </label>
              {alsoScheduleQuote && onQuoteEntriesChange ? (
                <div className="space-y-3">
                  <Label className="text-muted-foreground text-xs">
                    Quote times and captions (one per quote)
                  </Label>
                  {quoteEntries.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="border-border space-y-2 rounded border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-muted-foreground text-xs">
                          When after main
                        </Label>
                        <button
                          type="button"
                          onClick={() =>
                            onQuoteEntriesChange(
                              quoteEntries.length > 1
                                ? quoteEntries.filter((_, i) => i !== idx)
                                : quoteEntries
                            )
                          }
                          disabled={isSubmitting || quoteEntries.length <= 1}
                          className="text-muted-foreground hover:text-foreground text-xs"
                          aria-label="Remove quote"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={entry.value}
                          onChange={(e) => {
                            const v = Math.max(
                              1,
                              parseInt(e.target.value, 10) || 1
                            );
                            onQuoteEntriesChange(
                              quoteEntries.map((e, i) =>
                                i === idx ? { ...e, value: v } : e
                              )
                            );
                          }}
                          className="dark:bg-card dark:text-foreground border-border text-foreground w-20 rounded-lg border p-2 text-sm"
                          disabled={isSubmitting}
                          aria-label="Delay value"
                        />
                        <select
                          value={entry.unit}
                          onChange={(e) => {
                            const unit = e.target.value as "hours" | "minutes";
                            onQuoteEntriesChange(
                              quoteEntries.map((ent, i) =>
                                i === idx ? { ...ent, unit } : ent
                              )
                            );
                          }}
                          className="dark:bg-card dark:text-foreground border-border text-foreground w-24 rounded-lg border p-2 text-sm"
                          disabled={isSubmitting}
                          aria-label="Hours or minutes"
                        >
                          <option value="hours">hours</option>
                          <option value="minutes">minutes</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Caption (optional)
                        </Label>
                        <Textarea
                          value={entry.caption}
                          onChange={(ev) =>
                            onQuoteEntriesChange(
                              quoteEntries.map((ent, i) =>
                                i === idx
                                  ? { ...ent, caption: ev.target.value }
                                  : ent
                              )
                            )
                          }
                          placeholder="Add your comment..."
                          rows={2}
                          className="dark:bg-card dark:text-foreground border-border text-foreground mt-1 w-full rounded-lg border p-2 text-sm"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      onQuoteEntriesChange([
                        ...quoteEntries,
                        {
                          id: crypto.randomUUID(),
                          value: 24,
                          unit: "hours",
                          caption: "",
                        },
                      ])
                    }
                    disabled={isSubmitting}
                    className="text-primary text-xs hover:underline"
                  >
                    Add another quote
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
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
              className="bg-success hover:bg-success/90 flex-1"
            >
              Resume & Schedule
            </Button>
          ) : null}
        </div>
      </fetcher.Form>

      {/* Draft Info */}
      <div className="dark:bg-muted rounded-lg bg-yellow-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle
              className="h-5 w-5 text-yellow-400"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
          <div className="ml-3">
            <h3 className="dark:text-foreground text-sm font-medium text-yellow-800">
              Draft Status
            </h3>
            <div className="dark:text-foreground mt-2 text-sm text-yellow-700">
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
