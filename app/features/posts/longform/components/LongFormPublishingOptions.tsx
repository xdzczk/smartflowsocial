import { useLayoutEffect, useMemo } from "react";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  RailChip,
  RailChipGroup,
  RailSectionHeader,
  railFieldClassNames,
  railSelectTriggerClassNames,
} from "~/features/posts/components/publishing-rail";
import {
  COMPOSER_QUICK_SCHEDULE_INTERVAL_HOURS,
  formatIntervalLabel,
} from "~/lib/schedule-intervals";
import { getNowForDateTimeLocal } from "~/lib/temporal";
import { cn } from "~/lib/utils";

interface QueueType {
  id?: string;
  name: string;
  color?: string | null;
  hashtags?: string | null;
  scheduleType?: string;
  isEnabled?: boolean;
}

interface HashTagPreset {
  id: string;
  name: string;
  tags: string;
  description?: string | null;
}

function isUnassignedQueueType(name: string): boolean {
  return name === "unassigned" || name === "Unassigned";
}

interface LongFormPublishingOptionsProps {
  queueTypes: Array<string | QueueType>;
  selectedQueueType: string;
  onQueueTypeChange: (queueTypeName: string) => void;
  scheduledFor: string | null;
  onScheduledForChange: (value: string | null) => void;
  scheduleIntervals: number[];
  onScheduleIntervalClick: (interval: number) => void;
  onNextSlotClick: () => void;
  hashTagPresets: HashTagPreset[];
  useHashtagPresets: boolean;
  selectedHashtagPresetId?: string | null;
  selectedHashtags: string;
  onHashtagPresetChange: (presetId: string | null, hashtags: string) => void;
  onUseHashtagPresetsChange: (value: boolean) => void;
  userTimezone?: string;
  showHashtagPresets?: boolean;
  /** When true (e.g. queue delivery mode), hide manual schedule datetime; slot comes from queue API. */
  hideScheduleControls?: boolean;
  /** `rail`: tokens aligned with publishing rail. `page`: legacy separator + headings (non-rail embeds). */
  layout?: "rail" | "page";
}

