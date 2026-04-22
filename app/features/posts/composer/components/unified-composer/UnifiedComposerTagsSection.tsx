import { TagsChipRow } from "~/features/posts/components/TagsChipRow";

import type { QueueType } from "../../../types";

export function UnifiedComposerTagsSection({
  isContestSourcePostDensity,
  selectedHashtags,
  setSelectedHashtags,
  hashTagPresets,
  formSelectedHashtagPresetId,
  form,
  onHashtagPresetChange,
  fetcherIdle,
  includeHashtagsInNoteBody,
  selectedQueue,
  queueTypes,
}: {
  isContestSourcePostDensity: boolean;
  selectedHashtags: string;
  setSelectedHashtags: (v: string) => void;
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  formSelectedHashtagPresetId: string | undefined;
  form: {
    setValue: (name: string, value: boolean | string | undefined) => void;
  };
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
  fetcherIdle: boolean;
  includeHashtagsInNoteBody: boolean | undefined;
  selectedQueue: string;
  queueTypes: Array<string | QueueType>;
}) {
  const tagsRow = (
    <TagsChipRow
      tags={selectedHashtags}
      onTagsChange={(newTags) => {
        setSelectedHashtags(newTags);
        if (!newTags.trim()) {
          form.setValue("useHashtagPresets", false);
          form.setValue("hashTagPresetId", undefined);
          onHashtagPresetChange?.(null, "");
        }
      }}
      presets={hashTagPresets}
      selectedPresetId={formSelectedHashtagPresetId}
      onPresetSelect={(presetId, mergedTags) => {
        setSelectedHashtags(mergedTags);
        form.setValue("useHashtagPresets", true);
        form.setValue("hashTagPresetId", presetId ?? undefined);
        onHashtagPresetChange?.(presetId, mergedTags);
      }}
      disabled={!fetcherIdle}
      includeHashtagsInNoteBody={includeHashtagsInNoteBody}
      onIncludeHashtagsInNoteBodyChange={(v) =>
        form.setValue("includeHashtagsInNoteBody", v)
      }
      queuePresetName={
        selectedQueue !== "unassigned"
          ? ((
              queueTypes.find(
                (q) => (typeof q === "string" ? q : q.name) === selectedQueue
              ) as
                | (QueueType & {
                    hashTagPreset?: { name: string } | null;
                  })
                | undefined
            )?.hashTagPreset?.name ?? undefined)
          : undefined
      }
      hideSectionLabel={isContestSourcePostDensity}
      variant={isContestSourcePostDensity ? "campaignSource" : "default"}
    />
  );

  if (isContestSourcePostDensity) {
    return (
      <details className="border-border-subtle bg-surface-hover/40 rounded-md border px-2 py-2">
        <summary className="text-text-secondary cursor-pointer list-none text-[10px] font-medium tracking-wide uppercase select-none [&::-webkit-details-marker]:hidden">
          Tags{" "}
          <span className="text-text-tertiary font-normal normal-case">
            optional
          </span>
        </summary>
        <div className="mt-2 pt-1">{tagsRow}</div>
      </details>
    );
  }

  return tagsRow;
}
