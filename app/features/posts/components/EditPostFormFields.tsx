import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import type { QueueType, HashTagPreset } from "~/features/posts/types";

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
  selectedHashtagPresetTags,
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
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Images / Media
        </label>
        <div className="flex flex-wrap gap-3">
          {existingImages.map((url, idx) => (
            <div key={`existing-${idx}`} className="relative">
              <img
                src={url}
                alt="Existing"
                className="h-24 w-24 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveExistingImage(idx)}
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
          {newFiles.map((file, idx) => {
            const objectURL = URL.createObjectURL(file);
            return (
              <div key={`new-${idx}`} className="relative">
                <img
                  src={objectURL}
                  alt="New"
                  className="h-24 w-24 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveNewFile(idx)}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            );
          })}
          <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 hover:border-gray-400">
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              multiple
              onChange={onFileChange}
            />
            <span className="text-3xl text-gray-500">+</span>
          </label>
        </div>
      </div>

      {/* Caption */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Caption
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Hashtags (space-separated, e.g. #nostr #bitcoin)
          </label>
          <input
            type="text"
            value={manualHashtags}
            onChange={(e) => setManualHashtags(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="#tag1 #tag2 #tag3"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Queue Type
        </label>
        <select
          value={selectedQueueType}
          onChange={(e) => setSelectedQueueType(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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

