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
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import { getNowForDateTimeLocal } from "~/lib/temporal";

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
}

export function LongFormPublishingOptions({
  queueTypes,
  selectedQueueType,
  onQueueTypeChange,
  scheduledFor,
  onScheduledForChange,
  scheduleIntervals,
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
}: LongFormPublishingOptionsProps) {
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

  return (
    <>
      <Separator className="my-4" />
      <div className="border-border/50 space-y-6">
        <h3 className="text-muted-foreground text-sm font-medium">Publish</h3>

        {/* Queue Type Selection - vertical */}
        <div className="space-y-2">
          <span
            id="longform-queue-type-label"
            className="text-muted-foreground dark:text-foreground block text-xs font-medium"
          >
            Queue
          </span>
          <Select
            value={
              selectedQueueType === "unassigned"
                ? "__unassigned__"
                : selectedQueueType
            }
            onValueChange={(value) =>
              onQueueTypeChange(
                value === "__unassigned__" ? "unassigned" : value
              )
            }
          >
            <SelectTrigger id="longform-queue-select" className="w-full">
              <SelectValue placeholder="Select queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">No queue</SelectItem>
              {filteredQueues.map((queue) => {
                const queueName =
                  typeof queue === "string" ? queue : queue.name;
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

        {showHashtagPresets ? (
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
                  (q) =>
                    (typeof q === "string" ? q : q.name) === selectedQueueType
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
        ) : null}

        {/* Schedule Controls */}
        <div className="space-y-3">
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
          <div className="flex flex-wrap gap-2">
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
              scheduleIntervals.map((interval) => (
                <Button
                  key={interval}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onScheduleIntervalClick(interval)}
                  className="transition-transform hover:scale-105"
                >
                  {formatIntervalLabel(interval, { compact: true })}
                </Button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
