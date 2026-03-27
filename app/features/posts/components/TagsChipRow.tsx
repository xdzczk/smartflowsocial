/**
 * Tags chip row: chips, manual add, presets, optional recent tags (localStorage).
 */
/* eslint-disable react/no-array-index-key -- tag list has no stable id; index needed for duplicate tags */
import { X } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

const RECENT_TAGS_STORAGE_KEY = "sfs-composer-recent-tags";
const MAX_RECENT_TAGS = 12;

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

function normalizeTagInput(raw: string): string {
  return raw.trim().replace(/^#+/u, "").trim();
}

function loadRecentTags(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_TAGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is string => typeof t === "string" && t.length > 0
    );
  } catch {
    return [];
  }
}

function saveRecentTags(tags: string[]): void {
  try {
    localStorage.setItem(RECENT_TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch {
    // ignore quota
  }
}

function pushRecentTags(added: string[]): void {
  if (added.length === 0) return;
  const prev = loadRecentTags();
  const next = [
    ...added.map((t) => normalizeTagInput(t)).filter(Boolean),
    ...prev,
  ];
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const t of next) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(t);
    if (deduped.length >= MAX_RECENT_TAGS) break;
  }
  saveRecentTags(deduped);
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
  const [selectValue, setSelectValue] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [recentTags, setRecentTags] = useState<string[]>(loadRecentTags);

  const removeTag = (index: number) => {
    const next = tagList.filter((_, i) => i !== index);
    onTagsChange(tagsToStr(next));
  };

  const addTagsAndRemember = useCallback(
    (newPieces: string[]) => {
      const currentTags = parseTags(tags);
      const normalized = newPieces
        .map((t) => normalizeTagInput(t))
        .filter((t) => t.length > 0);
      if (normalized.length === 0) return;
      const existing = new Set(currentTags.map((t) => t.toLowerCase()));
      const toAdd = normalized.filter((t) => !existing.has(t.toLowerCase()));
      if (toAdd.length === 0) return;
      pushRecentTags(toAdd);
      setRecentTags(loadRecentTags());
      onTagsChange(tagsToStr([...currentTags, ...toAdd]));
    },
    [onTagsChange, tags]
  );

  const addPresetTags = (preset: Preset) => {
    const presetTags = parseTags(preset.tags);
    const existing = new Set(tagList);
    const toAdd = presetTags.filter((t) => !existing.has(t));
    const merged = [...tagList, ...toAdd];
    onPresetSelect(preset.id, tagsToStr(merged));
    pushRecentTags(toAdd);
    setRecentTags(loadRecentTags());
    setSelectValue("");
  };

  const onManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const parts = manualInput
      .split(/[,\s]+/u)
      .map((p) => normalizeTagInput(p))
      .filter(Boolean);
    if (parts.length === 0) return;
    addTagsAndRemember(parts);
    setManualInput("");
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="text-foreground text-sm font-semibold">Tags</span>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Discovery: add hashtags for search and campaigns.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tagList.map((tag, idx) => (
          <Badge
            key={`${tag}-${idx}`}
            variant="secondary"
            className="gap-1 pr-1"
          >
            #{tag.replace(/^#+/u, "")}
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
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <Input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={onManualKeyDown}
          disabled={disabled}
          placeholder="Add tag — Enter or comma"
          className="sm:max-w-xs"
          aria-label="Add hashtag"
        />
      </div>
      {recentTags.length > 0 ? (
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">
            Recent
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recentTags.map((t) => (
              <button
                key={t}
                type="button"
                disabled={disabled}
                className="border-border bg-muted/40 hover:bg-muted text-foreground rounded-md border px-2 py-0.5 text-xs disabled:opacity-50"
                onClick={() => addTagsAndRemember([t])}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {queuePresetName ? (
        <p className="text-muted-foreground text-xs">
          Queue default: {queuePresetName}
        </p>
      ) : null}
    </div>
  );
}
/* eslint-enable react/no-array-index-key */
