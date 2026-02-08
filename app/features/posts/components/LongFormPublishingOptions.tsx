import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatIntervalLabel } from "~/lib/schedule-intervals";

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

  function getQueueDescription(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes("test")) return "Low visibility";
    if (lower.includes("normal")) return "Default cadence";
    if (lower.includes("great")) return "High-signal slots";
    if (lower.includes("weekly") || lower.includes("slot"))
      return "Scheduled slots";
    return "Publishing queue";
  }

  return (
    <div className="border-border/50 space-y-6 border-t pt-4">
      <h3 className="text-muted-foreground text-sm font-medium">Publish</h3>

      {/* Queue Type Selection - vertical */}
      <div className="space-y-2">
        <span
          id="longform-queue-type-label"
          className="text-muted-foreground dark:text-foreground block text-xs font-medium"
        >
          Queue
        </span>
        <div
          className="flex flex-col gap-1"
          role="group"
          aria-labelledby="longform-queue-type-label"
        >
          {filteredQueues.map((queue) => {
            const queueName = typeof queue === "string" ? queue : queue.name;
            const queueColor = typeof queue === "object" ? queue.color : null;
            const isSelected = selectedQueueType === queueName;
            const description = getQueueDescription(queueName);
            return (
              <button
                key={queueName}
                type="button"
                onClick={() =>
                  onQueueTypeChange(isSelected ? "unassigned" : queueName)
                }
                className={`rounded-md border px-3 py-2 text-left text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? "border-primary/60 bg-primary/10" : "border-border/50 hover:bg-muted/40"}`}
                style={
                  queueColor && isSelected
                    ? {
                        borderColor: queueColor,
                        backgroundColor: `${queueColor}22`,
                      }
                    : {}
                }
                title={
                  isSelected ? "Click again to leave unassigned" : undefined
                }
              >
                <span className="font-medium">{queueName}</span>
                <span className="text-muted-foreground ml-1 text-xs">
                  — {description}
                </span>
              </button>
            );
          })}
        </div>
        <input
          type="hidden"
          id="longform-queue-type-hidden"
          name="queueType"
          value={selectedQueueType}
        />
      </div>

      {/* Hashtag Preset Toggle */}
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
          // Only pass QueueType objects with the necessary properties
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

      {/* Hidden hashtag preset inputs */}
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
            onChange={(e) => onScheduledForChange(e.target.value || null)}
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
  );
}
