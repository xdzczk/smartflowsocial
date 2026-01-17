import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";

import {
  difference,
  fromDate,
  fromUnixTimestamp,
  nowInTimezone,
} from "~/lib/temporal";

import type { PostData, LongFormPostData } from "../types";
interface UseDashboardStateProps {
  scheduledPosts: PostData[];
  userTimezone?: string | null;
}

/**
 * Custom hook for managing dashboard state and operations
 */
export function useDashboardState({
  scheduledPosts,
  userTimezone,
}: UseDashboardStateProps) {
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

  const [selectedLongFormPost, setSelectedLongFormPost] =
    useState<LongFormPostData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [postToEdit, setPostToEdit] = useState<
    PostData | LongFormPostData | null
  >(null);
  const [postToReschedule, setPostToReschedule] = useState<
    PostData | LongFormPostData | null
  >(null);
  interface FetcherData {
    success?: boolean;
  }
  const bulkDeleteFetcher = useFetcher<FetcherData>();

  // Memoize post IDs to avoid infinite loops when scheduledPosts array reference changes
  const postIds = useMemo(
    () => scheduledPosts.map((post) => post.id).join(","),
    [scheduledPosts]
  );

  // Update countdowns
  useEffect(() => {
    const updateCountdowns = () => {
      const tz = userTimezone ?? "UTC";
      const now = nowInTimezone(tz);
      const newCountdowns: Record<string, string> = {};

      scheduledPosts.forEach((post) => {
        if (!post.scheduledFor) {
          return;
        }

        try {
          // Convert scheduledFor to Temporal ZonedDateTime
          let scheduledZoned;
          const scheduledForValue = post.scheduledFor;

          if (
            scheduledForValue &&
            typeof scheduledForValue === "object" &&
            "getTime" in scheduledForValue
          ) {
            scheduledZoned = fromDate(scheduledForValue, "UTC");
          } else if (typeof scheduledForValue === "string") {
            const timestamp = parseInt(scheduledForValue, 10);
            if (!isNaN(timestamp)) {
              scheduledZoned = fromUnixTimestamp(timestamp, "UTC");
            } else {
              return;
            }
          } else if (typeof scheduledForValue === "number") {
            scheduledZoned = fromUnixTimestamp(
              Math.floor(scheduledForValue / 1000),
              "UTC"
            );
          } else {
            return;
          }

          // Convert to user's timezone for comparison
          const scheduledInUserTz = scheduledZoned.withTimeZone(tz);

          // Calculate difference
          const duration = difference(scheduledInUserTz, now);

          if (duration.sign === 1) {
            // Future time
            const days = Math.floor(duration.total({ unit: "days" }));
            const hours = Math.floor(duration.total({ unit: "hours" }) % 24);
            const minutes = Math.floor(
              duration.total({ unit: "minutes" }) % 60
            );
            newCountdowns[post.id] = `${days}d ${hours}h ${minutes}m`;
          } else {
            newCountdowns[post.id] = "Due now";
          }
        } catch {
          // If conversion fails, skip this post
          newCountdowns[post.id] = "Due now";
        }
      });

      setCountdowns((prev) => {
        // Only update if countdowns actually changed to prevent unnecessary re-renders
        const hasChanged =
          Object.keys(newCountdowns).some(
            (id) => prev[id] !== newCountdowns[id]
          ) || Object.keys(prev).length !== Object.keys(newCountdowns).length;

        return hasChanged ? newCountdowns : prev;
      });
    };

    updateCountdowns();
    const timer = setInterval(updateCountdowns, 60000);
    return () => clearInterval(timer);
    // Use postIds instead of scheduledPosts to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies are intentionally limited to avoid infinite loops
  }, [postIds, userTimezone]);

  // Clear selected posts after bulk delete
  useEffect(() => {
    const dataRaw = bulkDeleteFetcher.data;
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as { success?: unknown })
        : null;
    if (data && typeof data.success === "boolean" && data.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data]);

  // Sort posts - memoized to prevent unnecessary re-sorting on every render
  const sortedPosts = useMemo(() => {
    return [...scheduledPosts].sort((a, b) => {
      if (sortConfig.key === "scheduledFor") {
        const aScheduled = a.scheduledFor;
        const bScheduled = b.scheduledFor;
        const aValue =
          typeof aScheduled === "string" || typeof aScheduled === "number"
            ? aScheduled
            : "0";
        const bValue =
          typeof bScheduled === "string" || typeof bScheduled === "number"
            ? bScheduled
            : "0";
        const dateA = parseInt(String(aValue)) * 1000;
        const dateB = parseInt(String(bValue)) * 1000;
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }
      // For other keys, access safely
      const key = sortConfig.key as keyof PostData;
      const aValue = a[key] as string | number | undefined;
      const bValue = b[key] as string | number | undefined;
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [scheduledPosts, sortConfig.key, sortConfig.direction]);

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

  const handleMediaClick = (mediaSrc: string) => {
    setSelectedMedia(mediaSrc);
    setIsMediaModalOpen(true);
  };

  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setSelectedMedia(null);
  };

  const handleEditPost = (post: PostData | LongFormPostData) => {
    setPostToEdit(post);
    setShowEditModal(true);
  };

  const handleReschedulePost = (post: PostData | LongFormPostData) => {
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
