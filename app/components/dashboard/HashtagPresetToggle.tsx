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
import { cn } from "~/lib/utils";

/** Shared label emphasis (sonarjs/no-duplicate-string). */
const CN_MUTED_EMPHASIS = "text-text-secondary dark:text-text";
const CN_TEXT_SM_MEDIUM = "text-sm font-medium";

function queuePresetLabelTypography(subdued: boolean): string {
  return subdued ? "text-[11px] font-normal" : CN_TEXT_SM_MEDIUM;
}

function outlineHashtagBadgeClass(subdued: boolean): string {
  return subdued ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5";
}

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
  /** Quieter spacing and typography (e.g. article composer footnotes). */
  presentation?: "default" | "subdued";
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
  presentation = "default",
}: HashtagPresetToggleProps) {
  const subdued = presentation === "subdued";
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
        className={cn(
          "rounded-lg",
          subdued ? "border-border/35 p-2.5" : "p-3",
          useHashtagPresets
            ? subdued
              ? "dark:bg-surface/50 bg-surface-hover/25 dark:border-border/60 border"
              : "dark:bg-surface border-border bg-surface-hover dark:border-border border"
            : subdued
              ? "border-success/35 bg-success/[0.06] dark:border-success/40 dark:bg-success/[0.08] border"
              : "border-success bg-success/10 dark:border-success dark:bg-success/20/20 border"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span
              className={cn(
                CN_MUTED_EMPHASIS,
                queuePresetLabelTypography(subdued)
              )}
            >
              {useHashtagPresets ? "Queue Default:" : "Using Queue Default:"}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                subdued && outlineHashtagBadgeClass(true)
              )}
            >
              {queuePreset.name}
            </Badge>
            <span
              className={cn(
                CN_MUTED_EMPHASIS,
                subdued ? "text-[10px]" : "text-xs"
              )}
            >
              ({tagCount} tags)
            </span>
          </div>
        </div>
        {!useHashtagPresets && tags ? (
          <div
            className={cn("flex flex-wrap gap-1", subdued ? "mt-1.5" : "mt-2")}
          >
            {tags
              .split(/\s+/)
              .filter((tag) => tag.startsWith("#") && tag.length > 1)
              .slice(0, 4)
              .map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn("text-xs", outlineHashtagBadgeClass(subdued))}
                >
                  {tag}
                </Badge>
              ))}
            {tagCount > 4 ? (
              <Badge
                variant="outline"
                className={cn("text-xs", outlineHashtagBadgeClass(subdued))}
              >
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
      <div
        className={cn(
          "dark:bg-surface rounded-lg border",
          subdued
            ? "border-border/35 bg-surface-hover/20 dark:border-border/50 p-2.5"
            : "border-border bg-surface-hover dark:border-border p-3"
        )}
      >
        <div
          className={cn("flex items-center gap-2", subdued ? "mb-1.5" : "mb-2")}
        >
          <span
            className={cn(
              CN_MUTED_EMPHASIS,
              subdued ? "text-xs font-medium" : CN_TEXT_SM_MEDIUM
            )}
          >
            {selectedPreset.name}
          </span>
          <Badge
            variant="secondary"
            className={cn("text-xs", subdued && outlineHashtagBadgeClass(true))}
          >
            {tagCount} tags
          </Badge>
        </div>
        {selectedPreset.description ? (
          <p
            className={cn(
              CN_MUTED_EMPHASIS,
              subdued ? "mb-1.5 text-[10px] leading-snug" : "mb-2 text-xs"
            )}
          >
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
                    className={cn("text-xs", outlineHashtagBadgeClass(subdued))}
                  >
                    {tag}
                  </Badge>
                ))
            : null}
          {tagCount > 6 ? (
            <Badge
              variant="outline"
              className={cn("text-xs", outlineHashtagBadgeClass(subdued))}
            >
              +{tagCount - 6} more
            </Badge>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className={subdued ? "space-y-2.5" : "space-y-4"}>
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
          className={cn(
            `${CN_MUTED_EMPHASIS} cursor-pointer`,
            subdued
              ? "text-text-secondary/80 text-[11px] font-normal"
              : CN_TEXT_SM_MEDIUM
          )}
        >
          Use Hashtag Presets
        </Label>
      </div>

      {/* Show queue type's hashtag preset info when available */}
      {renderQueuePresetInfo()}

      {/* Hashtag preset selector */}
      {useHashtagPresets ? (
        <div className={subdued ? "space-y-2" : "space-y-3"}>
          {presets.length === 0 ? (
            <div
              className={cn(
                "dark:border-border border-warning/40 bg-warning/12 rounded-lg border",
                subdued
                  ? "dark:bg-surface-hover/40 p-2"
                  : "dark:bg-surface-hover p-3"
              )}
            >
              <p
                className={cn(
                  "dark:text-text text-warning-text",
                  subdued ? "text-[11px] leading-snug" : "text-sm"
                )}
              >
                No hashtag presets available. Create some in Settings to reuse
                hashtags across your posts.
              </p>
            </div>
          ) : (
            <>
              <div className={subdued ? "space-y-1" : "space-y-2"}>
                <Label
                  htmlFor="hashtag-preset-select"
                  className={cn(
                    CN_MUTED_EMPHASIS,
                    subdued
                      ? "text-text-secondary/75 text-[11px] font-normal"
                      : CN_TEXT_SM_MEDIUM
                  )}
                >
                  Choose Hashtag Preset
                </Label>
                <Select
                  value={selectedPresetId ?? "none"}
                  onValueChange={handlePresetChange}
                  disabled={disabled}
                  name="hashtag-preset-select"
                >
                  <SelectTrigger
                    id="hashtag-preset-select"
                    className={cn("w-full", subdued && "h-8 text-xs")}
                  >
                    <SelectValue placeholder="Select a hashtag preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-text-secondary">
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
