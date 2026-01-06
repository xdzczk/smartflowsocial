import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { useEditPostModal } from "../hooks/useEditPostModal";
import type {
  PostData,
  LongFormPostData,
  QueueType,
  HashTagPreset,
  UserData,
} from "../types";
import { prepareEditPostSubmission } from "../utils/editPostSubmit.client";

import { EditLongFormFormFields } from "./EditLongFormFormFields";
import { EditorJSStyles } from "./EditorJSStyles";
import { EditPostFormFields } from "./EditPostFormFields";
interface EditPostModalProps {
  post: PostData | LongFormPostData;
  onClose: () => void;
  onConfirm: () => void;
  user?: UserData;
  queueTypes?: QueueType[];
  hashTagPresets?: HashTagPreset[];
}

interface FetcherData {
  success?: boolean;
  needsSigning?: boolean;
  error?: string;
}

export function EditPostModal({
  post,
  onClose,
  onConfirm,
  user,
  queueTypes = [],
  hashTagPresets = [],
}: EditPostModalProps) {
  const fetcher = useFetcher<FetcherData>();
  const [isSigningEvent, setIsSigningEvent] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  // Determine if this is a longform post
  const isLongform = "title" in post;

  // Use custom hook for form state management
  const {
    caption,
    setCaption,
    selectedQueueType,
    setSelectedQueueType,
    title,
    setTitle,
    summary,
    setSummary,
    content,
    setContent: _setContent,
    image,
    setImage,
    scheduledFor,
    setScheduledFor,
    existingImages,
    newFiles,
    isUploadingImages,
    setIsUploadingImages,
    useHashtagPresets,
    setUseHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtagPresetTags,
    manualHashtags,
    setManualHashtags,
    editorReady,
    handleFileChange,
    removeExistingImage,
    removeNewFile,
    handleHashtagPresetSelect,
    formatDateTimeForInput,
  } = useEditPostModal({
    post,
    user,
    hashTagPresets,
    isLongform,
  });

  useEffect(() => {
    const dataRaw = fetcher.data;
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as {
            success?: unknown;
            needsSigning?: unknown;
            error?: unknown;
          })
        : null;
    if (data && typeof data.success === "boolean" && data.success) {
      if (
        data.needsSigning &&
        typeof data.needsSigning === "boolean" &&
        data.needsSigning
      ) {
        return; // Keep modal open for re-signing
      }
      onConfirm();
    }
    if (data && "error" in data && typeof data.error === "string") {
      setSigningError(data.error);
    }
  }, [fetcher.data, onConfirm]);

  const handleSubmit = async () => {
    if (!post) return;

    try {
      setIsSigningEvent(true);
      setSigningError(null);
      setIsUploadingImages(true);

      const formData = await prepareEditPostSubmission({
        post,
        isLongform,
        caption,
        title,
        summary,
        content,
        image,
        existingImages,
        newFiles,
        selectedHashtagPresetTags,
        manualHashtags,
        useHashtagPresets,
        selectedQueueType,
        selectedHashtagPresetId,
        scheduledFor,
        user,
      });

      setIsUploadingImages(false);
      fetcher.submit(formData, { method: "post" });
    } catch (error: unknown) {
      console.error("Error re-signing event:", error);
      setIsSigningEvent(false);
      setIsUploadingImages(false);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to sign event. Please try again.";
      setSigningError(errorMessage);
    }
  };

  if (!post) return null;

  return (
    <>
      {/* EditorJS Custom Styles */}
      {isLongform ? <EditorJSStyles /> : null}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Edit {isLongform ? "Article" : "Post"}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {isLongform ? (
                <EditLongFormFormFields
                  title={title}
                  setTitle={setTitle}
                  summary={summary}
                  setSummary={setSummary}
                  image={image}
                  setImage={setImage}
                  editorReady={editorReady}
                />
              ) : (
                <EditPostFormFields
                  caption={caption}
                  setCaption={setCaption}
                  existingImages={existingImages}
                  newFiles={newFiles}
                  onFileChange={(e) => void handleFileChange(e)}
                  onRemoveExistingImage={removeExistingImage}
                  onRemoveNewFile={removeNewFile}
                  hashTagPresets={hashTagPresets}
                  useHashtagPresets={useHashtagPresets}
                  setUseHashtagPresets={setUseHashtagPresets}
                  selectedHashtagPresetId={selectedHashtagPresetId}
                  selectedHashtagPresetTags={selectedHashtagPresetTags}
                  onHashtagPresetSelect={handleHashtagPresetSelect}
                  manualHashtags={manualHashtags}
                  setManualHashtags={setManualHashtags}
                  selectedQueueType={selectedQueueType}
                  setSelectedQueueType={setSelectedQueueType}
                  queueTypes={queueTypes}
                />
              )}

              {/* Schedule Date */}
              <div>
                <label
                  htmlFor="edit-post-scheduled-for"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Scheduled For
                </label>
                <input
                  id="edit-post-scheduled-for"
                  type="datetime-local"
                  value={
                    scheduledFor ? formatDateTimeForInput(scheduledFor) : ""
                  }
                  onChange={(e) =>
                    setScheduledFor(
                      e.target.value ? new Date(e.target.value) : null
                    )
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Re-signing notice */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-start space-x-2">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Editing this {isLongform ? "article" : "post"} requires
                      re-signing the Nostr event
                    </div>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {(fetcher.data?.error ?? signingError) ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <div className="text-sm text-red-800 dark:text-red-200">
                    {fetcher.data?.error ?? signingError}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={
                  fetcher.state === "submitting" ||
                  isSigningEvent ||
                  isUploadingImages
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploadingImages
                  ? "Uploading Images..."
                  : isSigningEvent
                    ? "Signing Event..."
                    : fetcher.state === "submitting"
                      ? "Saving..."
                      : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