export function LongFormPublishingOptions({
  queueTypes,
  selectedQueueType,
  onQueueTypeChange,
  scheduledFor,
  onScheduledForChange,
  scheduleIntervals: _scheduleIntervals,
  onScheduleIntervalClick,
  onNextSlotClick,
  hashTagPresets,
  useHashtagPresets,
  selectedHashtagPresetId,
  selectedHashtags: _selectedHashtags,
  onHashtagPresetChange,
  onUseHashtagPresetsChange,
  userTimezone = "UTC",
  showHashtagPresets = true,
  hideScheduleControls = false,
  layout = "page",
}: LongFormPublishingOptionsProps) {
  void _scheduleIntervals;
  const isRail = layout === "rail";

  // Find the currently selected queue type
  const currentQueueType = queueTypes.find(
    (qt) => (typeof qt === "string" ? qt : qt.name) === selectedQueueType
  );

  const isSlotBasedQueue =
    currentQueueType &&
    typeof currentQueueType === "object" &&
    (currentQueueType.scheduleType === "FIXED_SLOTS" ||
      currentQueueType.scheduleType === "WEEKLY_SLOTS");

  const filteredQueues = queueTypes.filter((queue) => {
    if (typeof queue === "object" && queue.isEnabled === false) return false;
    const name = typeof queue === "string" ? queue : queue.name;
    return name !== "Unassigned";
  });

  const selectableQueueNames = useMemo(() => {
    return queueTypes
      .filter((queue) => {
        if (typeof queue === "object" && queue.isEnabled === false)
          return false;
        const name = typeof queue === "string" ? queue : queue.name;
        return name !== "Unassigned";
      })
      .map((queue) => (typeof queue === "string" ? queue : queue.name));
  }, [queueTypes]);
  const selectableKey = selectableQueueNames.join("\0");

  const radixQueueSelectValue = useMemo(() => {
    if (isUnassignedQueueType(selectedQueueType)) return "__unassigned__";
    const allowed = new Set(selectableQueueNames);
    if (allowed.has(selectedQueueType)) return selectedQueueType;
    return "__unassigned__";
  }, [selectedQueueType, selectableQueueNames]);

  useLayoutEffect(() => {
    if (isUnassignedQueueType(selectedQueueType)) return;
    const allowed = new Set(selectableQueueNames);
    if (!allowed.has(selectedQueueType)) {
      onQueueTypeChange("unassigned");
    }
  }, [
    selectedQueueType,
    selectableKey,
    selectableQueueNames,
    onQueueTypeChange,
  ]);

  const queueBlock = (
    <div className={cn("space-y-2", isRail && "space-y-1.5")}>
      <Select
        value={radixQueueSelectValue}
        onValueChange={(value) =>
          onQueueTypeChange(value === "__unassigned__" ? "unassigned" : value)
        }
      >
        <SelectTrigger
          id="longform-queue-select"
          className={cn(
            "w-full",
            isRail ? railSelectTriggerClassNames : undefined
          )}
          aria-label="Select queue"
        >
          <SelectValue placeholder="Select queue" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unassigned__">Select queue</SelectItem>
          {filteredQueues.map((queue) => {
            const queueName = typeof queue === "string" ? queue : queue.name;
            return (
              <SelectItem key={queueName} value={queueName}>
                {queueName}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <input
        type="hidden"
        id="longform-queue-type-hidden"
        name="queueType"
        value={selectedQueueType}
      />
    </div>
  );

  const hashtagBlock = showHashtagPresets ? (
    <>
      <HashtagPresetToggle
        presets={hashTagPresets}
        selectedPresetId={selectedHashtagPresetId}
        onSelect={onHashtagPresetChange}
        useHashtagPresets={useHashtagPresets}
        onUseHashtagPresetsChange={onUseHashtagPresetsChange}
        showQueuePreset={true}
        queueType={(() => {
          const qt = queueTypes.find(
            (q) => (typeof q === "string" ? q : q.name) === selectedQueueType
          );
          if (qt && typeof qt === "object" && qt.id) {
            return qt as {
              id: string;
              name: string;
              hashTagPreset?: HashTagPreset | null;
            };
          }
          return null;
        })()}
      />
      <input
        type="hidden"
        id="longform-use-hashtag-presets-hidden"
        name="useHashtagPresets"
        value={useHashtagPresets.toString()}
      />
      <input
        type="hidden"
        id="longform-hashtag-preset-id-hidden"
        name="hashTagPresetId"
        value={selectedHashtagPresetId ?? ""}
      />
    </>
  ) : null;

  const scheduleBlock = hideScheduleControls ? null : isRail ? (
    <div className="space-y-2">
      <RailSectionHeader>Timing</RailSectionHeader>
      <Label
        htmlFor="scheduledFor"
        className="text-muted-foreground text-xs font-medium"
      >
        When should this enter the network?
      </Label>
      <Input
        type="datetime-local"
        id="scheduledFor"
        name="scheduledFor"
        className={railFieldClassNames}
        value={scheduledFor ?? ""}
        onChange={(e) => {
          const v = e.target.value || null;
          if (!v) {
            onScheduledForChange(null);
            return;
          }
          const min = getNowForDateTimeLocal(userTimezone);
          onScheduledForChange(v < min ? min : v);
        }}
        min={getNowForDateTimeLocal(userTimezone)}
        placeholder="Select date and time"
      />
      <div
        className={
          isSlotBasedQueue ? "mt-0.5" : "grid grid-cols-5 gap-1 sm:gap-1.5"
        }
      >
        {isSlotBasedQueue ? (
          <RailChipGroup className="w-full">
            <RailChip
              type="button"
              className="w-full min-w-0"
              onClick={onNextSlotClick}
            >
              Next slot
            </RailChip>
          </RailChipGroup>
        ) : (
          COMPOSER_QUICK_SCHEDULE_INTERVAL_HOURS.map((interval) => (
            <RailChip
              key={interval}
              type="button"
              className="w-full min-w-0 px-1 sm:px-2"
              onClick={() => onScheduleIntervalClick(interval)}
            >
              {formatIntervalLabel(interval, { compact: true })}
            </RailChip>
          ))
        )}
      </div>
    </div>
  ) : (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[11px] font-medium uppercase">
        Timing
      </p>
      <Label
        htmlFor="scheduledFor"
        className="text-muted-foreground dark:text-foreground text-xs font-medium"
      >
        When should this enter the network?
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="datetime-local"
          id="scheduledFor"
          name="scheduledFor"
          value={scheduledFor ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            if (!v) {
              onScheduledForChange(null);
              return;
            }
            const min = getNowForDateTimeLocal(userTimezone);
            onScheduledForChange(v < min ? min : v);
          }}
          min={getNowForDateTimeLocal(userTimezone)}
          className="dark:bg-card flex-1 bg-white"
          placeholder="Select date and time"
        />
      </div>
      <div
        className={isSlotBasedQueue ? "" : "grid grid-cols-5 gap-1.5 sm:gap-2"}
      >
        {isSlotBasedQueue ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNextSlotClick}
            className="border-primary text-foreground hover:bg-muted"
          >
            Next Slot
          </Button>
        ) : (
          COMPOSER_QUICK_SCHEDULE_INTERVAL_HOURS.map((interval) => (
            <Button
              key={interval}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onScheduleIntervalClick(interval)}
              className="w-full min-w-0 shrink-0 px-1.5 text-xs transition-transform hover:scale-105 sm:px-2 sm:text-sm"
            >
              {formatIntervalLabel(interval, { compact: true })}
            </Button>
          ))
        )}
      </div>
    </div>
  );

  if (isRail) {
    return (
      <div className="space-y-2">
        {queueBlock}
        {hashtagBlock ? <div className="space-y-2">{hashtagBlock}</div> : null}
        {scheduleBlock}
      </div>
    );
  }

  return (
    <>
      <Separator className="my-4" />
      <div className="border-border/50 space-y-6">
        <h3 className="text-muted-foreground text-sm font-medium">Publish</h3>
        {queueBlock}
        {hashtagBlock}
        {scheduleBlock}
      </div>
    </>
  );
}
