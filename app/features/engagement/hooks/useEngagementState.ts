import { useState } from "react";

/**
 * Custom hook for managing engagement feed state
 */
export function useEngagementState() {
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"all" | "replies" | "quotes">(
    "all",
  );

  return {
    selectedPost,
    activeTab,
    setSelectedPost,
    setActiveTab,
  };
}




