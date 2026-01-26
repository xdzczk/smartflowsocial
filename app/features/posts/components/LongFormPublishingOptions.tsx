import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { getDynamicQueueStyle } from "../queue-colors";
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

  const isFixedSlotQueue =
    currentQueueType &&
    typeof currentQueueType === "object" &&
    currentQueueType.scheduleType === "FIXED_SLOTS";

  return (
    <div className="dark:bg-card/50 bg-muted space-y-6 rounded-lg p-6">
      <h3 className="text-foreground text-lg font-semibold dark:text-white">
        Publishing Options
      </h3>

      {/* Queue Type Selection */}
      <div className="space-y-3">
        <span
          id="longform-queue-type-label"
          className="text-muted-foreground dark:text-foreground block text-sm font-medium"
        >
          Queue Type
        </span>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="longform-queue-type-label"
        >
          {queueTypes
            .filter((queue) => {
              return typeof queue === "object"
                ? queue.isEnabled !== false
                : true;
            })
            .map((queue) => {
              const queueName = typeof queue === "string" ? queue : queue.name;
              const queueColor = typeof queue === "object" ? queue.color : null;
              return (
                <button
                  key={queueName}
                  type="button"
                  onClick={() => onQueueTypeChange(queueName)}
                  className={`rounded-full px-4 py-2 text-sm ${getDynamicQueueStyle(queueColor ?? null, selectedQueueType === queueName)} transition-all disabled:cursor-not-allowed disabled:opacity-50`}
                  style={
                    queueColor
                      ? {
                          backgroundColor:
                            selectedQueueType === queueName
                              ? queueColor
                              : `${queueColor}33`,
                          borderColor: queueColor,
                          color:
                            selectedQueueType === queueName
                              ? "white"
                              : queueColor,
                        }
                      : {}
                  }
                >
                  {queueName}
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
          className="text-muted-foreground dark:text-foreground text-sm font-medium"
        >
          Schedule for later
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
          {isFixedSlotQueue ? (
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
                +{interval}h
              </Button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
