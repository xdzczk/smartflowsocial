import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";
interface Post {
  id: string;
  caption?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

interface UseDraftsStateProps {
  posts: Post[];
}

/**
 * Custom hook for managing drafts state and operations
 */
export function useDraftsState({ posts }: UseDraftsStateProps) {
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc" as "asc" | "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showAdvancedBulkResume, setShowAdvancedBulkResume] = useState(false);
  interface FetcherData {
    success?: boolean;
  }
  const bulkDeleteFetcher = useFetcher<FetcherData>();
  const bulkResumeFetcher = useFetcher<FetcherData>();

  // Sort posts - memoized to prevent unnecessary re-sorting on every render
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (sortConfig.key === "createdAt") {
        const dateA = new Date(a[sortConfig.key]).getTime();
        const dateB = new Date(b[sortConfig.key]).getTime();
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }
      const aValue = a[sortConfig.key] as string | number | undefined;
      const bValue = b[sortConfig.key] as string | number | undefined;
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [posts, sortConfig.key, sortConfig.direction]);

  // Filter posts - memoized to prevent unnecessary filtering on every render
  const filteredPosts = useMemo(() => {
    return sortedPosts.filter((post) =>
      post.caption?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedPosts, searchTerm]);

  const requestSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map((post) => post.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkDelete");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkDeleteFetcher.submit(formData, { method: "post" });
  };

  // Clear selected posts after bulk operations
  useEffect(() => {
    const deleteDataRaw = bulkDeleteFetcher.data;
    const resumeDataRaw = bulkResumeFetcher.data;
    const deleteData =
      deleteDataRaw &&
      typeof deleteDataRaw === "object" &&
      !Array.isArray(deleteDataRaw)
        ? (deleteDataRaw as { success?: unknown })
        : null;
    const resumeData =
      resumeDataRaw &&
      typeof resumeDataRaw === "object" &&
      !Array.isArray(resumeDataRaw)
        ? (resumeDataRaw as { success?: unknown })
        : null;
    const deleteSuccess =
      deleteData &&
      typeof deleteData.success === "boolean" &&
      deleteData.success;
    const resumeSuccess =
      resumeData &&
      typeof resumeData.success === "boolean" &&
      resumeData.success;
    if (deleteSuccess || resumeSuccess) {
      // Defer to avoid cascading renders
      setTimeout(() => {
        setSelectedPosts(new Set());
        setShowAdvancedBulkResume(false);
      }, 0);
    }
  }, [bulkDeleteFetcher.data, bulkResumeFetcher.data]);

  return {
    sortConfig,
    searchTerm,
    selectedPost,
    selectedPosts,
    showAdvancedBulkResume,
    filteredPosts,
    bulkDeleteFetcher,
    bulkResumeFetcher,
    requestSort,
    setSearchTerm,
    setSelectedPost,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    setShowAdvancedBulkResume,
  };
}
