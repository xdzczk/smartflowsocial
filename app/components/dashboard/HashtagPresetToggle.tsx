import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface HashTagPreset {
  id: string;
  name: string;
  tags: string;
  description?: string | null;
}

interface QueueType {
  id: string;
  name: string;
  hashTagPreset?: HashTagPreset | null;
}

interface HashtagPresetToggleProps {
  presets: HashTagPreset[];
  selectedPresetId?: string | null;
  onSelect: (presetId: string | null, hashtags: string) => void;
  disabled?: boolean;
  showQueuePreset?: boolean;
  queueType?: QueueType | null;
  useHashtagPresets?: boolean;
  onUseHashtagPresetsChange?: (enabled: boolean) => void;
}

export function HashtagPresetToggle({
  presets,
  selectedPresetId,
  onSelect,
  disabled = false,
  showQueuePreset = false,
  queueType = null,
  useHashtagPresets = false,
  onUseHashtagPresetsChange,
}: HashtagPresetToggleProps) {
  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  const handlePresetChange = (value: string) => {
    if (value === "none") {
      onSelect(null, "");
    } else {
      const preset = presets.find((p) => p.id === value);
      onSelect(preset?.id ?? null, preset?.tags ?? "");
    }
  };

  const countHashtags = (tags: string): number => {
    return tags
      .split(/\s+/)
      .filter((tag) => tag.startsWith("#") && tag.length > 1).length;
  };

  return (
    <div className="space-y-4">
      {/* Toggle checkbox for hashtag presets */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="use-hashtag-presets"
          name="use-hashtag-presets"
          checked={useHashtagPresets}
          onCheckedChange={(checked) => onUseHashtagPresetsChange?.(!!checked)}
          disabled={disabled}
        />
        <Label
          htmlFor="use-hashtag-presets"
          className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Use Hashtag Presets
        </Label>
      </div>

      {/* Show queue type's hashtag preset info when available */}
      {showQueuePreset && queueType?.hashTagPreset ? (
        <div
          className={`rounded-lg p-3 ${
            useHashtagPresets
              ? "border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
              : "border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {useHashtagPresets ? "Queue Default:" : "Using Queue Default:"}
              </span>
              <Badge variant="secondary" className="text-xs">
                {queueType.hashTagPreset.name}
              </Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({countHashtags(queueType.hashTagPreset.tags)} tags)
              </span>
            </div>
          </div>
          {!useHashtagPresets ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {queueType.hashTagPreset.tags
                .split(/\s+/)
                .filter((tag) => tag.startsWith("#") && tag.length > 1)
                .slice(0, 4)
                .map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </Badge>
                ))}
              {countHashtags(queueType.hashTagPreset.tags) > 4 ? (
                <Badge variant="outline" className="px-2 py-0.5 text-xs">
                  +{countHashtags(queueType.hashTagPreset.tags) - 4} more
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Hashtag preset selector */}
      {useHashtagPresets ? (
        <div className="space-y-3">
          {presets.length === 0 ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                No hashtag presets available. Create some in Settings to reuse
                hashtags across your posts.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="hashtag-preset-select"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Choose Hashtag Preset
                </Label>
                <Select
                  value={selectedPresetId ?? "none"}
                  onValueChange={handlePresetChange}
                  disabled={disabled}
                  name="hashtag-preset-select"
                >
                  <SelectTrigger id="hashtag-preset-select" className="w-full">
                    <SelectValue placeholder="Select a hashtag preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-gray-500">No hashtag preset</span>
                    </SelectItem>
                    {presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium">{preset.name}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {countHashtags(preset.tags)}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected preset preview */}
              {selectedPreset ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {selectedPreset.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {countHashtags(selectedPreset.tags)} tags
                    </Badge>
                  </div>
                  {selectedPreset.description ? (
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                      {selectedPreset.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {selectedPreset.tags
                      .split(/\s+/)
                      .filter((tag) => tag.startsWith("#") && tag.length > 1)
                      .slice(0, 6)
                      .map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="px-2 py-0.5 text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    {countHashtags(selectedPreset.tags) > 6 ? (
                      <Badge variant="outline" className="px-2 py-0.5 text-xs">
                        +{countHashtags(selectedPreset.tags) - 6} more
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
