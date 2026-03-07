import { useState } from "react";

/** Inbox view: unread (default), all, handled, or replied */
export type InboxTab = "unread" | "all" | "handled" | "replied";

/** Type filter: all, replies only, or quotes only */
export type EngagementTypeTab = "all" | "replies" | "quotes";

/** Sort order for engagement list */
export type EngagementSortBy = "newest" | "trust" | "zaps";

/**
 * Custom hook for managing engagement feed state
 */
export function useEngagementState() {
  const [selectedPost, setSelectedPost] = useState<unknown>(null);
  const [inboxTab, setInboxTab] = useState<InboxTab>("unread");
  const [activeTab, setActiveTab] = useState<EngagementTypeTab>("all");
  const [filterHighReputation, setFilterHighReputation] = useState(false);
  const [filterMentionsOnly, setFilterMentionsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<EngagementSortBy>("newest");

  return {
    selectedPost,
    inboxTab,
    setInboxTab,
    activeTab,
    setActiveTab,
    setSelectedPost,
    filterHighReputation,
    setFilterHighReputation,
    filterMentionsOnly,
    setFilterMentionsOnly,
    sortBy,
    setSortBy,
  };
}
