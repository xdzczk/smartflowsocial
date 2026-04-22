import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Checkbox } from "~/components/ui/checkbox";
import { FormControl, FormField, FormLabel } from "~/components/ui/form-field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

import type { QueueType, HashTagPreset } from "../types";
interface EditPostFormFieldsProps {
  caption: string;
  setCaption: (value: string) => void;
  existingImages: string[];
  newFiles: File[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveExistingImage: (index: number) => void;
  onRemoveNewFile: (index: number) => void;
  hashTagPresets: HashTagPreset[];
  useHashtagPresets: boolean;
  setUseHashtagPresets: (value: boolean) => void;
  selectedHashtagPresetId: string | null;
  selectedHashtagPresetTags: string;
  onHashtagPresetSelect: (presetId: string | null, hashtags: string) => void;
  manualHashtags: string;
  setManualHashtags: (value: string) => void;
  selectedQueueType: string;
  setSelectedQueueType: (value: string) => void;
  queueTypes: QueueType[];
  includeHashtagsInNoteBody: boolean;
  setIncludeHashtagsInNoteBody: (value: boolean) => void;
  /** Blossom media add blocked without NIP-07 / NIP-46 signer. */
  mediaAddDisabled?: boolean;
  /** Hide queue selector (scheduling moved to reschedule flow). */
  hideQueueField?: boolean;
}

export function EditPostFormFields({
  caption,
  setCaption,
  existingImages,
  newFiles,
  onFileChange,
  onRemoveExistingImage,
  onRemoveNewFile,
  hashTagPresets,
  useHashtagPresets,
  setUseHashtagPresets,
  selectedHashtagPresetId,
  selectedHashtagPresetTags: _selectedHashtagPresetTags,
  onHashtagPresetSelect,
  manualHashtags,
  setManualHashtags,
  selectedQueueType,
  setSelectedQueueType,
  queueTypes,
  includeHashtagsInNoteBody,
  setIncludeHashtagsInNoteBody,
  mediaAddDisabled = false,
  hideQueueField = false,
}: EditPostFormFieldsProps) {
  return (
    <>
      {/* Images section */}
      <div className="stack-tight">
        <p className="text-text text-sm leading-none font-medium">
          Images / Media
        </p>
        <div className="flex flex-wrap gap-3">
          {existingImages.map((url, idx) => (
            // eslint-disable-next-line react/no-array-index-key -- Stable list of existing images, composite key with prefix
            <div key={`existing-${idx}`} className="relative">
              <img
                src={url}
                alt="Existing"
                className="h-24 w-24 rounded-xs object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveExistingImage(idx)}
                className="bg-danger hover:bg-danger absolute -top-2 -right-2 rounded-full p-1 text-white"
              >
                ×
              </button>
            </div>
          ))}
          {newFiles.map((file, idx) => {
            const objectURL = URL.createObjectURL(file);
            return (
              // eslint-disable-next-line react/no-array-index-key -- Stable list of new files, composite key with prefix
              <div key={`new-${idx}`} className="relative">
                <img
                  src={objectURL}
                  alt="New"
                  className="h-24 w-24 rounded-xs object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveNewFile(idx)}
                  className="bg-danger hover:bg-danger absolute -top-2 -right-2 rounded-full p-1 text-white"
                >
                  ×
                </button>
              </div>
            );
          })}
          <label
            htmlFor="edit-post-file-input"
            className={cn(
              "border-border flex h-24 w-24 items-center justify-center rounded-xs border-2 border-dashed",
              mediaAddDisabled
                ? "pointer-events-none cursor-not-allowed opacity-50"
                : "hover:border-border cursor-pointer"
            )}
          >
            <input
              id="edit-post-file-input"
              name="edit-post-files"
              type="file"
              className="hidden"
              accept="image/*,video/*"
              multiple
              disabled={mediaAddDisabled}
              onChange={onFileChange}
            />
            <span className="text-text-secondary text-3xl">+</span>
          </label>
        </div>
      </div>

      {/* Caption */}
      <FormField id="edit-post-caption">
        <FormLabel>Caption</FormLabel>
        <FormControl>
          <Textarea
            name="edit-post-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="What's on your mind?"
          />
        </FormControl>
      </FormField>

      {/* Hashtag Preset Toggle */}
      <HashtagPresetToggle
        presets={hashTagPresets}
        selectedPresetId={selectedHashtagPresetId}
        onSelect={onHashtagPresetSelect}
        useHashtagPresets={useHashtagPresets}
        onUseHashtagPresetsChange={setUseHashtagPresets}
      />

      {/* Manual hashtags fallback */}
      {!useHashtagPresets ? (
        <FormField id="edit-post-hashtags">
          <FormLabel>
            Hashtags (space-separated, e.g. #nostr #bitcoin)
          </FormLabel>
          <FormControl>
            <Input
              name="edit-post-hashtags"
              type="text"
              value={manualHashtags}
              onChange={(e) => setManualHashtags(e.target.value)}
              placeholder="#tag1 #tag2 #tag3"
            />
          </FormControl>
        </FormField>
      ) : null}

      <label
        htmlFor="edit-include-hashtags-in-note"
        className="flex cursor-pointer items-center gap-2"
      >
        <Checkbox
          id="edit-include-hashtags-in-note"
          checked={includeHashtagsInNoteBody === false}
          onCheckedChange={(c) => setIncludeHashtagsInNoteBody(c !== true)}
        />
        <span className="text-text-secondary text-sm">Hide tags</span>
      </label>

      {hideQueueField ? null : (
        <FormField id="edit-post-queue-type">
          <FormLabel>Queue</FormLabel>
          <FormControl>
            <Select
              value={selectedQueueType || "__manual__"}
              onValueChange={(v) =>
                setSelectedQueueType(v === "__manual__" ? "" : v)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Manual (No Queue)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">Manual (No Queue)</SelectItem>
                {queueTypes.map((queueType) => (
                  <SelectItem key={queueType.id} value={queueType.id}>
                    {queueType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
        </FormField>
      )}
    </>
  );
}
