import { useState } from "react";

interface Post {
  id: string;
  caption?: string | null;
  postedAt: Date | null;
  totalEngagement: number;
  [key: string]: unknown;
}

interface UseGiveawayStateProps {
  posts: Post[];
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

/**
 * Custom hook for managing giveaway posts state and operations
 */
export function useGiveawayState({ posts }: UseGiveawayStateProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "totalEngagement",
    direction: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [dateRange, setDateRange] = useState({
    from: "",
    to: "",
  });

  // Sort posts
  const sortedPosts = [...posts].sort((a, b) => {
    if (sortConfig.key === "postedAt") {
      const dateA = new Date(a[sortConfig.key] || 0).getTime();
      const dateB = new Date(b[sortConfig.key] || 0).getTime();
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
    }
    if (sortConfig.key === "totalEngagement") {
      return sortConfig.direction === "asc"
        ? a.totalEngagement - b.totalEngagement
        : b.totalEngagement - a.totalEngagement;
    }
    const aValue = a[sortConfig.key as keyof Post];
    const bValue = b[sortConfig.key as keyof Post];
    
    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortConfig.direction === "asc" ? -1 : 1;
    if (bValue == null) return sortConfig.direction === "asc" ? 1 : -1;
    
    if (aValue < bValue)
      return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue)
      return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Filter posts
  const filteredPosts = sortedPosts.filter((post) => {
    // Text search filter
    const matchesSearch = post.caption
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());

    // Date range filter
    let matchesDateRange = true;
    if (dateRange.from) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      const postDate = new Date(post.postedAt || 0);
      if (postDate < fromDate) {
        matchesDateRange = false;
      }
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      const postDate = new Date(post.postedAt || 0);
      if (postDate > toDate) {
        matchesDateRange = false;
      }
    }

    return matchesSearch && matchesDateRange;
  });

  const requestSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const clearFilters = () => {
    setDateRange({ from: "", to: "" });
    setSearchTerm("");
  };

  return {
    sortConfig,
    searchTerm,
    selectedPost,
    dateRange,
    filteredPosts,
    requestSort,
    setSearchTerm,
    setSelectedPost,
    setDateRange,
    clearFilters,
  };
}

