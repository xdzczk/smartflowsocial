import { useState } from "react";
import { useNavigation } from "@remix-run/react";

interface UseNewLongFormStateProps {
  userTags: string;
}

/**
 * Custom hook for managing new longform post state
 */
export function useNewLongFormState({ userTags }: UseNewLongFormStateProps) {
  const navigation = useNavigation();
  const [displayedHashtags, setDisplayedHashtags] = useState(userTags || "");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState({
    title: "",
    summary: "",
    content: "",
    image: "",
  });
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState<
    string | null
  >(null);
  const [selectedHashtags, setSelectedHashtags] = useState("");

  const isSubmitting = navigation.state === "submitting";

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string,
  ) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtags(hashtags);
    if (useHashtagPresets) {
      setDisplayedHashtags(hashtags);
    }
  };

  // Function to update displayed hashtags when queue type changes
  const updateDisplayedHashtags = async (queueTypeName: string) => {
    if (useHashtagPresets && selectedHashtags) {
      // If manual hashtag presets are enabled, use the selected hashtags
      setDisplayedHashtags(selectedHashtags);
      return;
    }

    if (queueTypeName === "Unassigned") {
      setDisplayedHashtags(userTags || "");
      return;
    }

    try {
      const response = await fetch("/api/effective-hashtags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeName: queueTypeName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDisplayedHashtags(data.hashtags || userTags || "");
      } else {
        setDisplayedHashtags(userTags || "");
      }
    } catch (error) {
      console.error("Error fetching effective hashtags:", error);
      setDisplayedHashtags(userTags || "");
    }
  };

  // Update displayed hashtags when hashtag preset usage changes
  const handleUseHashtagPresetsChange = (enabled: boolean) => {
    setUseHashtagPresets(enabled);
    if (!enabled) {
      // When disabling manual presets, revert to queue type hashtags
      // This will trigger through the queue type change logic in the component
    } else if (selectedHashtags) {
      setDisplayedHashtags(selectedHashtags);
    }
  };

  const handlePreview = (data: {
    title: string;
    summary: string;
    content: string;
    image: string;
  }) => {
    setPreviewData(data);
    setShowPreviewModal(true);
  };

  return {
    displayedHashtags,
    showPreviewModal,
    setShowPreviewModal,
    previewData,
    useHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtags,
    isSubmitting,
    handleHashtagPresetSelect,
    updateDisplayedHashtags,
    handleUseHashtagPresetsChange,
    handlePreview,
  };
}

