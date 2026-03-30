/**
 * Tags chip row: chips, manual add, presets, optional recent tags (localStorage).
 */
/* eslint-disable react/no-array-index-key -- tag list has no stable id; index needed for duplicate tags */
import { X } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  RailChip,
  RailChipGroup,
} from "~/features/posts/components/publishing-rail";
import { ComposerCanvasSectionLabel } from "~/features/posts/composer/components/composer/composer-canvas-primitives";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

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
  /** Per-post: append resolved tags to signed note text. */
  includeHashtagsInNoteBody?: boolean;
  onIncludeHashtagsInNoteBodyChange?: (value: boolean) => void;
  /** Hide the section heading (e.g. when wrapped in a parent disclosure). */
  hideSectionLabel?: boolean;
  /** Tighter, secondary styling for campaign source embed. */
  variant?: "default" | "campaignSource";
}

export function TagsChipRow({
  tags,
  onTagsChange,
  presets,
  selectedPresetId: _selectedPresetId,
  onPresetSelect,
  disabled = false,
  queuePresetName,
  includeHashtagsInNoteBody = true,
  onIncludeHashtagsInNoteBodyChange,
  hideSectionLabel = false,
  variant = "default",
}: TagsChipRowProps) {
  const compact = variant === "campaignSource";
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
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      {hideSectionLabel ? null : (
        <ComposerCanvasSectionLabel
          as="span"
          className={cn(
            "mb-0",
            compact &&
              "text-muted-foreground/75 text-[10px] font-medium tracking-wide uppercase"
          )}
        >
          Tags
        </ComposerCanvasSectionLabel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectValue}
          onValueChange={(value) => {
            const preset = presets.find((p) => p.id === value);
            if (preset) addPresetTags(preset);
          }}
          disabled={disabled || presets.length === 0}
        >
          <SelectTrigger className="border-border/50 bg-muted/10 h-8 w-auto min-w-[7.5rem] shrink-0 text-xs shadow-none">
            <SelectValue placeholder="Preset" />
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
        <Input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={onManualKeyDown}
          disabled={disabled}
          placeholder="Add tag — Enter or comma"
          className="border-border/50 bg-muted/10 h-8 min-w-0 flex-1 basis-[12rem] text-xs shadow-sm"
          aria-label="Add hashtag"
        />
      </div>

      {tagList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      ) : null}

      {onIncludeHashtagsInNoteBodyChange ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3 pt-0.5",
            compact && "gap-2 pt-0"
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <Label
              htmlFor="tags-include-in-note-body"
              className={cn(
                "text-muted-foreground leading-snug font-medium",
                compact ? "text-[10px]" : "text-xs"
              )}
            >
              Hide tags from note text
            </Label>
            {!compact ? (
              <p className="text-muted-foreground/75 text-[10px] leading-snug">
                Off by default. Turn on to keep tags out of the note text (topic
                metadata only).
              </p>
            ) : (
              <p className="text-muted-foreground/65 text-[9px] leading-snug">
                Topic metadata only when on.
              </p>
            )}
          </div>
          <Switch
            id="tags-include-in-note-body"
            checked={includeHashtagsInNoteBody === false}
            onCheckedChange={(hide) => {
              onIncludeHashtagsInNoteBodyChange(!hide);
            }}
            disabled={disabled}
            className="mt-0.5 shrink-0"
          />
        </div>
      ) : null}

      {recentTags.length > 0 ? (
        <div className="space-y-1">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Recent
          </span>
          <RailChipGroup>
            {recentTags.map((t) => (
              <RailChip
                key={t}
                type="button"
                disabled={disabled}
                className="text-muted-foreground hover:bg-muted/50 h-6 border-transparent bg-transparent px-2 text-[11px] font-normal"
                onClick={() => addTagsAndRemember([t])}
              >
                #{t}
              </RailChip>
            ))}
          </RailChipGroup>
        </div>
      ) : null}

      {queuePresetName ? (
        <p className="text-muted-foreground/80 text-[10px]">
          Queue default: {queuePresetName}
        </p>
      ) : null}
    </div>
  );
}
/* eslint-enable react/no-array-index-key */
