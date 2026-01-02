import { useNavigation } from "@remix-run/react";
import { useState } from "react";
interface UseLongFormEditStateProps {
  userTags: string;
  hashtagPresets: { id: string; tags: string }[];
}

/**
 * Custom hook for managing longform edit state
 */
export function useLongFormEditState({
  userTags,
  hashtagPresets,
}: UseLongFormEditStateProps) {
  const navigation = useNavigation();
  const [displayedHashtags, setDisplayedHashtags] = useState(userTags ?? "");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState({
    title: "",
    summary: "",
    content: "",
    image: "",
  });

  // Hashtag preset state
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState("");
  const [selectedHashtags, setSelectedHashtags] = useState("");

  const isSubmitting = navigation.state === "submitting";

  // Hashtag preset handlers
  const handleHashtagPresetToggle = (enabled: boolean) => {
    setUseHashtagPresets(enabled);
    if (!enabled) {
      // If disabled, clear manual selection and revert to queue/user default
      setSelectedHashtagPresetId("");
      setSelectedHashtags("");
      // Note: displayedHashtags will be updated by queue type change logic
    } else if (selectedHashtags) {
      // If enabled and we have selected hashtags, show them
      setDisplayedHashtags(selectedHashtags);
    }
  };

  const handleHashtagPresetChange = (presetId: string) => {
    setSelectedHashtagPresetId(presetId);
    const preset = hashtagPresets.find((p) => p.id === presetId);
    const tags = preset?.tags ?? "";
    setSelectedHashtags(tags);
    if (useHashtagPresets) {
      setDisplayedHashtags(tags);
    }
  };

  // Function to update displayed hashtags when queue type changes
  const updateDisplayedHashtags = async (queueTypeName: string) => {
    // Don't update if using manual hashtag presets
    if (useHashtagPresets) {
      return;
    }

    if (queueTypeName === "unassigned") {
      setDisplayedHashtags(userTags ?? "");
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
        const data = (await response.json()) as { hashtags?: string };
        setDisplayedHashtags((data.hashtags ?? userTags) || "");
      } else {
        setDisplayedHashtags(userTags ?? "");
      }
    } catch (error) {
      console.error("Error fetching effective hashtags:", error);
      setDisplayedHashtags(userTags ?? "");
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
    handleHashtagPresetToggle,
    handleHashtagPresetChange,
    updateDisplayedHashtags,
    handlePreview,
  };
}
