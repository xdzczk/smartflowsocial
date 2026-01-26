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

  const countHashtags = (tags: string | undefined | null): number => {
    if (!tags || typeof tags !== "string") {
      return 0;
    }
    return tags
      .split(/\s+/)
      .filter((tag) => tag.startsWith("#") && tag.length > 1).length;
  };

  const renderQueuePresetInfo = () => {
    if (!showQueuePreset || !queueType?.hashTagPreset) {
      return null;
    }

    const queuePreset = queueType.hashTagPreset;
    const tags = queuePreset.tags;
    const tagCount = countHashtags(tags);

    return (
      <div
        className={`rounded-lg p-3 ${
          useHashtagPresets
            ? "dark:bg-card border-border bg-muted dark:border-border border"
            : "border-success bg-success/10 dark:border-success dark:bg-success/20/20 border"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground dark:text-foreground text-sm font-medium">
              {useHashtagPresets ? "Queue Default:" : "Using Queue Default:"}
            </span>
            <Badge variant="secondary" className="text-xs">
              {queuePreset.name}
            </Badge>
            <span className="text-muted-foreground dark:text-foreground text-xs">
              ({tagCount} tags)
            </span>
          </div>
        </div>
        {!useHashtagPresets && tags ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags
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
            {tagCount > 4 ? (
              <Badge variant="outline" className="px-2 py-0.5 text-xs">
                +{tagCount - 4} more
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderSelectedPresetPreview = () => {
    if (!selectedPreset) {
      return null;
    }

    const tags = selectedPreset.tags;
    const tagCount = countHashtags(tags);

    return (
      <div className="dark:bg-card border-border bg-muted dark:border-border rounded-lg border p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-muted-foreground dark:text-foreground text-sm font-medium">
            {selectedPreset.name}
          </span>
          <Badge variant="secondary" className="text-xs">
            {tagCount} tags
          </Badge>
        </div>
        {selectedPreset.description ? (
          <p className="text-muted-foreground dark:text-foreground mb-2 text-xs">
            {selectedPreset.description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {tags
            ? tags
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
                ))
            : null}
          {tagCount > 6 ? (
            <Badge variant="outline" className="px-2 py-0.5 text-xs">
              +{tagCount - 6} more
            </Badge>
          ) : null}
        </div>
      </div>
    );
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
          className="text-muted-foreground dark:text-foreground cursor-pointer text-sm font-medium"
        >
          Use Hashtag Presets
        </Label>
      </div>

      {/* Show queue type's hashtag preset info when available */}
      {renderQueuePresetInfo()}

      {/* Hashtag preset selector */}
      {useHashtagPresets ? (
        <div className="space-y-3">
          {presets.length === 0 ? (
            <div className="dark:border-border dark:bg-muted rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <p className="dark:text-foreground text-sm text-yellow-700">
                No hashtag presets available. Create some in Settings to reuse
                hashtags across your posts.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="hashtag-preset-select"
                  className="text-muted-foreground dark:text-foreground text-sm font-medium"
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
                      <span className="text-muted-foreground">
                        No hashtag preset
                      </span>
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
              {renderSelectedPresetPreview()}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
