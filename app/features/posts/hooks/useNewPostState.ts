import { useState } from "react";

import type { PreparedEvent } from "../types";
/**
 * Custom hook for managing new post state
 */
export function useNewPostState() {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedQueueType, setSelectedQueueType] = useState("unassigned");
  const [selectedHashTagPresetId, setSelectedHashTagPresetId] = useState<
    string | null
  >(null);
  const [selectedHashtags, setSelectedHashtags] = useState("");
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [preparedImageEvent, setPreparedImageEvent] =
    useState<PreparedEvent | null>(null);

  const handleQueueTypeChange = (queueTypeName: string) => {
    setSelectedQueueType(queueTypeName);
  };

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string
  ) => {
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
