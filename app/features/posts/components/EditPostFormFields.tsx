import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";

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
}: EditPostFormFieldsProps) {
  return (
    <>
      {/* Images section */}
      <div>
        <label
          htmlFor="edit-post-images"
          className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
        >
          Images / Media
        </label>
        <div className="flex flex-wrap gap-3">
          {existingImages.map((url, idx) => (
            // eslint-disable-next-line react/no-array-index-key -- Stable list of existing images, composite key with prefix
            <div key={`existing-${idx}`} className="relative">
              <img
                src={url}
                alt="Existing"
                className="h-24 w-24 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveExistingImage(idx)}
                className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
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
                  className="h-24 w-24 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveNewFile(idx)}
                  className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            );
          })}
          <label
            htmlFor="edit-post-file-input"
            className="border-border hover:border-border flex h-24 w-24 cursor-pointer items-center justify-center rounded border-2 border-dashed"
          >
            <input
              id="edit-post-file-input"
              name="edit-post-files"
              type="file"
              className="hidden"
              accept="image/*,video/*"
              multiple
              onChange={onFileChange}
            />
            <span className="text-muted-foreground text-3xl">+</span>
          </label>
        </div>
      </div>

      {/* Caption */}
      <div>
        <label
          htmlFor="edit-post-caption"
          className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
        >
          Caption
        </label>
        <textarea
          id="edit-post-caption"
          name="edit-post-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          className="dark:bg-card border-border text-foreground dark:border-border w-full rounded-md border bg-white px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:text-white"
          placeholder="What's on your mind?"
        />
      </div>

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
        <div>
          <label
            htmlFor="edit-post-hashtags"
            className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
          >
            Hashtags (space-separated, e.g. #nostr #bitcoin)
          </label>
          <input
            id="edit-post-hashtags"
            name="edit-post-hashtags"
            type="text"
            value={manualHashtags}
            onChange={(e) => setManualHashtags(e.target.value)}
            className="dark:bg-card border-border text-foreground dark:border-border w-full rounded-md border bg-white px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:text-white"
            placeholder="#tag1 #tag2 #tag3"
          />
        </div>
      ) : null}

      <div>
        <label
          htmlFor="edit-post-queue-type"
          className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
        >
          Queue Type
        </label>
        <select
          id="edit-post-queue-type"
          name="edit-post-queue-type"
          value={selectedQueueType}
          onChange={(e) => setSelectedQueueType(e.target.value)}
          className="dark:bg-card border-border text-foreground dark:border-border w-full rounded-md border bg-white px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:text-white"
        >
          <option value="">Manual (No Queue)</option>
          {queueTypes.map((queueType) => (
            <option key={queueType.id} value={queueType.id}>
              {queueType.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
