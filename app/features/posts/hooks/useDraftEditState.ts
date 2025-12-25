import { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { useOptionalUser } from "~/lib/remix-utils";
import { signDraftForScheduling } from "~/features/posts/services/draft-sign.server";

interface Post {
  content?: string | null;
  caption?: string | null;
  queueType?: { name: string } | null;
  hashTagPresetId?: string | null;
  fileUrl?: string[] | null;
}

interface UseDraftEditStateProps {
  post: Post;
  user: any;
  hashTagPresets: any[];
}

/**
 * Custom hook for managing draft edit state and operations
 */
export function useDraftEditState({
  post,
  user,
  hashTagPresets,
}: UseDraftEditStateProps) {
  const fetcher = useFetcher();
  const currentUser = useOptionalUser();
  const [content, setContent] = useState(post.content || "");
  const [caption] = useState(post.caption || "");
  const [selectedQueue, setSelectedQueue] = useState(
    post.queueType?.name || post.queueType || "unassigned",
  );
  const [scheduledFor, setScheduledFor] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [useHashtagPresets, setUseHashtagPresets] = useState(
    !!post.hashTagPresetId,
  );
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState(
    post.hashTagPresetId || null,
  );
  const [selectedHashtags, setSelectedHashtags] = useState("");

  const isSubmitting = fetcher.state !== "idle";

  const handleResumeClick = () => {
    if (!scheduledFor) {
      alert("Please set a schedule time first");
      return;
    }
    setShowResumeModal(true);
  };

  const calculateQueueScheduleTime = async (queueTypeName: string) => {
    if (queueTypeName === "unassigned") {
      setScheduledFor("");
      return;
    }

    try {
      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeName,
          userId: currentUser?.id,
        }),
      });

      if (response.ok) {
        const { scheduledTime } = await response.json();
        setScheduledFor(scheduledTime);
      }
    } catch (error) {
      console.error("Error calculating schedule time:", error);
    }
  };

  const handleSignAndResume = async () => {
    try {
      const result = await signDraftForScheduling({
        content,
        caption,
        scheduledFor,
        selectedQueue,
        useHashtagPresets,
        selectedHashtags,
        user,
        currentUser,
        post,
      });

      const formData = new FormData();
      formData.append("_action", "resume");
      formData.append("content", content);
      formData.append("caption", caption || content);
      formData.append("queueType", selectedQueue);
      formData.append("scheduledFor", result.scheduledForUnix.toString());
      formData.append("signedEvent", JSON.stringify(result.signedEvent));
      formData.append("nostrEvent", JSON.stringify(result.nostrEvent));

      // Add hashtag preset data
      if (useHashtagPresets && selectedHashtagPresetId) {
        formData.append("hashTagPresetId", selectedHashtagPresetId);
        formData.append("useHashtagPresets", "on");
      }

      fetcher.submit(formData, { method: "post" });
      setShowResumeModal(false);
    } catch (error) {
      console.error("Error signing event:", error);
      alert("Error signing the post. Please try again.");
    }
  };

  const handleHashtagPresetSelect = (presetId: string, hashtags: string) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtags(hashtags);
  };

  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      calculateQueueScheduleTime(selectedQueue);
    } else {
      setScheduledFor("");
    }
  }, [selectedQueue, currentUser?.id]);

  // Initialize hashtag preset data on component mount
  useEffect(() => {
    if (post.hashTagPresetId && hashTagPresets.length > 0) {
      const preset = hashTagPresets.find((p) => p.id === post.hashTagPresetId);
      if (preset) {
        setSelectedHashtags(preset.tags || "");
      }
    }
  }, [post.hashTagPresetId, hashTagPresets]);

  return {
    content,
    selectedQueue,
    scheduledFor,
    showResumeModal,
    useHashtagPresets,
    selectedHashtagPresetId,
    isSubmitting,
    fetcher,
    setContent,
    setSelectedQueue,
    setScheduledFor,
    setShowResumeModal,
    setUseHashtagPresets,
    handleResumeClick,
    handleSignAndResume,
    handleHashtagPresetSelect,
  };
}

