/**
 * Tags chip row: show applied hashtags as chips, "+ Add preset" dropdown.
 * Replaces "Use Hashtag Presets" checkbox with inline control.
 */
/* eslint-disable react/no-array-index-key -- tag list has no stable id; index needed for duplicate tags */
import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

function parseTags(tagsStr: string): string[] {
  if (!tagsStr || typeof tagsStr !== "string") return [];
  return tagsStr
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function tagsToStr(tags: string[]): string {
  return tags.join(" ").trim();
}

interface Preset {
  id: string;
  name: string;
  tags: string;
}

interface TagsChipRowProps {
  /** Current tags (space-separated) */
  tags: string;
  /** Called when tags change (e.g. remove chip or apply preset) */
  onTagsChange: (tags: string) => void;
  /** Available presets */
  presets: Preset[];
  /** Currently selected preset id (for highlighting in dropdown) */
  selectedPresetId?: string | null;
  /** Called when user selects a preset (merge tags, prevent duplicates) */
  onPresetSelect: (presetId: string | null, mergedTags: string) => void;
  disabled?: boolean;
  /** Optional: show queue default hint */
  queuePresetName?: string | null;
}

export function TagsChipRow({
  tags,
  onTagsChange,
  presets,
  selectedPresetId: _selectedPresetId,
  onPresetSelect,
  disabled = false,
  queuePresetName,
}: TagsChipRowProps) {
  const tagList = parseTags(tags);

  const removeTag = (index: number) => {
    const next = tagList.filter((_, i) => i !== index);
    onTagsChange(tagsToStr(next));
  };

  const [selectValue, setSelectValue] = useState("");

  const addPresetTags = (preset: Preset) => {
    const presetTags = parseTags(preset.tags);
    const existing = new Set(tagList);
    const toAdd = presetTags.filter((t) => !existing.has(t));
    const merged = [...tagList, ...toAdd];
    onPresetSelect(preset.id, tagsToStr(merged));
    setSelectValue("");
  };

  return (
    <div className="space-y-2">
      <span className="text-muted-foreground dark:text-foreground text-sm font-medium">
        Tags
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {tagList.map((tag, idx) => (
          <Badge
            key={`${tag}-${idx}`}
            variant="secondary"
            className="gap-1 pr-1"
          >
            {tag}
            {!disabled ? (
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                aria-label={`Remove ${tag}`}
              >
                <X
                  className="h-3 w-3"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </button>
            ) : null}
          </Badge>
        ))}
        <Select
          value={selectValue}
          onValueChange={(value) => {
            const preset = presets.find((p) => p.id === value);
            if (preset) addPresetTags(preset);
          }}
          disabled={disabled || presets.length === 0}
        >
          <SelectTrigger className="w-auto min-w-[8rem] shrink-0">
            <SelectValue placeholder="+ Add preset" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => {
              const count = parseTags(preset.tags).length;
              return (
                <SelectItem key={preset.id} value={preset.id}>
                  <span className="font-medium">{preset.name}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {count} tags
                  </Badge>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      {queuePresetName ? (
        <p className="text-muted-foreground text-xs">
          Queue default: {queuePresetName}
        </p>
      ) : null}
    </div>
  );
}
/* eslint-enable react/no-array-index-key */
