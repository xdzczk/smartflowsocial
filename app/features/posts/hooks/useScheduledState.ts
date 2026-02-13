import { useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";

import { difference, fromDate, nowInTimezone } from "~/lib/temporal";

import type { CombinedContent, LongFormPostData, PostData } from "../types";
import { isRepostPost } from "../utils/content-helpers";

import { dashboardKeys } from "./useDashboardQuery";
import { draftsKeys } from "./useDraftsQuery";
import { scheduledPostsKeys } from "./useScheduledPostsQuery";
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
    key: "scheduledAtUtc",
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
  const [postToEdit, setPostToEdit] = useState<EditablePost | null>(null);
  const [postToReschedule, setPostToReschedule] = useState<EditablePost | null>(
    null
  );
  interface FetcherData {
    success?: boolean;
  }
  const bulkDeleteFetcher = useFetcher<FetcherData>();
  const deleteFetcher = useFetcher<FetcherData>();

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
        if (!post.scheduledAtUtc) {
          return;
        }

        try {
          const scheduledAtUtc = post.scheduledAtUtc;
          const scheduledDate =
            scheduledAtUtc instanceof Date
              ? scheduledAtUtc
              : new Date(String(scheduledAtUtc));
          if (isNaN(scheduledDate.getTime())) return;

          const scheduledZoned = fromDate(scheduledDate, "UTC");

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
      if (
        sortConfig.key === "scheduledAtUtc" ||
        sortConfig.key === "scheduledFor"
      ) {
        const dateA = a.scheduledAtUtc ? a.scheduledAtUtc.getTime() : 0;
        const dateB = b.scheduledAtUtc ? b.scheduledAtUtc.getTime() : 0;
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }
      const aValue = (a as unknown as Record<string, unknown>)[
        sortConfig.key
      ] as string | number | undefined;
      const bValue = (b as unknown as Record<string, unknown>)[
        sortConfig.key
      ] as string | number | undefined;
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [scheduledPosts, sortConfig.key, sortConfig.direction]);

  // Filter posts by tab (Posts = original only, Reposts = repost only) and search
  const filteredPosts = useMemo(() => {
    const byTab =
      currentTab === "posts"
        ? sortedPosts.filter((p) => !isRepostPost(p))
        : currentTab === "reposts"
          ? sortedPosts.filter((p) => isRepostPost(p))
          : sortedPosts;
    return byTab.filter((post) =>
      post.caption?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedPosts, searchTerm, currentTab]);

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

  const queryClient = useQueryClient();

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    const postIds = Array.from(selectedPosts);

    // Optimistically remove posts from cache
    queryClient.setQueryData(
      scheduledPostsKeys.list(undefined, currentTab),
      (old: unknown) => {
        if (!old || typeof old !== "object" || !("pages" in old)) return old;
        const infiniteData = old as { pages: unknown[]; pageParams: unknown[] };
        return {
          ...infiniteData,
          pages: infiniteData.pages.map((page) => {
            if (!page || typeof page !== "object") return page;
            const pageObj = page as Record<string, unknown>;
            const updated: Record<string, unknown> = { ...pageObj };

            // Remove deleted posts from posts array
            if (Array.isArray(pageObj["posts"])) {
              updated["posts"] = (pageObj["posts"] as unknown[]).filter(
                (post) =>
                  !post ||
                  typeof post !== "object" ||
                  !("id" in post) ||
                  typeof post.id !== "string" ||
                  !postIds.includes(post.id)
              );
            }

            // Remove deleted posts from longformPosts array
            if (Array.isArray(pageObj["longformPosts"])) {
              updated["longformPosts"] = (
                pageObj["longformPosts"] as unknown[]
              ).filter(
                (post) =>
                  !post ||
                  typeof post !== "object" ||
                  !("id" in post) ||
                  typeof post.id !== "string" ||
                  !postIds.includes(post.id)
              );
            }

            return updated;
          }),
        };
      }
    );

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
        currentTab === "longform" ? "bulkDeleteLongForm" : "bulkDelete"
      );
      formData.append("postIds", JSON.stringify(postIds));

      bulkDeleteFetcher.submit(formData, { method: "post" });
    }
  };

  // Invalidate queries when delete succeeds
  useEffect(() => {
    if (bulkDeleteFetcher.state === "idle" && bulkDeleteFetcher.data) {
      // Invalidate both scheduled and dashboard queries to ensure consistency
      void queryClient.invalidateQueries({ queryKey: scheduledPostsKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      // Clear selection after successful delete
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.state, bulkDeleteFetcher.data, queryClient]);

  // Handle individual delete / move-to-draft fetcher
  useEffect(() => {
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- fetcher data type narrows at runtime */
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      void queryClient.invalidateQueries({ queryKey: scheduledPostsKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      // When moving to drafts, refresh drafts list
      if (
        typeof deleteFetcher.data === "object" &&
        deleteFetcher.data !== null &&
        "moved" in deleteFetcher.data &&
        (deleteFetcher.data as { moved?: boolean }).moved
      ) {
        void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
      }
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
  }, [deleteFetcher.state, deleteFetcher.data, queryClient]);

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
    setSortConfig,
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
