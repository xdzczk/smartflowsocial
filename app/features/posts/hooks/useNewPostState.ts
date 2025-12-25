import { useState } from "react";

/**
 * Custom hook for managing new post state
 */
export function useNewPostState() {
  const [files, setFiles] = useState<any[]>([]);
  const [selectedQueueType, setSelectedQueueType] = useState("unassigned");
  const [selectedHashTagPresetId, setSelectedHashTagPresetId] = useState<
    string | null
  >(null);
  const [selectedHashtags, setSelectedHashtags] = useState("");
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [preparedImageEvent, setPreparedImageEvent] = useState<any>(null);

  const handleQueueTypeChange = (queueTypeName: string) => {
    setSelectedQueueType(queueTypeName);
  };

  const handleHashtagPresetSelect = (presetId: string, hashtags: string) => {
    setSelectedHashTagPresetId(presetId);
    setSelectedHashtags(hashtags);
  };

  return {
    files,
    setFiles,
    selectedQueueType,
    setSelectedQueueType,
    selectedHashTagPresetId,
    setSelectedHashTagPresetId,
    selectedHashtags,
    setSelectedHashtags,
    showImagePreview,
    setShowImagePreview,
    preparedImageEvent,
    setPreparedImageEvent,
    handleQueueTypeChange,
    handleHashtagPresetSelect,
  };
}

