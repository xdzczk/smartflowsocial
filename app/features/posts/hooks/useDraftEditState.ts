import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";

import { signDraftForScheduling } from "~/features/posts/services/draft-sign.server";
import type { UserData, HashTagPreset, PostData } from "~/features/posts/types";
import { useOptionalUser } from "~/lib/remix-utils";

interface Post {
  content?: string | null;
  caption?: string | null;
  queueType?: { name: string } | null;
  hashTagPresetId?: string | null;
  fileUrl?: string[] | null;
}

interface UseDraftEditStateProps {
  post: Post;
  user: UserData;
  hashTagPresets: HashTagPreset[];
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
    (typeof post.queueType === "object" && post.queueType?.name) || (typeof post.queueType === "string" ? post.queueType : "unassigned"),
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

  const calculateQueueScheduleTime = useCallback(async (queueTypeName: string) => {
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
        const data = (await response.json()) as { scheduledTime?: string };
        const scheduledTime = data.scheduledTime;
        if (scheduledTime) {
          setScheduledFor(scheduledTime);
        }
      }
    } catch (error) {
      console.error("Error calculating schedule time:", error);
    }
  }, [currentUser?.id]);

  const handleSignAndResume = async () => {
    try {
      // Convert currentUser (User | null | undefined) to UserData | null
      const currentUserData: UserData | null = currentUser ? {
        id: currentUser.id,
        npub: currentUser.npub,
        timezone: currentUser.timezone || null,
        scheduleInterval: currentUser.scheduleInterval ? currentUser.scheduleInterval.map(Number).filter(n => !isNaN(n)) : undefined,
        userRelays: currentUser.userRelays,
        showHashTagsinPosts: currentUser.showHashTagsinPosts,
        isEnabled: currentUser.isEnabled,
      } : null;
      
      const result = await signDraftForScheduling({
        content,
        caption,
        scheduledFor,
        selectedQueue,
        useHashtagPresets,
        selectedHashtags,
        user,
        currentUser: currentUserData,
        post: post as unknown as PostData,
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
      void calculateQueueScheduleTime(selectedQueue);
    } else {
      setScheduledFor("");
    }
  }, [selectedQueue, calculateQueueScheduleTime]);

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

