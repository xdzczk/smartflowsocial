import { useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  isAttachedFollowUpDraftPost,
  isPollDraftPost,
  isShortPostDraftForPostsTab,
  isStandaloneRepostDraftPost,
  isThreadDraftPost,
} from "~/features/posts/drafts/utils/draft-post-classification";
import {
  buildShortDraftSearchHaystack,
  matchesDraftSearch,
} from "~/features/posts/drafts/utils/draft-search-haystack";

import { draftsKeys } from "./useDraftsQuery";

/** Serialized short-form row for drafts list sorting/filtering */
export interface DraftsHookPost {
  id: string;
  caption?: string | null;
  content?: string | null;
  createdAt: string;
  updatedAt?: string;
  postType?: string;
  postKind?: string;
  draftMeta?: unknown;
  [key: string]: unknown;
}

interface CombinedContentItem {
  id: string;
  type: "post" | "longform";
}

interface UseDraftsStateProps {
  posts: DraftsHookPost[];
  /** When provided (e.g. on "all" tab), select-all and bulk delete include both posts and longform */
  allContent?: CombinedContentItem[];
  currentTab?: string;
}

/**
 * Custom hook for managing drafts state and operations
 */
export function useDraftsState({
  posts,
  allContent,
  currentTab = "all",
}: UseDraftsStateProps) {
  const queryClient = useQueryClient();
  const [sortConfig, setSortConfig] = useState({
    key: "updatedAt",
    direction: "desc" as "asc" | "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const clearSelection = useCallback(() => {
    setSelectedPosts(new Set());
  }, []);
  const [showAdvancedBulkResume, setShowAdvancedBulkResume] = useState(false);
  interface FetcherData {
    success?: boolean;
  }
  const bulkDeleteFetcher = useFetcher<FetcherData>();
  const bulkResumeFetcher = useFetcher<FetcherData>();

  // Sort posts - memoized to prevent unnecessary re-sorting on every render
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (sortConfig.key === "createdAt" || sortConfig.key === "updatedAt") {
        const key = sortConfig.key;
        const fallback = "createdAt";
        const getTime = (p: DraftsHookPost) => {
          const raw = p[key] ?? p[fallback];
          try {
            return new Date(String(raw)).getTime();
          } catch {
            return 0;
          }
        };
        const dateA = getTime(a);
        const dateB = getTime(b);
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

  // Filter posts by tab (Posts = original only, Reposts = repost only) and search
  const filteredPosts = useMemo(() => {
    const byTab =
      currentTab === "posts"
        ? sortedPosts.filter((p) => isShortPostDraftForPostsTab(p))
        : currentTab === "polls"
          ? sortedPosts.filter((p) => isPollDraftPost(p))
          : currentTab === "threads"
            ? sortedPosts.filter((p) => isThreadDraftPost(p))
            : currentTab === "reposts"
              ? sortedPosts.filter((p) => isStandaloneRepostDraftPost(p))
              : currentTab === "followups"
                ? sortedPosts.filter((p) => isAttachedFollowUpDraftPost(p))
                : sortedPosts;
    return byTab.filter((post) =>
      matchesDraftSearch(buildShortDraftSearchHaystack(post), searchTerm)
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
    if (allContent && allContent.length > 0) {
      if (selectedPosts.size === allContent.length) {
        setSelectedPosts(new Set());
      } else {
        setSelectedPosts(new Set(allContent.map((c) => c.id)));
      }
    } else {
      if (selectedPosts.size === filteredPosts.length) {
        setSelectedPosts(new Set());
      } else {
        setSelectedPosts(new Set(filteredPosts.map((post) => post.id)));
      }
    }
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    if (allContent && allContent.length > 0) {
      const itemData = Array.from(selectedPosts).map((id) => {
        const c = allContent.find((x) => x.id === id);
        return { id, type: c?.type ?? ("post" as const) };
      });
      formData.append("_action", "bulkDeleteMixed");
      formData.append("itemData", JSON.stringify(itemData));
    } else {
      formData.append("_action", "bulkDelete");
      formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));
    }

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
      void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
      // Defer to avoid cascading renders
      setTimeout(() => {
        setSelectedPosts(new Set());
        setShowAdvancedBulkResume(false);
      }, 0);
    }
  }, [bulkDeleteFetcher.data, bulkResumeFetcher.data, queryClient]);

  return {
    sortConfig,
    setSortConfig,
    searchTerm,
    selectedPosts,
    clearSelection,
    showAdvancedBulkResume,
    filteredPosts,
    bulkDeleteFetcher,
    bulkResumeFetcher,
    requestSort,
    setSearchTerm,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    setShowAdvancedBulkResume,
  };
}
