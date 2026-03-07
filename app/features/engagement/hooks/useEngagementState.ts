import { useState } from "react";

/** Type filter: all, replies only, or mentions (quotes + mention-type) */
export type EngagementTypeTab = "all" | "replies" | "mentions";

/** Sort order for engagement list */
export type EngagementSortBy = "newest" | "trust" | "zaps";

/**
 * Custom hook for managing engagement feed state
 */
export function useEngagementState() {
  const [selectedPost, setSelectedPost] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<EngagementTypeTab>("all");
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterHighReputation, setFilterHighReputation] = useState(false);
  const [filterMentionsOnly, setFilterMentionsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<EngagementSortBy>("newest");

  return {
    selectedPost,
    setSelectedPost,
    activeTab,
    setActiveTab,
    filterUnreadOnly,
    setFilterUnreadOnly,
    filterHighReputation,
    setFilterHighReputation,
    filterMentionsOnly,
    setFilterMentionsOnly,
    sortBy,
    setSortBy,
  };
}
