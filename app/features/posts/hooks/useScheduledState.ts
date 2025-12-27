import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import type { CombinedContent, LongFormPostData, PostData } from "~/features/posts/types";
// Union type for posts that can be edited/rescheduled
type EditablePost = PostData | LongFormPostData;

interface UseScheduledStateProps {
  scheduledPosts: PostData[];
  userTimezone?: string | null;
  allContent?: CombinedContent[];
  currentTab: string;
}

/**
 * Custom hook for managing scheduled posts state and operations
 * Extends useDashboardState with mixed bulk delete support
 */
export function useScheduledState({
  scheduledPosts,
  userTimezone,
  allContent,
  currentTab,
}: UseScheduledStateProps) {
  const [sortConfig, setSortConfig] = useState({
    key: "scheduledFor",
    direction: "asc" as "asc" | "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const [selectedLongFormPost, setSelectedLongFormPost] = useState<LongFormPostData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [postToEdit, setPostToEdit] = useState<EditablePost | null>(null);
  const [postToReschedule, setPostToReschedule] = useState<EditablePost | null>(null);
  interface FetcherData {
    success?: boolean;
  }
  const bulkDeleteFetcher = useFetcher<FetcherData>();
  const deleteFetcher = useFetcher<FetcherData>();

  // Update countdowns
  useEffect(() => {
    const updateCountdowns = () => {
      const tz = userTimezone ?? "UTC";
      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: tz }),
      ).getTime();
      const newCountdowns: Record<string, string> = {};

      scheduledPosts.forEach((post) => {
        const scheduledFor = typeof post.scheduledFor === "string" ? post.scheduledFor : String(post.scheduledFor ?? "0");
        const utcTime = parseInt(scheduledFor) * 1000;
        const userTime = new Date(utcTime).toLocaleString("en-US", {
          timeZone: tz,
        });
        const scheduledTime = new Date(userTime).getTime();
        const distance = scheduledTime - now;

        if (distance > 0) {
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          );
          const minutes = Math.floor(
            (distance % (1000 * 60 * 60)) / (1000 * 60),
          );
          newCountdowns[post.id] = `${days}d ${hours}h ${minutes}m`;
        } else {
          newCountdowns[post.id] = "Due now";
        }
      });

      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const timer = setInterval(updateCountdowns, 60000);
    return () => clearInterval(timer);
  }, [scheduledPosts, userTimezone]);

  // Clear selected posts after bulk delete
  useEffect(() => {
    const dataRaw = bulkDeleteFetcher.data;
    const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown } : null;
    if (data && typeof data.success === "boolean" && data.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data]);

  // Sort posts
  const sortedPosts = [...scheduledPosts].sort((a, b) => {
    if (sortConfig.key === "scheduledFor") {
      const aScheduledFor = typeof a.scheduledFor === "string" ? a.scheduledFor : String(a.scheduledFor || "0");
      const bScheduledFor = typeof b.scheduledFor === "string" ? b.scheduledFor : String(b.scheduledFor || "0");
      const dateA = parseInt(aScheduledFor) * 1000;
      const dateB = parseInt(bScheduledFor) * 1000;
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
    }
    const aValue = (a as unknown as Record<string, unknown>)[sortConfig.key] as string | number | undefined;
    const bValue = (b as unknown as Record<string, unknown>)[sortConfig.key] as string | number | undefined;
    if (aValue === undefined || bValue === undefined) return 0;
    if (aValue < bValue)
      return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue)
      return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Filter posts
  const filteredPosts = sortedPosts.filter((post) =>
    post.caption?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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

    // For All tab, we need to handle mixed content types
    if (currentTab === "all" && allContent) {
      const selectedItems = allContent
        .filter((item) => selectedPosts.has(item.id))
        .map((item) => ({ id: item.id, type: item.type }));

      const formData = new FormData();
      formData.append("_action", "bulkDeleteMixed");
      formData.append("itemData", JSON.stringify(selectedItems));

      bulkDeleteFetcher.submit(formData, { method: "post" });
    } else {
      // For individual tabs, use the original handlers
      const formData = new FormData();
      formData.append(
        "_action",
        currentTab === "longform" ? "bulkDeleteLongForm" : "bulkDelete",
      );
      formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

      bulkDeleteFetcher.submit(formData, { method: "post" });
    }
  };

  const handleMediaClick = (mediaSrc: string) => {
    setSelectedMedia(mediaSrc);
    setIsMediaModalOpen(true);
  };

  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setSelectedMedia(null);
  };

  const handleEditPost = (post: EditablePost) => {
    setPostToEdit(post);
    setShowEditModal(true);
  };

  const handleReschedulePost = (post: EditablePost) => {
    setPostToReschedule(post);
    setShowRescheduleModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setPostToEdit(null);
  };

  const handleCloseRescheduleModal = () => {
    setShowRescheduleModal(false);
    setPostToReschedule(null);
  };

  const handleModalSuccess = () => {
    window.location.reload();
  };

  return {
    sortConfig,
    searchTerm,
    countdowns,
    selectedPost,
    selectedPosts,
    selectedMedia,
    isMediaModalOpen,
    selectedLongFormPost,
    showEditModal,
    showRescheduleModal,
    postToEdit,
    postToReschedule,
    filteredPosts,
    bulkDeleteFetcher,
    deleteFetcher,
    requestSort,
    setSearchTerm,
    setSelectedPost,
    setSelectedLongFormPost,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    handleMediaClick,
    handleCloseMediaModal,
    handleEditPost,
    handleReschedulePost,
    handleCloseEditModal,
    handleCloseRescheduleModal,
    handleModalSuccess,
  };
}

