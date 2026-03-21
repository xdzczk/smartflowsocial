import { useCallback, useState } from "react";

import type { PreparedEvent } from "../../types";
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

  const handleQueueTypeChange = useCallback((queueTypeName: string) => {
    setSelectedQueueType(queueTypeName);
  }, []);

  const handleHashtagPresetSelect = useCallback(
    (presetId: string | null, hashtags: string) => {
      setSelectedHashTagPresetId(presetId);
      setSelectedHashtags(hashtags);
    },
    []
  );

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
